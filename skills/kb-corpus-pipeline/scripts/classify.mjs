/**
 * 第 4 段 · 分类：归入 concepts／entities／faq 三类，并打 `domain`（manifest 读取口径）
 * 与 `subject_domain`（主题域），产出可直接被 `kb_ingest` 吃下的候选条目包。
 *
 * 读的是第 3 段产物（已保证：无 YAML 头、一问一条、词表零命中、无依据已剔除）。
 *
 * 用法：
 *   node scripts/classify.mjs --clean <cleanDir> --out <candidatesDir> --domains <domains.json> [--name <corpus名>]
 */
import { dirname, join, resolve } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import {
  SCHEMA, countBy, listFiles, nowIso, parseArgs, readJson, sha256_16, slugify, today, writeJson, writeText,
} from './lib.mjs'

const TYPES = ['concepts', 'entities', 'faq']

const ENTITY_HINTS = [
  '公司', '集团', '机构', '中心', '平台', '系统', '协会', '学会', '部门', '学院', '大学', '学校',
  '证书', '认证', '牌照', '商标', '产品', '项目', '机器人', '智能体',
]

/** 判定知识类型（三类之一）。 */
export function classifyType(entry) {
  const firstLine = String(entry.body ?? '').split(/\r?\n/).map(line => line.trim()).find(line => line !== '') ?? ''
  if (/[？?]\s*$/.test(entry.title ?? '') || /[？?]\s*$/.test(firstLine)) return 'faq'
  const haystack = `${entry.title ?? ''}\n${entry.body ?? ''}`
  if (ENTITY_HINTS.some(hint => haystack.includes(hint))) return 'entities'
  return 'concepts'
}

/** 判定主题域（关键词命中；缺省 default）。 */
export function classifyDomain(haystack, domainRules) {
  const text = String(haystack ?? '')
  for (const rule of domainRules.rules ?? []) {
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : []
    if (keywords.some(keyword => keyword !== '' && text.includes(keyword))) return String(rule.domain ?? 'unknown')
  }
  return String(domainRules.default ?? 'general')
}

/**
 * @param {{cleanDir:string, outDir:string, domainsPath:string, name?:string, visibility?:string, reportsDir?:string}} options
 */
export async function runClassify(options) {
  const index = await readJson(join(options.cleanDir, 'index.json'))
  const entries = Array.isArray(index.entries) ? index.entries : []
  const domainRules = await readJson(options.domainsPath)
  const visibility = options.visibility ?? 'internal'
  const corpusName = options.name ?? `kb-corpus-candidates-v1`

  // 复跑幂等：只清本技能自己产出的三类目录与 manifest（包级隔离，不动其它文件）。
  for (const type of TYPES) await rm(join(options.outDir, type), { recursive: true, force: true })
  await rm(join(options.outDir, 'manifest.json'), { force: true })
  await mkdir(options.outDir, { recursive: true })

  const items = []
  const written = []
  for (const entry of entries) {
    const type = classifyType(entry)
    const subjectDomain = classifyDomain(`${entry.title}\n${entry.body}`, domainRules)
    const content = `# ${entry.title}\n\n${entry.body.replace(/^\s*---[\s\S]*?---\s*/, '').trim()}\n`
    const hash = sha256_16(content)
    const file = slugify(entry.title, hash) + '.md'
    const rel = `${type}/${file}`
    await writeText(join(options.outDir, rel), content)
    items.push({
      path: rel,
      domain: type,
      title: entry.title,
      subject_domain: subjectDomain,
      visibility,
      bytes: Buffer.byteLength(content, 'utf8'),
      chars: [...content].length,
      sha256_16: hash,
      contains_other_subject: false,
      other_subject_hits: [],
      evidence_state: entry.evidence_state,
      source_url: entry.url,
      fetched_at: entry.fetched_at,
    })
    written.push({ rel, content, type, subjectDomain })
  }
  items.sort((a, b) => a.path.localeCompare(b.path))

  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0)
  const manifest = {
    name: corpusName,
    schema: SCHEMA.manifest,
    created: today(),
    generated_at: nowIso(),
    purpose: 'kb-corpus-pipeline 第 1–4 段候选条目包（待第 5–7 段审查/入库/调取）',
    red_lines: [
      '候选条目，未经人类放行不得对外',
      '含他主体名条目对外前必须清洗主体名',
      'subject-private 条目仅限授权主体可见',
    ],
    counts: {
      total: items.length,
      by_domain: countBy(items, item => item.domain),
      by_subject_domain: countBy(items, item => item.subject_domain),
      total_bytes: totalBytes,
      with_other_subject: 0,
    },
    items,
  }
  await writeJson(join(options.outDir, 'manifest.json'), manifest)

  const report = {
    schema: `${SCHEMA.manifest}.report`,
    stage: 'classify',
    generated_at: manifest.generated_at,
    corpus_dir: resolve(options.outDir),
    files_written: written.length,
    counts: manifest.counts,
    by_evidence_state: countBy(items, item => item.evidence_state),
    ingest_contract: 'manifest.items 逐条 path/domain/title/bytes/chars/sha256_16；counts.total=条数',
  }
  const reportsDir = options.reportsDir ?? join(dirname(resolve(options.outDir)), 'reports')
  await writeJson(join(reportsDir, 'classification-report.json'), report)
  await writeText(join(options.outDir, '.gitkeep'), '')
  return { manifest, report, outDir: options.outDir }
}

function main() {
  const args = parseArgs()
  const cleanDir = typeof args.clean === 'string' ? args.clean : ''
  const outDir = typeof args.out === 'string' ? args.out : ''
  const domainsPath = typeof args.domains === 'string' ? args.domains : ''
  if (cleanDir === '' || outDir === '' || domainsPath === '') {
    console.error('用法：node scripts/classify.mjs --clean <cleanDir> --out <candidatesDir> --domains <domains.json> [--name <corpus名>]')
    process.exit(2)
  }
  runClassify({ cleanDir, outDir, domainsPath, name: typeof args.name === 'string' ? args.name : undefined, visibility: args.visibility, reportsDir: args.reports })
    .then(result => {
      const c = result.report.counts
      console.log(`[classify] total=${c.total} by_domain=${JSON.stringify(c.by_domain)} by_subject_domain=${JSON.stringify(c.by_subject_domain)} -> ${result.outDir}`)
    })
    .catch(error => {
      console.error(`[classify] FAILED ${error.code ?? ''} ${error.message}`)
      process.exit(1)
    })
}

if (import.meta.url === `file://${process.argv[1]}`) main()

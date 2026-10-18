/**
 * 离线自测（S1–S9）：不联网、不写外部；产出可复跑的原始输出。
 *
 * 用法：
 *   node scripts/selftest.mjs [--workdir <dir>] [--repo <仓库根>] [--json]
 *   默认 workdir = 系统临时目录新建目录；--repo 缺省从 cwd 向上找仓库根。
 */
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFiles, parseArgs, readJson, writeJson } from './lib.mjs'
import { runPipeline } from './pipeline.mjs'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function findRepoRoot(startDir) {
  let current = resolve(startDir)
  for (let i = 0; i < 8; i += 1) {
    const probe = join(current, 'packages', 'gewu', 'kb-wiki', 'src', 'service.js')
    try {
      await stat(probe)
      return current
    } catch {
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  return null
}

function createRunner() {
  const results = []
  return {
    results,
    check(id, name, ok, detail) {
      results.push({ id, name, status: ok ? 'PASS' : 'FAIL', detail })
      console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'} · ${name}${detail === undefined ? '' : ` · ${detail}`}`)
      return ok
    },
    skip(id, name, detail) {
      results.push({ id, name, status: 'SKIP', detail })
      console.log(`[${id}] SKIP · ${name}${detail === undefined ? '' : ` · ${detail}`}`)
    },
  }
}

async function testS1(runner) {
  const tracePath = join(SKILL_DIR, 'references', 'retrieval-trace.md')
  let text = ''
  try {
    text = await readFile(tracePath, 'utf8')
  } catch {
    return runner.check('S1', 'W-21 检索留痕文件存在', false, 'references/retrieval-trace.md 缺失')
  }
  const linkPattern = new RegExp('https://github\\.com/[^\\s)]+', 'g')
  const links = [...text.matchAll(linkPattern)].map(match => match[0])
  const licenses = ['MIT', 'Apache-2.0', 'AGPL-3.0'].filter(token => text.includes(token))
  const hasConclusion = /选型结论/.test(text)
  const ok = links.length >= 3 && licenses.length >= 2 && hasConclusion
  return runner.check('S1', 'W-21 留痕三要素（检索词/命中项/选型结论）', ok,
    `links=${links.length} licenses=${licenses.join(',')} 选型结论=${hasConclusion}`)
}

async function testS2(runner, paths) {
  const records = await Promise.all((await listFiles(join(paths.raw, 'sources'), { exts: ['.json'] })).map(readJson))
  const report = await readJson(join(paths.raw, 'collect-report.json'))
  const allHaveOrigin = records.length > 0 && records.every(record => typeof record.url === 'string' && record.url !== '' && typeof record.fetched_at === 'string' && record.fetched_at !== '')
  const getOnly = records.every(record => String(record.method).toUpperCase() === 'GET')
  return runner.check('S2', '采集可用（每条带来源 URL + 抓取时间）', allHaveOrigin && getOnly && report.external_writes === 0,
    `sources=${records.length} url+fetched_at=${allHaveOrigin} methods=${JSON.stringify(report.methods)} external_writes=${report.external_writes}`)
}

async function testS3(runner, paths) {
  const report = await readJson(join(paths.verified, 'verify-report.json'))
  const totals = report.claim_totals
  const threeStates = totals.supported > 0 && totals.contested > 0 && totals.unsupported > 0
  const index = await readJson(join(paths.clean, 'index.json'))
  const cleanText = index.entries.map(entry => `${entry.title}\n${entry.body}`).join('\n')
  const verified = await Promise.all((await listFiles(join(paths.verified, 'sources'), { exts: ['.json'] })).map(readJson))
  const unsupported = verified.flatMap(record => (record.claims ?? []).filter(claim => claim.state === '无依据').map(claim => claim.text))
  const leaked = unsupported.filter(text => cleanText.includes(text))
  return runner.check('S3', '纠偏三态（无依据不进候选）', threeStates && leaked.length === 0,
    `有依据=${totals.supported} 存疑=${totals.contested} 无依据=${totals.unsupported} 无依据泄漏进候选=${leaked.length}`)
}

async function testS4(runner, paths) {
  const report = await readJson(join(paths.clean, 'clean-report.json'))
  const files = await listFiles(join(paths.clean, 'entries'), { exts: ['.md'] })
  let noFrontmatter = true
  let oneQuestion = true
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    if (/^\uFEFF?---/.test(text)) noFrontmatter = false
    const questions = (text.match(/[？?]/g) ?? []).length
    if (questions > 1) oneQuestion = false
  }
  const ok = report.exact_dup_dropped >= 1 && report.near_dup_dropped >= 1 && report.frontmatter_stripped >= 1
    && report.wordlist_hits === 0 && report.one_question_per_entry === true && noFrontmatter && oneQuestion && files.length > 0
  return runner.check('S4', '清洗合规（去重/无元信息头/一问一条/词表零命中）', ok,
    `exact_dup=${report.exact_dup_dropped} near_dup=${report.near_dup_dropped} 元信息头剥离=${report.frontmatter_stripped} 词表命中=${report.wordlist_hits} 一问一条=${report.one_question_per_entry} 输出以---开头=${!noFrontmatter}`)
}

async function testS5(runner, paths) {
  const manifest = await readJson(join(paths.candidates, 'manifest.json'))
  const files = await listFiles(paths.candidates, { exts: ['.md'] })
  const byType = {}
  for (const item of manifest.items) byType[item.domain] = (byType[item.domain] ?? 0) + 1
  const threeTypes = ['concepts', 'entities', 'faq'].every(type => (byType[type] ?? 0) > 0)
  const fieldsOk = manifest.items.every(item => item.domain && item.subject_domain && item.path && item.sha256_16)
  const countsOk = manifest.counts.total === manifest.items.length && manifest.items.length === files.length
  const distOk = Object.keys(manifest.counts.by_subject_domain).length >= 2
  return runner.check('S5', '分类正确（三类归位 + domain + 分布统计）', threeTypes && fieldsOk && countsOk && distOk,
    `total=${manifest.counts.total} files=${files.length} by_domain=${JSON.stringify(manifest.counts.by_domain)} by_subject_domain=${JSON.stringify(manifest.counts.by_subject_domain)}`)
}

async function testS6(runner, paths, repoRoot) {
  if (repoRoot === null) return runner.skip('S6', '隔离 kb_ingest 实测', '找不到仓库根（--repo 指定）')
  const servicePath = join(repoRoot, 'packages', 'gewu', 'kb-wiki', 'src', 'service.js')
  const { createKbService } = await import(`file://${servicePath}`)
  const v2 = join(repoRoot, '_ops', 'pilot-kb', 'v2')
  const platform = join(repoRoot, '_ops', 'pilot-kb', 'platform')
  const before = await createKbService({ corpusDir: v2, extraCorpusDirs: [platform] }).stats()
  const after = await createKbService({ corpusDir: v2, extraCorpusDirs: [platform, paths.candidates] }).stats()
  const manifest = await readJson(join(paths.candidates, 'manifest.json'))
  const delta = after.document_count - before.document_count
  // 再跑一次重建，验证幂等：同目录重复 ingest 不增条。
  const rebuilt = await createKbService({ corpusDir: v2, extraCorpusDirs: [platform, paths.candidates] }).ingest(true)
  const ok = delta === manifest.counts.total && rebuilt.document_count === after.document_count
  return runner.check('S6', '可入库（隔离环境 kb_ingest 直接吃下，kb_stats +N）', ok,
    `base=${before.document_count} with_candidates=${after.document_count} delta=${delta} manifest.total=${manifest.counts.total} 重建后=${rebuilt.document_count}`)
}

async function testS7(runner, paths, skillDir) {
  const manifestA = await readJson(join(paths.candidates, 'manifest.json'))
  const filesA = (await listFiles(paths.candidates, { exts: ['.md'] })).map(file => file.replace(skillDir, ''))
  await runPipeline({
    workdir: paths.workdir, topicsPath: join(skillDir, 'test/fixtures/topics.json'),
    authorityPath: join(skillDir, 'test/fixtures/authority/authority.json'),
    domainsPath: join(skillDir, 'references/domains.example.json'), fixturesDir: join(skillDir, 'test/fixtures/raw'),
    name: manifestA.name,
  })
  const manifestB = await readJson(join(paths.candidates, 'manifest.json'))
  const filesB = (await listFiles(paths.candidates, { exts: ['.md'] })).map(file => file.replace(skillDir, ''))
  const itemsEqual = JSON.stringify(manifestA.items) === JSON.stringify(manifestB.items)
  const filesEqual = JSON.stringify(filesA) === JSON.stringify(filesB)
  const unique = new Set(manifestB.items.map(item => item.path)).size === manifestB.items.length
  return runner.check('S7', '幂等/可复跑（同主题重跑不产生重复条目）', itemsEqual && filesEqual && unique,
    `items一致=${itemsEqual} 文件集一致=${filesEqual} 路径唯一=${unique} total=${manifestB.counts.total}->${manifestB.counts.total}`)
}

async function testS8(runner, skillDir, repoRoot) {
  const raw = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
  const { parseFrontmatter, SKILL_ID_RE } = repoRoot === null
    ? { parseFrontmatter: null, SKILL_ID_RE: /^[a-z][a-z0-9-]{0,63}$/ }
    : await import(`平台技能注册表`)
  const data = parseFrontmatter === null
    ? null
    : parseFrontmatter(raw).data
  const versionFile = (await readFile(join(skillDir, 'VERSION'), 'utf8')).trim()
  const required = ['name', 'version', 'summary', 'min_scope', 'tags', 'complexity']
  const missing = data === null ? required : required.filter(key => data[key] === undefined || data[key] === '')
  const nameOk = data !== null && SKILL_ID_RE.test(data.name) && data.name === 'kb-corpus-pipeline'
  const versionOk = data !== null && data.version === versionFile
  const summary = String(data?.summary ?? '')
  const summaryOk = summary !== '' && [...summary].length <= 60
  let catalogOk = false
  let catalogDetail = ''
  if (repoRoot !== null) {
    const { listSkillCatalog } = await import(`平台技能注册表`)
    const catalog = await listSkillCatalog({ skillsDir: dirname(skillDir) })
    catalogOk = catalog.skills.some(skill => skill.skill_id === 'kb-corpus-pipeline')
    catalogDetail = `skill_list 可见=${catalogOk} 目录=${catalog.dir}`
  }
  const ok = missing.length === 0 && nameOk && versionOk && summaryOk && catalogOk
  return runner.check('S8', '技能规范（frontmatter/复杂度/skill_list 可见）', ok,
    `缺失字段=${missing.join(',') || '无'} name=${nameOk} version=${versionOk}（${data?.version}==VERSION ${versionFile}） summary≤60=${summaryOk} ${catalogDetail}`)
}

async function testS9(runner, paths) {
  const report = await readJson(join(paths.raw, 'collect-report.json'))
  const stageFiles = ['collect.mjs', 'verify.mjs', 'clean.mjs', 'classify.mjs', 'pipeline.mjs']
  let writeVerbs = 0
  for (const name of stageFiles) {
    const source = await readFile(join(SKILL_DIR, 'scripts', name), 'utf8')
    writeVerbs += (source.match(/'POST'|'PUT'|'PATCH'|'DELETE'|"POST"|"PUT"|"PATCH"|"DELETE"/g) ?? []).length
  }
  const methods = Object.keys(report.methods)
  const ok = report.external_writes === 0 && methods.length === 1 && methods[0] === 'GET' && writeVerbs === 0
  return runner.check('S9', '不越界（只读 GET，未向任何外部平台发布/留言）', ok,
    `external_writes=${report.external_writes} methods=${JSON.stringify(methods)} 阶段源码写方法出现=${writeVerbs} 次`)
}

async function main() {
  const args = parseArgs()
  const skillDir = SKILL_DIR
  const repoRoot = typeof args.repo === 'string' ? resolve(args.repo) : await findRepoRoot(process.cwd())
  const workdir = typeof args.workdir === 'string' ? resolve(args.workdir) : await mkdtemp(join(tmpdir(), 'kb-corpus-pipeline-selftest-'))
  await mkdir(workdir, { recursive: true })
  const paths = {
    workdir,
    raw: join(workdir, 'raw'),
    verified: join(workdir, 'verified'),
    clean: join(workdir, 'clean'),
    candidates: join(workdir, 'candidates'),
    reports: join(workdir, 'reports'),
  }
  const runner = createRunner()
  console.log(`# kb-corpus-pipeline 自测 · workdir=${workdir} repo=${repoRoot ?? '未找到'}`)

  await testS1(runner)
  await runPipeline({
    workdir, topicsPath: join(skillDir, 'test/fixtures/topics.json'),
    authorityPath: join(skillDir, 'test/fixtures/authority/authority.json'),
    domainsPath: join(skillDir, 'references/domains.example.json'),
    fixturesDir: join(skillDir, 'test/fixtures/raw'), name: 'selftest-corpus',
  })
  await testS2(runner, paths)
  await testS3(runner, paths)
  await testS4(runner, paths)
  await testS5(runner, paths)
  await testS6(runner, paths, repoRoot)
  await testS7(runner, paths, skillDir)
  await testS8(runner, skillDir, repoRoot)
  await testS9(runner, paths)

  const failed = runner.results.filter(item => item.status === 'FAIL')
  const passed = runner.results.filter(item => item.status === 'PASS')
  const skipped = runner.results.filter(item => item.status === 'SKIP')
  const summary = { total: runner.results.length, pass: passed.length, fail: failed.length, skip: skipped.length, results: runner.results }
  console.log(`# 汇总 PASS=${passed.length} FAIL=${failed.length} SKIP=${skipped.length}`)
  await writeJson(join(workdir, 'selftest-report.json'), summary)
  if (args.json === true) console.log(JSON.stringify(summary))
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch(error => {
  console.error(`[selftest] FAILED ${error.stack ?? error.message}`)
  process.exit(1)
})

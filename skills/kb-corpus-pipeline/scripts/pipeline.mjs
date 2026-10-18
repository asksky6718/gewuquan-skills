/**
 * 语料流水线编排：采集 → 纠偏 → 清洗 → 分类，一键产出候选条目包。
 *
 * 用法：
 *   node scripts/pipeline.mjs --workdir <dir> --topics <topics.json> \
 *     --authority <authority.json> --domains <domains.json> [--fixtures <dir>] [--name <corpus名>]
 *
 * 落点（全在 `<workdir>` 内，不写外部）：
 *   raw/        第 1 段原始素材（每条带 url + fetched_at）
 *   verified/   第 2 段三态标注
 *   clean/      第 3 段清洗后条目（无 YAML 头 / 一问一条 / 词表零命中）
 *   candidates/ 第 4 段候选包（concepts/entities/faq + manifest.json，可被 kb_ingest 直接吃下）
 *   reports/    各段报告与总报告
 */
import { join, resolve } from 'node:path'
import { parseArgs, nowIso, writeJson } from './lib.mjs'
import { runCollect } from './collect.mjs'
import { runVerify } from './verify.mjs'
import { runClean } from './clean.mjs'
import { runClassify } from './classify.mjs'

/**
 * @param {{workdir:string, topicsPath:string, authorityPath:string, domainsPath:string,
 *   fixturesDir?:string, name?:string, visibility?:string, nearDup?:number}} options
 */
export async function runPipeline(options) {
  const workdir = resolve(options.workdir)
  const paths = {
    raw: join(workdir, 'raw'),
    verified: join(workdir, 'verified'),
    clean: join(workdir, 'clean'),
    candidates: join(workdir, 'candidates'),
    reports: join(workdir, 'reports'),
  }
  const startedAt = nowIso()
  const collect = await runCollect({ topicsPath: options.topicsPath, outDir: paths.raw, fixturesDir: options.fixturesDir })
  const verify = await runVerify({ rawDir: paths.raw, authorityPath: options.authorityPath, outDir: paths.verified })
  const clean = await runClean({ verifiedDir: paths.verified, outDir: paths.clean, nearDup: options.nearDup })
  const classify = await runClassify({
    cleanDir: paths.clean, outDir: paths.candidates, domainsPath: options.domainsPath,
    name: options.name, visibility: options.visibility, reportsDir: paths.reports,
  })
  const report = {
    schema: 'kb-corpus-pipeline.report.v1',
    started_at: startedAt,
    finished_at: nowIso(),
    workdir,
    mode: collect.report.mode,
    external_writes: 0,
    stages: {
      collect: { sources: collect.report.source_count, errors: collect.report.errors.length },
      verify: { ...verify.report.claim_totals, in_candidates: verify.report.in_candidates, excluded: verify.report.excluded_unsupported },
      clean: {
        entries: clean.report.entries_written,
        exact_dup_dropped: clean.report.exact_dup_dropped,
        near_dup_dropped: clean.report.near_dup_dropped,
        wordlist_hits: clean.report.wordlist_hits,
        one_question_per_entry: clean.report.one_question_per_entry,
      },
      classify: { files: classify.report.files_written, counts: classify.report.counts },
    },
    candidates_manifest: join(paths.candidates, 'manifest.json'),
  }
  await writeJson(join(paths.reports, 'pipeline-report.json'), report)
  return { report, paths, collect, verify, clean, classify }
}

function main() {
  const args = parseArgs()
  const workdir = typeof args.workdir === 'string' ? args.workdir : ''
  const topicsPath = typeof args.topics === 'string' ? args.topics : ''
  const authorityPath = typeof args.authority === 'string' ? args.authority : ''
  const domainsPath = typeof args.domains === 'string' ? args.domains : ''
  if (workdir === '' || topicsPath === '' || authorityPath === '' || domainsPath === '') {
    console.error('用法：node scripts/pipeline.mjs --workdir <dir> --topics <topics.json> --authority <authority.json> --domains <domains.json> [--fixtures <dir>] [--name <corpus名>]')
    process.exit(2)
  }
  runPipeline({
    workdir, topicsPath, authorityPath, domainsPath,
    fixturesDir: typeof args.fixtures === 'string' ? args.fixtures : undefined,
    name: typeof args.name === 'string' ? args.name : undefined,
    visibility: typeof args.visibility === 'string' ? args.visibility : undefined,
    nearDup: args['near-dup'],
  })
    .then(result => {
      const { stages } = result.report
      console.log(`[pipeline] mode=${result.report.mode} 素材=${stages.collect.sources} 有依据=${stages.verify.supported} 存疑=${stages.verify.contested} 无依据=${stages.verify.unsupported} 条目=${stages.clean.entries} 候选=${stages.classify.counts.total} external_writes=0`)
      console.log(`[pipeline] 候选包 -> ${result.paths.candidates}`)
    })
    .catch(error => {
      console.error(`[pipeline] FAILED ${error.code ?? ''} ${error.message}`)
      process.exit(error.code === 'internal_wordlist_hit' ? 3 : 1)
    })
}

if (import.meta.url === `file://${process.argv[1]}`) main()

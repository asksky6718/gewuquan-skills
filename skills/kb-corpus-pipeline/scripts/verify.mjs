/**
 * 第 2 段 · 纠偏：与权威源比对，标出存疑项；不得编造，查不到就写「无依据」。
 *
 * 三态判定（可机械复算）：
 *   有依据  = 来源在权威域名白名单 且 与权威参考文本的重合度 ≥ --support
 *   存疑    = 来源在权威白名单但重合度落在 [--contested, --support) ，
 *             或来源不在白名单但重合度 ≥ --support
 *   无依据  = 其余（**不进候选**）
 *
 * 用法：
 *   node scripts/verify.mjs --raw <rawDir> --authority <authority.json> --out <verifiedDir>
 */
import { dirname, join, resolve } from 'node:path'
import {
  SCHEMA, bigrams, containment, listFiles, nowIso, parseArgs, readJson, readText,
  splitSentences, stripYamlFrontmatter, writeJson,
} from './lib.mjs'

export const STATES = Object.freeze({ supported: '有依据', contested: '存疑', unsupported: '无依据' })

function domainAllowed(host, allowlist) {
  const target = String(host ?? '').toLowerCase()
  if (target === '') return false
  return allowlist.some(domain => {
    const suffix = String(domain ?? '').toLowerCase().replace(/^\./, '')
    return suffix !== '' && (target === suffix || target.endsWith(`.${suffix}`))
  })
}

/** 权威参考文本 → 比对单元（整段 + 逐句）。 */
function buildReferenceUnits(references) {  const units = []
  for (const reference of references) {
    const sentences = splitSentences(reference.text)
    const whole = reference.text.trim()
    if (whole !== '') units.push({ ref_id: reference.id, kind: 'doc', text: whole, grams: bigrams(whole) })
    for (const sentence of sentences) {
      units.push({ ref_id: reference.id, kind: 'sentence', text: sentence, grams: bigrams(sentence) })
    }
  }
  return units
}

function bestMatch(claim, units) {
  const grams = bigrams(claim)
  let best = { ref_id: null, kind: null, text: '', score: 0 }
  for (const unit of units) {
    const score = containment(grams, unit.grams)
    if (score > best.score) best = { ref_id: unit.ref_id, kind: unit.kind, text: unit.text, score }
  }
  return { ...best, score: Number(best.score.toFixed(4)) }
}

const Q_PREFIX = /^[ \t]*(?:Q|问|问题)[ \t]*\d*[ \t]*[:：.、)]?[ \t]*/i
const A_PREFIX = /^[ \t]*(?:A|答|答案)[ \t]*\d*[ \t]*[:：.、)]?[ \t]*/i

/**
 * 把原文切成「问答段」：问句挂到紧随其后的答句上，只对**答句**做纠偏比对
 * （问句是检索入口，不是可核事实，不能因权威源无问句就判「无依据」）。
 * 无问答结构的陈述句按 `{question:'', text:句}` 返回。
 */
export function parseQaSegments(rawText) {
  const body = stripYamlFrontmatter(rawText).text
  const segments = []
  let pending = null
  for (const raw of splitSentences(body)) {
    let sentence = raw.replace(Q_PREFIX, '').replace(A_PREFIX, '').trim()
    if (sentence === '') continue
    const isQuestion = /[？?]\s*$/.test(sentence)
    if (isQuestion) {
      pending = sentence
      continue
    }
    if (pending !== null) {
      segments.push({ question: pending, text: sentence })
      pending = null
    } else {
      segments.push({ question: '', text: sentence })
    }
  }
  return segments
}

export function classifyClaim({ allowlisted, score, support, contested }) {
  if (allowlisted && score >= support) return STATES.supported
  if (allowlisted && score >= contested) return STATES.contested
  if (!allowlisted && score >= support) return STATES.contested
  return STATES.unsupported
}

/**
 * @param {{rawDir:string, authorityPath:string, outDir:string, support?:number, contested?:number, minClaimLength?:number}} options
 */
export async function runVerify(options) {
  const support = Number(options.support ?? 0.6)
  const contested = Number(options.contested ?? 0.25)
  const minClaimLength = Number(options.minClaimLength ?? 8)
  const authority = await readJson(options.authorityPath)
  const allowlist = Array.isArray(authority.allowlist_domains) ? authority.allowlist_domains : []
  const authorityDir = dirname(resolve(options.authorityPath))
  const references = []
  for (const reference of Array.isArray(authority.references) ? authority.references : []) {
    const rel = String(reference.path ?? '')
    if (rel === '') continue
    const raw = await readText(resolve(authorityDir, rel))
    references.push({ id: String(reference.id ?? rel), title: String(reference.title ?? ''), text: stripYamlFrontmatter(raw).text })
  }
  if (references.length === 0) {
    throw Object.assign(new Error('权威源 references 为空：纠偏无法进行（不猜、不编造）'), { code: 'no_authority' })
  }
  const units = buildReferenceUnits(references)

  const sourceFiles = await listFiles(join(options.rawDir, 'sources'), { exts: ['.json'] })
  const verified = []
  const totals = { supported: 0, contested: 0, unsupported: 0 }
  for (const file of sourceFiles) {
    const source = await readJson(file)
    const allowlisted = domainAllowed(source.source_domain, allowlist)
    const body = stripYamlFrontmatter(source.text)
    const claims = []
    for (const segment of parseQaSegments(body.text)) {
      if (segment.text.length < minClaimLength) continue
      const match = bestMatch(segment.text, units)
      const state = classifyClaim({ allowlisted, score: match.score, support, contested })
      totals[state === STATES.supported ? 'supported' : state === STATES.contested ? 'contested' : 'unsupported'] += 1
      claims.push({
        text: segment.text,
        question: segment.question,
        state,
        best_ref: match.ref_id,
        best_ref_kind: match.kind,
        score: match.score,
      })
    }
    const record = {
      schema: SCHEMA.verified,
      source_id: source.source_id,
      url: source.url,
      source_domain: source.source_domain,
      allowlisted,
      topic_id: source.topic_id,
      topic: source.topic,
      fetched_at: source.fetched_at,
      title: source.title,
      frontmatter_stripped: body.stripped,
      claims,
    }
    verified.push(record)
    await writeJson(join(options.outDir, 'sources', `${source.source_id}.json`), record)
  }

  const report = {
    schema: `${SCHEMA.verified}.report`,
    stage: 'verify',
    generated_at: nowIso(),
    authority_path: resolve(options.authorityPath),
    reference_count: references.length,
    allowlist_domains: allowlist,
    thresholds: { support, contested, min_claim_length: minClaimLength },
    source_count: verified.length,
    frontmatter_stripped_sources: verified.filter(record => record.frontmatter_stripped === true).length,
    claim_totals: totals,
    in_candidates: totals.supported + totals.contested,
    excluded_unsupported: totals.unsupported,
  }
  await writeJson(join(options.outDir, 'verify-report.json'), report)
  return { verified, report, outDir: options.outDir }
}

function main() {
  const args = parseArgs()
  const rawDir = typeof args.raw === 'string' ? args.raw : ''
  const authorityPath = typeof args.authority === 'string' ? args.authority : ''
  const outDir = typeof args.out === 'string' ? args.out : ''
  if (rawDir === '' || authorityPath === '' || outDir === '') {
    console.error('用法：node scripts/verify.mjs --raw <rawDir> --authority <authority.json> --out <verifiedDir>')
    process.exit(2)
  }
  runVerify({ rawDir, authorityPath, outDir, support: args.support, contested: args.contested, minClaimLength: args['min-claim'] })
    .then(result => {
      const t = result.report.claim_totals
      console.log(`[verify] 有依据=${t.supported} 存疑=${t.contested} 无依据=${t.unsupported}（无依据不进候选） -> ${result.outDir}`)
    })
    .catch(error => {
      console.error(`[verify] FAILED ${error.code ?? ''} ${error.message}`)
      process.exit(1)
    })
}

if (import.meta.url === `file://${process.argv[1]}`) main()

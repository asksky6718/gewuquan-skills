/**
 * 第 3 段 · 清洗：去重 · 去 YAML 元信息头 · 一问一条 · 脱敏（内部词表零命中）。
 *
 * 硬门：内部词表命中 ≠ 0 ⇒ **整批拒绝**（不落候选，退出码 3）。
 *
 * 用法：
 *   node scripts/clean.mjs --verified <verifiedDir> --out <cleanDir> [--wordlist <file>] [--near-dup 0.9]
 */
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import {
  SCHEMA, bigrams, containment, countBy, listFiles, normalizeText, nowIso, parseArgs, readJson,
  sha256_16, slugify, stripYamlFrontmatter, writeJson, writeText,
} from './lib.mjs'
import { buildWordlist, scanText } from './wordlist.mjs'

const Q_MARKER = /(?:^|\n)[ \t]*(?:Q|问|问题)[ \t]*\d*[ \t]*[:：.、)]?[ \t]*/g
const HEADING = /^[ \t]*#{1,6}[ \t]*(.+?)[ \t]*$/m

function countQuestions(text) {
  const matches = String(text ?? '').match(/[？?]/g)
  return matches === null ? 0 : matches.length
}

/** 一问一条：把一段候选文本拆成若干「一问一答」条目。 */
export function explodeEntries(text) {
  const body = stripYamlFrontmatter(text).text.trim()
  if (body === '') return []
  const heading = HEADING.exec(body)?.[1]?.trim() ?? ''
  const payload = heading === '' ? body : body.replace(HEADING, '').trim()
  const markerCount = (payload.match(Q_MARKER) ?? []).length
  const chunks = []
  if (markerCount >= 2) {
    const parts = payload.split(Q_MARKER).map(part => part.trim()).filter(part => part !== '')
    for (const part of parts) {
      const lines = part.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '')
      chunks.push({ question: lines[0] ?? '', answer: lines.slice(1).join('\n') || lines[0] || '' })
    }
  } else if (countQuestions(payload) >= 2) {
    let current = null
    for (const sentence of payload.split(/(?<=[？?])\s*|\r?\n+/).map(item => item.trim()).filter(Boolean)) {
      if (/[？?]$/.test(sentence)) {
        if (current !== null) chunks.push(current)
        current = { question: sentence, answer: sentence }
      } else if (current !== null) {
        current.answer = `${current.answer}\n${sentence}`
      } else {
        current = { question: '', answer: sentence }
      }
    }
    if (current !== null) chunks.push(current)
  } else {
    const first = payload.split(/\r?\n/)[0] ?? payload
    chunks.push({ question: /[？?]/.test(first) ? first : '', answer: payload })
  }

  const entries = []
  for (const chunk of chunks) {
    const title = heading !== '' ? heading : (chunk.question !== '' ? chunk.question : chunk.answer.slice(0, 40))
    const merged = chunk.question !== '' && chunk.question !== chunk.answer
      ? `${chunk.question}\n${chunk.answer}`
      : chunk.answer
    entries.push({ title: title.trim(), body: merged.trim() })
  }
  return entries.filter(entry => entry.body !== '')
}

/**
 * @param {{verifiedDir:string, outDir:string, wordlistPath?:string, nearDup?:number}} options
 */
export async function runClean(options) {
  const nearDup = Number(options.nearDup ?? 0.9)
  const patterns = await buildWordlist({ wordlistPath: options.wordlistPath })
  const sourceFiles = await listFiles(join(options.verifiedDir, 'sources'), { exts: ['.json'] })

  const candidates = []
  let frontmatterStripped = 0
  for (const file of sourceFiles) {
    const record = await readJson(file)
    if (record.frontmatter_stripped === true) frontmatterStripped += 1
    for (const claim of Array.isArray(record.claims) ? record.claims : []) {
      if (claim.state === '无依据') continue // 硬门：无依据不进候选
      const question = typeof claim.question === 'string' ? claim.question.trim() : ''
      const pieces = question === '' ? explodeEntries(claim.text) : [{ title: question, body: claim.text }]
      for (const entry of pieces) {
        // 再次去除可能的元信息头（幂等），并记录。
        const stripped = stripYamlFrontmatter(entry.body)
        if (stripped.stripped) frontmatterStripped += 1
        candidates.push({
          title: entry.title.replace(/^---.*$/g, '').trim() || '未命名条目',
          body: stripped.text.trim(),
          evidence_state: claim.state,
          best_ref: claim.best_ref,
          score: claim.score,
          source_id: record.source_id,
          url: record.url,
          fetched_at: record.fetched_at,
        })
      }
    }
  }

  // 去重：有依据优先；再按文本长度降序（长句信息更全），保证可复跑同序。
  const priority = { 有依据: 0, 存疑: 1 }
  candidates.sort((a, b) => (priority[a.evidence_state] - priority[b.evidence_state]) || (b.body.length - a.body.length) || a.body.localeCompare(b.body))

  const seenExact = new Set()
  const kept = []
  let exactDup = 0
  let nearDupDropped = 0
  for (const candidate of candidates) {
    const normalized = normalizeText(`${candidate.title}\n${candidate.body}`)
    if (normalized === '') continue
    const exactKey = sha256_16(normalized)
    if (seenExact.has(exactKey)) {
      exactDup += 1
      continue
    }
    seenExact.add(exactKey)
    const grams = bigrams(candidate.body)
    const near = kept.find(item => containment(grams, item.grams) >= nearDup)
    if (near !== undefined) {
      nearDupDropped += 1
      continue
    }
    kept.push({ ...candidate, grams, hash: sha256_16(candidate.body) })
  }

  // 脱敏硬门：内部词表零命中。
  const hits = []
  for (const entry of kept) {
    for (const hit of scanText(`${entry.title}\n${entry.body}`, patterns)) {
      hits.push({ entry: entry.title, ...hit })
    }
  }
  if (hits.length > 0) {
    await writeJson(join(options.outDir, 'clean-report.json'), {
      schema: `${SCHEMA.clean}.report`,
      stage: 'clean',
      generated_at: nowIso(),
      ok: false,
      code: 'internal_wordlist_hit',
      wordlist_size: patterns.length,
      wordlist_hits: hits,
      entries_written: 0,
    })
    throw Object.assign(new Error(`内部词表命中 ${hits.length} 处（硬门零容忍）`), { code: 'internal_wordlist_hit', hits })
  }

  const entries = []
  let seq = 0
  // 复跑幂等：只清本段自己的 entries 目录（包级隔离）。
  await rm(join(options.outDir, 'entries'), { recursive: true, force: true })
  for (const entry of kept) {
    seq += 1
    const id = String(seq).padStart(3, '0')
    const file = `${id}-${slugify(entry.title, entry.hash)}.md`
    const body = entry.body.replace(/^\s*---[\s\S]*?---\s*/,'').trim()
    const content = `# ${entry.title}\n\n${body}\n`
    await writeText(join(options.outDir, 'entries', file), content)
    entries.push({
      id,
      path: `entries/${file}`,
      title: entry.title,
      body,
      evidence_state: entry.evidence_state,
      best_ref: entry.best_ref,
      score: entry.score,
      source_id: entry.source_id,
      url: entry.url,
      fetched_at: entry.fetched_at,
      sha256_16: sha256_16(content),
      bytes: Buffer.byteLength(content, 'utf8'),
    })
  }

  const report = {
    schema: `${SCHEMA.clean}.report`,
    stage: 'clean',
    generated_at: nowIso(),
    ok: true,
    options: { near_dup: nearDup, wordlist_path: options.wordlistPath ?? null },
    input_claims: candidates.length + exactDup + nearDupDropped,
    exact_dup_dropped: exactDup,
    near_dup_dropped: nearDupDropped,
    frontmatter_stripped: frontmatterStripped,
    wordlist_size: patterns.length,
    wordlist_hits: 0,
    one_question_per_entry: entries.every(entry => countQuestions(entry.body) <= 1),
    entries_written: entries.length,
    by_evidence_state: countBy(entries, entry => entry.evidence_state),
  }
  await writeJson(join(options.outDir, 'index.json'), { schema: SCHEMA.clean, generated_at: report.generated_at, entries })
  await writeJson(join(options.outDir, 'clean-report.json'), report)
  return { entries, report, outDir: options.outDir }
}

function main() {
  const args = parseArgs()
  const verifiedDir = typeof args.verified === 'string' ? args.verified : ''
  const outDir = typeof args.out === 'string' ? args.out : ''
  if (verifiedDir === '' || outDir === '') {
    console.error('用法：node scripts/clean.mjs --verified <verifiedDir> --out <cleanDir> [--wordlist <file>] [--near-dup 0.9]')
    process.exit(2)
  }
  runClean({ verifiedDir, outDir, wordlistPath: args.wordlist, nearDup: args['near-dup'] })
    .then(result => {
      const r = result.report
      console.log(`[clean] entries=${r.entries_written} exact_dup=${r.exact_dup_dropped} near_dup=${r.near_dup_dropped} 元信息头剥离=${r.frontmatter_stripped} 词表命中=${r.wordlist_hits} 一问一条=${r.one_question_per_entry} -> ${result.outDir}`)
    })
    .catch(error => {
      console.error(`[clean] FAILED ${error.code ?? ''} ${error.message}`)
      process.exit(error.code === 'internal_wordlist_hit' ? 3 : 1)
    })
}

if (import.meta.url === `file://${process.argv[1]}`) main()

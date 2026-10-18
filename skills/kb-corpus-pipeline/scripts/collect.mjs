/**
 * 第 1 段 · 采集：给定行业/主题，从公开来源抓取原始素材。
 *
 * 纪律（任务单 §二.5、判据 S9）：只读外部——只发 HTTP GET，绝不 POST/PUT/PATCH/DELETE，
 * 不留言、不注册、不发布；每条素材保留 `url` 与 `fetched_at`（抓取时间）。
 *
 * 用法：
 *   node scripts/collect.mjs --topics <topics.json> --out <rawDir>
 *   node scripts/collect.mjs --topics <topics.json> --out <rawDir> --fixtures <dir>   # 离线（自测/复跑）
 */
import { join } from 'node:path'
import {
  SCHEMA, listFiles, nowIso, parseArgs, readJson, sha256_16, writeJson, writeText, today,
} from './lib.mjs'

const DEFAULT_UA = 'gewu-kb-corpus-pipeline/1.0 (+read-only collector)'

/** HTML → 纯文本（去脚本/样式/标签，保留段落换行）。 */
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function assertReadOnlyUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw Object.assign(new Error(`非法 URL：${url}`), { code: 'invalid_url' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error(`只允许 http/https：${url}`), { code: 'invalid_url' })
  }
}

/** 校验 fixture / 抓取记录：方法必须是 GET（反证「未向外部写」）。 */
function assertGetOnly(record, origin) {
  const method = String(record.method ?? record.http_method ?? 'GET').toUpperCase()
  if (method !== 'GET') {
    throw Object.assign(new Error(`${origin} 声明了非 GET 方法：${method}`), { code: 'non_get_method' })
  }
  if (record.external_writes !== undefined && Number(record.external_writes) !== 0) {
    throw Object.assign(new Error(`${origin} external_writes ≠ 0`), { code: 'external_write_detected' })
  }
}

/** 网络抓取单个 URL（只读 GET）。 */
async function fetchOne(url, options) {
  assertReadOnlyUrl(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': options.userAgent, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
    })
    const buffer = Buffer.from(await response.arrayBuffer())
    const clipped = buffer.subarray(0, options.maxBytes)
    const contentType = String(response.headers.get('content-type') ?? '')
    const bodyText = clipped.toString('utf8')
    const text = contentType.includes('html') ? htmlToText(bodyText) : bodyText.trim()
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(bodyText)
    return {
      http_status: response.status,
      content_type: contentType,
      title: (titleMatch?.[1] ?? '').trim() || hostOf(url),
      text,
      bytes: clipped.byteLength,
      truncated: buffer.byteLength > clipped.byteLength,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{topicsPath:string, outDir:string, fixturesDir?:string, timeoutMs?:number, maxBytes?:number, userAgent?:string}} options
 */
export async function runCollect(options) {
  const topics = await readJson(options.topicsPath)
  const topicsList = Array.isArray(topics.topics) ? topics.topics : []
  if (topicsList.length === 0) {
    throw Object.assign(new Error('topics.json 里 topics 为空'), { code: 'empty_topics' })
  }
  const timeoutMs = Number(options.timeoutMs ?? 15000)
  const maxBytes = Number(options.maxBytes ?? 2_000_000)
  const userAgent = options.userAgent ?? DEFAULT_UA
  const mode = options.fixturesDir ? 'fixtures' : 'network'
  const records = []
  const errors = []

  if (mode === 'fixtures') {
    const fixtureFiles = await listFiles(options.fixturesDir, { exts: ['.json'] })
    for (const file of fixtureFiles) {
      const fixture = await readJson(file)
      assertGetOnly(fixture, file)
      const url = String(fixture.url ?? '')
      const sourceId = String(fixture.source_id ?? '').replace(/\.json$/i, '')
      records.push({
        schema: SCHEMA.raw,
        source_id: sourceId === '' ? `src-${sha256_16(file)}` : sourceId,
        topic_id: String(fixture.topic_id ?? ''),
        topic: String(fixture.topic ?? ''),
        url,
        source_domain: hostOf(url),
        fetched_at: String(fixture.fetched_at ?? nowIso()),
        method: 'GET',
        http_status: Number(fixture.http_status ?? 200),
        content_type: String(fixture.content_type ?? 'text/html'),
        title: String(fixture.title ?? ''),
        text: String(fixture.text ?? ''),
        sha256_16: sha256_16(String(fixture.text ?? '')),
        bytes: Buffer.byteLength(String(fixture.text ?? ''), 'utf8'),
        from_fixture: true,
      })
    }
  } else {
    for (const topic of topicsList) {
      for (const url of Array.isArray(topic.urls) ? topic.urls : []) {
        try {
          const fetched = await fetchOne(String(url), { timeoutMs, maxBytes, userAgent })
          records.push({
            schema: SCHEMA.raw,
            source_id: `src-${sha256_16(`${topic.id ?? ''}|${url}`)}`,
            topic_id: String(topic.id ?? ''),
            topic: String(topic.topic ?? ''),
            url: String(url),
            source_domain: hostOf(url),
            fetched_at: nowIso(),
            method: 'GET',
            ...fetched,
            sha256_16: sha256_16(fetched.text),
          })
        } catch (error) {
          errors.push({ url: String(url), code: error.code ?? 'fetch_failed', message: error.message })
        }
      }
    }
  }

  for (const record of records) {
    await writeJson(join(options.outDir, 'sources', `${record.source_id}.json`), record)
  }
  const report = {
    schema: `${SCHEMA.raw}.report`,
    stage: 'collect',
    mode,
    generated_at: nowIso(),
    date: today(),
    topic_count: topicsList.length,
    source_count: records.length,
    methods: { GET: records.length },
    external_writes: 0,
    errors,
    sources: records.map(record => ({
      source_id: record.source_id,
      url: record.url,
      source_domain: record.source_domain,
      fetched_at: record.fetched_at,
      bytes: record.bytes,
    })),
  }
  await writeJson(join(options.outDir, 'collect-report.json'), report)
  await writeText(join(options.outDir, '.gitkeep'), '')
  return { records, report, outDir: options.outDir }
}

function main() {
  const args = parseArgs()
  const topicsPath = typeof args.topics === 'string' ? args.topics : ''
  const outDir = typeof args.out === 'string' ? args.out : ''
  if (topicsPath === '' || outDir === '') {
    console.error('用法：node scripts/collect.mjs --topics <topics.json> --out <rawDir> [--fixtures <dir>]')
    process.exit(2)
  }
  runCollect({
    topicsPath,
    outDir,
    fixturesDir: typeof args.fixtures === 'string' ? args.fixtures : undefined,
    timeoutMs: args.timeout,
    maxBytes: args['max-bytes'],
  })
    .then(result => {
      console.log(`[collect] mode=${result.report.mode} sources=${result.report.source_count} external_writes=0 -> ${result.outDir}`)
      if (result.report.errors.length > 0) console.log(`[collect] errors=${result.report.errors.length}`)
    })
    .catch(error => {
      console.error(`[collect] FAILED ${error.code ?? ''} ${error.message}`)
      process.exit(1)
    })
}

if (import.meta.url === `file://${process.argv[1]}`) main()

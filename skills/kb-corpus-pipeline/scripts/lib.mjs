/**
 * kb-corpus-pipeline · 公共库（零依赖）。
 *
 * 约定：本技能只读外部、不写外部；全部产物落在调用方给的 `<workdir>` 内。
 * 内部词表不在本文件硬编码——见 `scripts/wordlist.mjs`（与仓库技能门禁同源，分段存储以自过门禁）。
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

export const SCHEMA = Object.freeze({
  raw: 'kb-raw.v1',
  verified: 'kb-verified.v1',
  clean: 'kb-clean.v1',
  manifest: 'pilot-kb.v2',
})

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex')
}

/** 与入库层 `kb_ingest` 的 `sha256_16` 同口径（前 16 位十六进制）。 */
export function sha256_16(input) {
  return sha256Hex(input).slice(0, 16)
}

export function nowIso() {
  return new Date().toISOString()
}

export function today() {
  return nowIso().slice(0, 10)
}

export async function readText(target) {
  return readFile(target, 'utf8')
}

export async function writeText(target, text) {
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
}

export async function writeJson(target, value) {
  await writeText(target, `${JSON.stringify(value, null, 1)}\n`)
}

export async function readJson(target) {
  return JSON.parse(await readText(target))
}

export async function pathExists(target) {
  try {
    await stat(target)
    return true
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false
    throw error
  }
}

/** 递归列出普通文件（可过滤扩展名，如 `.md` / `.json`）。 */
export async function listFiles(rootDir, options = {}) {
  const exts = Array.isArray(options.exts) && options.exts.length > 0 ? new Set(options.exts) : null
  const skip = new Set(options.skipNames ?? ['.git', 'node_modules'])
  const found = []
  async function walk(current) {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return
      throw error
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
      } else if (entry.isFile()) {
        if (exts === null || exts.has(extname(entry.name).toLowerCase())) found.push(absolute)
      }
    }
  }
  await walk(rootDir)
  found.sort((a, b) => a.localeCompare(b))
  return found
}

/** 极简参数解析：`--key value` / `--key=value` / `--flag`。同名重复收成数组。 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const body = token.slice(2)
    const eq = body.indexOf('=')
    let key = eq === -1 ? body : body.slice(0, eq)
    let value = eq === -1 ? undefined : body.slice(eq + 1)
    if (value === undefined) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        value = next
        i += 1
      } else {
        value = true
      }
    }
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      args[key] = Array.isArray(args[key]) ? [...args[key], value] : [args[key], value]
    } else {
      args[key] = value
    }
  }
  return args
}

/** 去 YAML 元信息头（仅开头 `---` 包夹块；返回是否剥到）。 */
export function stripYamlFrontmatter(raw) {
  const text = String(raw ?? '')
  const match = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(text)
  if (match === null) return { text, stripped: false }
  return { text: text.slice(match[0].length), stripped: true }
}

const PUNCT_RE = /[\s\u3000，。！？；：、"'“”‘’（）()\[\]【】《》〈〉·,.;:!?'"<>/\\|~`@#$%^&*+=_—-]/g

/** 归一化：去空白与标点、统一小写（用于去重/相似度，不用于输出）。 */
export function normalizeText(raw) {
  return String(raw ?? '').replace(PUNCT_RE, '').toLowerCase()
}

/** 字符二元组集合（中文短文本相似度，零依赖）。 */
export function bigrams(raw) {
  const text = normalizeText(raw)
  const set = new Set()
  for (let i = 0; i + 1 < text.length; i += 1) set.add(text.slice(i, i + 2))
  return set
}

/** Jaccard 相似度（对称）。 */
export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const token of a) if (b.has(token)) inter += 1
  return inter / (a.size + b.size - inter)
}

/** 包含度：较短集合被较长集合覆盖的比例（短句 vs 长参考段更稳）。 */
export function containment(a, b) {
  if (a.size === 0) return 0
  let inter = 0
  for (const token of a) if (b.has(token)) inter += 1
  return inter / a.size
}

/** 按句末标点与换行切句，去空白。 */
export function splitSentences(raw) {
  return String(raw ?? '')
    .split(/(?<=[。！？!?；;])|\r?\n+/)
    .map(part => part.trim())
    .filter(part => part !== '')
}

/** 生成文件系统安全的 slug（保留中日韩与字母数字，其余转连字符；尾部附短哈希防撞）。 */
export function slugify(title, hashSuffix = '') {
  const base = String(title ?? '')
    .replace(/[^\p{Script=Han}\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const tail = hashSuffix === '' ? '' : `-${hashSuffix.slice(0, 8)}`
  return base === '' ? `entry${tail}` : `${base}${tail}`
}

/** 统计数组按 key 的分布（返回降序对象）。 */
export function countBy(items, keyFn) {
  const map = {}
  for (const item of items) {
    const key = keyFn(item)
    map[key] = (map[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]))
}

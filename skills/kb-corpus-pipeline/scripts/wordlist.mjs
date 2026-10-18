/**
 * kb-corpus-pipeline · 内部词表（清洗硬门）。
 *
 * 复用口径：默认三项与仓库技能门禁 `DEFAULT_INTERNAL_PATTERNS` 等价
 * （`平台技能版本表`），确保「清洗零命中」
 * 与「技能上架词表扫描」是同一把尺子。
 *
 * 词表默认项存于 `references/internal-wordlist.json`；含内部标识的模式以 parts 分段，
 * 运行时拼接——本文件因此自身不含可被同一门禁命中的连续字面量。
 */
import { readFile } from 'node:fs/promises'

const WORDLIST_URL = new URL('../references/internal-wordlist.json', import.meta.url)

function toRegExp(entry) {
  if (Array.isArray(entry.parts) && entry.parts.length > 0) {
    return new RegExp(entry.parts.join(''), 'i')
  }
  if (typeof entry.source === 'string' && entry.source !== '') {
    return new RegExp(entry.source, 'i')
  }
  return null
}

/** 读取内置默认项（parts/source → RegExp，非法项跳过）。 */
export async function loadDefaultPatterns() {
  const raw = JSON.parse(await readFile(WORDLIST_URL, 'utf8'))
  const patterns = []
  for (const entry of raw.patterns ?? []) {
    const re = toRegExp(entry)
    if (re !== null) patterns.push({ id: String(entry.id ?? 'unknown'), re })
  }
  return patterns
}

/** 追加词表文件：每行 `regex` 或 `id<TAB>regex`（坏正则按字面量兜底，不静默放过）。 */
export async function loadExtraPatterns(wordlistPath) {
  if (typeof wordlistPath !== 'string' || wordlistPath.trim() === '') return []
  let text
  try {
    text = await readFile(wordlistPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const patterns = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const tab = trimmed.indexOf('\t')
    const id = tab === -1 ? `wordlist:${trimmed.slice(0, 24)}` : trimmed.slice(0, tab).trim()
    const source = tab === -1 ? trimmed : trimmed.slice(tab + 1).trim()
    if (source === '') continue
    let re
    try {
      re = new RegExp(source, 'i')
    } catch {
      re = new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
    patterns.push({ id, re })
  }
  return patterns
}

/**
 * 扫描文本；返回命中明细（`id`／`match`／`index`）。
 * @param {string} text
 * @param {{id:string, re:RegExp}[]} patterns
 */
export function scanText(text, patterns) {
  const hits = []
  const source = String(text ?? '')
  for (const { id, re } of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
    const global = new RegExp(re.source, flags)
    let match
    while ((match = global.exec(source)) !== null) {
      hits.push({ id, match: match[0], index: match.index })
      if (match[0] === '') global.lastIndex += 1
    }
  }
  return hits
}

/** 组装词表（默认项 ＋ 可选追加文件）。 */
export async function buildWordlist(options = {}) {
  const patterns = [...(await loadDefaultPatterns()), ...(await loadExtraPatterns(options.wordlistPath))]
  return patterns
}

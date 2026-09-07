#!/usr/bin/env node
// Champion-tier (אלוף) shrinkage guard.
//
// Reads docs/champion-baseline.json — a list of {game, file, pattern, index,
// min, note} entries — applies each entry's regex to its target file, and
// fails loudly if the extracted value is below the recorded historic peak,
// OR if the pattern no longer matches at all (the constant moved/renamed:
// that is ALSO a failure, never a silent skip, because an unnoticed rename
// is exactly how a shrinkage regression would sneak past this guard).
//
// Usage: node scripts/check-champion.mjs
// Exit 0 = every entry OK. Exit 1 = at least one violation or pattern-miss.
//
// No dependencies — plain Node (fs + path only).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(ROOT, 'docs', 'champion-baseline.json')

function loadBaseline() {
  const raw = readFileSync(BASELINE_PATH, 'utf8')
  const json = JSON.parse(raw)
  if (!Array.isArray(json.entries)) {
    throw new Error(`${BASELINE_PATH} has no "entries" array`)
  }
  return json.entries
}

/** Parse a comma-separated numeric list captured inside one regex group. */
function parseNumberList(str) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s)
      if (Number.isNaN(n)) throw new Error(`non-numeric token "${s}"`)
      return n
    })
}

/**
 * Run one baseline entry against its file. Returns { ok, found, message }.
 * found is the extracted number (or null if the pattern didn't match, or the
 * value couldn't be parsed).
 */
function runEntry(entry, fileText) {
  const re = new RegExp(entry.pattern)

  // "count" mode: index literal string 'count' — count total regex matches
  // across the file (used for songs.ts, where the pattern matches once PER
  // song entry rather than capturing an array).
  if (entry.index === 'count') {
    const globalRe = new RegExp(entry.pattern, 'g')
    const matches = fileText.match(globalRe)
    const found = matches ? matches.length : 0
    if (found === 0) {
      return { ok: false, found: null, message: 'pattern matched 0 times (constant moved/renamed?)' }
    }
    const ok = found >= entry.min
    return { ok, found, message: ok ? `${found} >= min ${entry.min}` : `${found} < min ${entry.min}` }
  }

  // "product" mode: two capture groups, checked value = group1 * group2,
  // may carry BOTH a min and a max (e.g. an intentionally-frozen board size).
  if (entry.index === 'product') {
    const m = fileText.match(re)
    if (!m) return { ok: false, found: null, message: 'pattern did not match (constant moved/renamed?)' }
    const a = Number(m[1])
    const b = Number(m[2])
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return { ok: false, found: null, message: `non-numeric capture groups "${m[1]}", "${m[2]}"` }
    }
    const found = a * b
    const min = entry.min
    const max = 'max' in entry ? entry.max : Infinity
    const ok = found >= min && found <= max
    const bound = Number.isFinite(max) && max !== min ? `${min}..${max}` : `${min}`
    return { ok, found, message: ok ? `${found} within ${bound}` : `${found} outside ${bound}` }
  }

  const m = fileText.match(re)
  if (!m) return { ok: false, found: null, message: 'pattern did not match (constant moved/renamed?)' }

  // "length" mode: capture group 1 is a comma-separated list; the checked
  // value is how many ELEMENTS it has (used for e.g. a template's sequence
  // length, where the numbers inside are positional indices, not magnitudes).
  if (entry.index === 'length') {
    let list
    try {
      list = parseNumberList(m[1])
    } catch (e) {
      return { ok: false, found: null, message: `could not parse captured list "${m[1]}": ${e.message}` }
    }
    const found = list.length
    const ok = found >= entry.min
    return { ok, found, message: ok ? `length ${found} >= min ${entry.min}` : `length ${found} < min ${entry.min}` }
  }

  // scalar mode: index === null, single capture group is the number itself
  if (entry.index === null || entry.index === undefined) {
    const raw = m[1] !== undefined ? m[1] : m[0]
    const n = Number(raw.trim())
    if (Number.isNaN(n)) return { ok: false, found: null, message: `captured value "${raw}" is not numeric` }
    const ok = n >= entry.min
    return { ok, found: n, message: ok ? `${n} >= min ${entry.min}` : `${n} < min ${entry.min}` }
  }

  // indexed-array mode: capture group 1 is a comma-separated list, entry.index
  // selects which element to check
  let list
  try {
    list = parseNumberList(m[1])
  } catch (e) {
    return { ok: false, found: null, message: `could not parse captured list "${m[1]}": ${e.message}` }
  }
  if (entry.index < 0 || entry.index >= list.length) {
    return {
      ok: false,
      found: null,
      message: `index ${entry.index} out of range for captured list [${list.join(', ')}] (length ${list.length})`,
    }
  }
  const found = list[entry.index]
  const ok = found >= entry.min
  return { ok, found, message: ok ? `${found} >= min ${entry.min}` : `${found} < min ${entry.min}` }
}

function main() {
  const entries = loadBaseline()
  const rows = []
  let failures = 0

  for (const entry of entries) {
    const filePath = path.join(ROOT, entry.file)
    let fileText
    try {
      fileText = readFileSync(filePath, 'utf8')
    } catch (e) {
      failures++
      rows.push({ entry, ok: false, message: `could not read file: ${e.message}` })
      continue
    }

    let result
    try {
      result = runEntry(entry, fileText)
    } catch (e) {
      result = { ok: false, found: null, message: `error while checking: ${e.message}` }
    }
    if (!result.ok) failures++
    rows.push({ entry, ok: result.ok, message: result.message })
  }

  const label = (e) => `${e.game.padEnd(14)} ${e.file}`
  for (const row of rows) {
    const tag = row.ok ? 'OK  ' : 'FAIL'
    console.log(`[${tag}] ${label(row.entry)} — ${row.message}`)
  }

  console.log('')
  if (failures > 0) {
    console.log(`champion-baseline check: ${failures}/${rows.length} FAILED`)
    console.log('A failure means either (a) a game\'s אלוף tier is below its recorded historic')
    console.log('peak, or (b) the checked constant moved/renamed and docs/champion-baseline.json')
    console.log('needs a deliberate update. See docs/champion-baseline.json "note" fields for context.')
    process.exit(1)
  } else {
    console.log(`champion-baseline check: ${rows.length}/${rows.length} OK`)
    process.exit(0)
  }
}

main()

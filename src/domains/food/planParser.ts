// Pure SMC plan parser — no I/O, no Dexie, no React imports.
// (filename: string, raw: string) → ParsedPlan | null
//
// Handles:
//   - Frontmatter: window_start/window_end (batch) or date (single-day) — per-key regex
//   - Filename fallback: YYYY-MM-DD.md and YYYY-MM-DD--YYYY-MM-DD.md when frontmatter absent
//   - Body format A (table): | # | Time | Meal | Selector | rows (Meal column)
//   - Body format B (prose): **Food:** <meal string> per slot
//   - Returns null on total parse failure (caller uses: filter((p): p is ParsedPlan => p !== null))
//   - Never throws on any input.
//
// Security (T-04-06): all regexes are anchored module-level constants; no unbounded backtracking.
// Read-only by construction: no write/trigger path to ../schedule-meal-coordinator/ (FOOD-01/C1).
import { normalizeMealName } from './food.types'

// ── Exported interfaces ───────────────────────────────────────────────────────

/** Parsed representation of one SMC plan file. */
export interface ParsedPlan {
  /** Inclusive window start — YYYY-MM-DD (authoritative from frontmatter; fallback = filename). */
  windowStart: string
  /** Inclusive window end — YYYY-MM-DD. */
  windowEnd: string
  /** Normalized meal-name strings (normalizeMealName applied), one per scheduled slot. */
  meals: string[]
}

/** Result of tokenizing a meal name into its constituent ingredient tokens. */
export interface TokenizedMeal {
  /** Individual ingredient tokens, trimmed and non-empty. */
  tokens: string[]
  /**
   * True when the meal name contains no recognized separators — whole-meal/restaurant
   * items like "Qdoba bowl" that cannot be priced from an ingredient decomposition.
   * Caller should use a flat-cost field or fallback-high for these (D-04).
   */
  isNonDecomposable: boolean
}

// ── Module-level regex constants (T-04-06: anchored, no catastrophic backtracking) ──

/** Frontmatter block: lines between first --- delimiters at start of file. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

/** Single-day files use `date:` instead of window_start/window_end. */
const FM_DATE_RE = /^date:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m
/** Batch files use window_start: and window_end: */
const FM_WINDOW_START_RE = /^window_start:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m
const FM_WINDOW_END_RE = /^window_end:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m

/** Filename: single-date format YYYY-MM-DD.md */
const FILENAME_SINGLE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/
/** Filename: date-range format YYYY-MM-DD--YYYY-MM-DD.md */
const FILENAME_RANGE_RE = /^(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\.md$/

/** YYYY-MM-DD date string validation. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Markdown table row with at least 4 pipe-separated columns.
 * Captures the Meal column (third column, index 2 after leading |) in:
 *   | # | Time | Meal | Selector |
 * Match group 1 = Meal cell content.
 */
const TABLE_ROW_RE = /^\|\s*[^|]+\|\s*[^|]+\|\s*([^|]+)\|\s*[^|]+\|/

/** Separator row in a Markdown table (---|---| pattern) — skip these. */
const TABLE_SEPARATOR_RE = /^\|[\s-|]+\|$/

/** Header row of the SMC table (# | Time | Meal | Selector). Skip when detected. */
const TABLE_HEADER_RE = /^\|\s*#\s*\|\s*Time\s*\|\s*Meal\s*\|\s*Selector\s*\|/i

/** **Food:** prose line per slot. Group 1 = meal string (global match in extractMealsFromProse). */
const FOOD_PROSE_GLOBAL_RE = /^\*\*Food:\*\*\s*(.+)$/gm

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely get a string value from a Record<string, string> with noUncheckedIndexedAccess.
 */
function get(record: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined
}

/**
 * Extract frontmatter fields as a key→value map.
 * Uses targeted per-key regex, not a full YAML parser (RESEARCH "Don't Hand-Roll").
 */
function extractFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return {}
  const body = match[1]
  if (!body) return {}
  const result: Record<string, string> = {}
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(\w[\w_]*):\s*"?([^"#\r\n]*?)"?\s*$/)
    if (m) {
      const key = m[1]
      const val = m[2]
      if (key && val !== undefined) {
        result[key] = val.trim()
      }
    }
  }
  return result
}

/**
 * Extract window dates from frontmatter (window_start/window_end or date:).
 * Returns null if none found — caller falls back to filename.
 */
function extractWindowFromFrontmatter(
  raw: string
): { windowStart: string; windowEnd: string } | null {
  const fm = extractFrontmatter(raw)

  // window_start + window_end (batch files) — extracted by generic loop
  const ws = get(fm, 'window_start')
  const we = get(fm, 'window_end')
  if (ws && we && DATE_RE.test(ws) && DATE_RE.test(we)) {
    return { windowStart: ws, windowEnd: we }
  }

  // Fallback to direct regex in case of edge-case quoting differences
  const wsMatch = raw.match(FM_WINDOW_START_RE)
  const weMatch = raw.match(FM_WINDOW_END_RE)
  if (wsMatch && weMatch) {
    const wsVal = wsMatch[1]
    const weVal = weMatch[1]
    if (wsVal && weVal) {
      return { windowStart: wsVal, windowEnd: weVal }
    }
  }

  // date: (single-day files, plan_version 1.1)
  const dateMatch = raw.match(FM_DATE_RE)
  if (dateMatch) {
    const dateVal = dateMatch[1]
    if (dateVal) return { windowStart: dateVal, windowEnd: dateVal }
  }

  // fm['date'] as well (extracted by generic loop above)
  const d = get(fm, 'date')
  if (d && DATE_RE.test(d)) {
    return { windowStart: d, windowEnd: d }
  }

  return null
}

/**
 * Extract window dates from filename as fallback when frontmatter is absent or unparseable.
 * Handles YYYY-MM-DD.md (single) and YYYY-MM-DD--YYYY-MM-DD.md (range).
 */
function extractWindowFromFilename(
  filename: string
): { windowStart: string; windowEnd: string } | null {
  const single = filename.match(FILENAME_SINGLE_RE)
  if (single) {
    const d = single[1]
    if (d) return { windowStart: d, windowEnd: d }
  }

  const range = filename.match(FILENAME_RANGE_RE)
  if (range) {
    const start = range[1]
    const end = range[2]
    if (start && end) return { windowStart: start, windowEnd: end }
  }

  return null
}

/**
 * Extract meals from body format A: Markdown table rows.
 * Table header: | # | Time | Meal | Selector |
 * Extracts the Meal column (third column after leading |).
 */
function extractMealsFromTable(raw: string): string[] | null {
  const lines = raw.split(/\r?\n/)
  const meals: string[] = []

  for (const line of lines) {
    if (!line.startsWith('|')) continue
    if (TABLE_SEPARATOR_RE.test(line)) continue
    if (TABLE_HEADER_RE.test(line)) continue

    const m = line.match(TABLE_ROW_RE)
    if (m) {
      const cell = m[1]
      if (cell) {
        const meal = cell.trim()
        if (meal.length > 0) {
          meals.push(normalizeMealName(meal))
        }
      }
    }
  }

  return meals.length > 0 ? meals : null
}

/**
 * Extract meals from body format B: **Food:** prose lines.
 * Regex: /^\*\*Food:\*\*\s*(.+)$/gm — one meal per matching line.
 */
function extractMealsFromProse(raw: string): string[] | null {
  const meals: string[] = []
  // Reset lastIndex since we use FOOD_PROSE_GLOBAL_RE as a module-level re-used regex
  FOOD_PROSE_GLOBAL_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FOOD_PROSE_GLOBAL_RE.exec(raw)) !== null) {
    const cell = m[1]
    if (cell) {
      const meal = cell.trim()
      if (meal.length > 0) {
        meals.push(normalizeMealName(meal))
      }
    }
  }
  return meals.length > 0 ? meals : null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse one SMC plan file into a structured ParsedPlan.
 *
 * Pure function — no I/O, no Dexie, no storage imports (FOOD-01/C1 read-only guarantee).
 *
 * @param filename  Basename of the plan file (e.g. "2026-05-25--2026-05-28.md").
 * @param raw       Raw .md file content as a string.
 * @returns ParsedPlan on success; null on total parse failure. Caller filters with
 *          `(p): p is ParsedPlan => p !== null` (T-04-05 — no silent partial result).
 */
export function parsePlanFile(filename: string, raw: string): ParsedPlan | null {
  try {
    // ── 1. Determine window dates ─────────────────────────────────────────────
    const window =
      extractWindowFromFrontmatter(raw) ?? extractWindowFromFilename(filename)

    // No window = cannot produce a useful ParsedPlan
    if (!window) return null

    // ── 2. Extract meals — try table format first, then prose format ──────────
    // Both formats can appear regardless of filename type (finding: 2026-05-29--2026-05-31
    // is a date-range batch file using prose format — resolves RESEARCH A3/OQ2).
    const meals = extractMealsFromTable(raw) ?? extractMealsFromProse(raw)

    // No meals extracted = not a useful plan (return null, triggers fallback-high)
    if (!meals || meals.length === 0) return null

    return {
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      meals,
    }
  } catch {
    // Defensive: any unexpected error → null (T-04-05, T-04-06)
    return null
  }
}

// ── V2: tokenizeMealName ──────────────────────────────────────────────────────

/**
 * Tokenize a normalized meal name into constituent ingredient tokens.
 *
 * Splits on mixed separators: `,` (comma), ` and ` (space-and-space), ` with ` (space-with-space).
 * Separator priority: commas first, then " and ", then " with ".
 *
 * Non-decomposable detection: if the meal produces only one token (no separator found),
 * flag as `isNonDecomposable: true` — whole-meal/restaurant items (e.g. "qdoba bowl")
 * cannot be decomposed into priceable ingredients. Cost engine uses flat-cost fallback (D-04).
 *
 * NOTE: The cost engine joins FULL meal-name strings to the meal-definition table —
 * individual ingredient names come from the table's `ingredients[]` field, NOT from
 * these tokens. This tokenizer is for the V2 ingredient-lookup contract only (RESEARCH anti-pattern).
 *
 * @param mealName  Normalized (lowercase, trimmed) meal name string.
 * @returns TokenizedMeal with `tokens[]` and `isNonDecomposable` flag.
 */
export function tokenizeMealName(mealName: string): TokenizedMeal {
  // Split on commas first (preserves multi-word tokens between commas).
  // After comma-split, strip a leading "and " or "with " from each segment
  // (handles ", and broccoli" → "and broccoli" after comma-split → "broccoli").
  const commaSplit = mealName
    .split(',')
    .map((s) => s.trim().replace(/^and\s+/i, '').replace(/^with\s+/i, '').trim())
    .filter((s) => s.length > 0)

  // For each comma-segment, further split on ' and ' and ' with '
  const tokens: string[] = []
  for (const segment of commaSplit) {
    const andSplit = segment.split(/\s+and\s+/).map((s) => s.trim()).filter((s) => s.length > 0)
    for (const andPart of andSplit) {
      const withSplit = andPart.split(/\s+with\s+/).map((s) => s.trim()).filter((s) => s.length > 0)
      for (const token of withSplit) {
        tokens.push(token)
      }
    }
  }

  const isNonDecomposable = tokens.length <= 1

  return {
    tokens: tokens.length > 0 ? tokens : [mealName],
    isNonDecomposable,
  }
}

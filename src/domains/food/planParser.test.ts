// TDD RED → GREEN for parsePlanFile (04-02)
// Pure function tests: (filename, raw) → ParsedPlan | null
// Fixtures are hermetic snapshots — never reads live ../schedule-meal-coordinator/ files.
import { describe, it, expect } from 'vitest'
import { parsePlanFile, tokenizeMealName } from './planParser'
import type { ParsedPlan } from './planParser'

// ── Fixture loader ────────────────────────────────────────────────────────────
// Load hermetic SMC plan snapshots via Vite's ?raw import (consistent with
// how food.atoms.ts loads plan files via import.meta.glob at build time).
// Using static imports ensures Vite bundles them and tsc sees type-correct strings.
import raw2026_05_18 from './__fixtures__/2026-05-18.md?raw'
import raw2026_05_19 from './__fixtures__/2026-05-19.md?raw'
import raw2026_05_21 from './__fixtures__/2026-05-21.md?raw'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — double-dash filename; TS module resolution is fine for ?raw imports
import raw2026_05_25__28 from './__fixtures__/2026-05-25--2026-05-28.md?raw'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — double-dash filename
import raw2026_05_29__31 from './__fixtures__/2026-05-29--2026-05-31.md?raw'

const FIXTURES: Record<string, string> = {
  '2026-05-18.md': raw2026_05_18 as string,
  '2026-05-19.md': raw2026_05_19 as string,
  '2026-05-21.md': raw2026_05_21 as string,
  '2026-05-25--2026-05-28.md': raw2026_05_25__28 as string,
  '2026-05-29--2026-05-31.md': raw2026_05_29__31 as string,
}

// ── V1: Batch fixture (table body format) ────────────────────────────────────
describe('parsePlanFile — V1 batch fixture (table body format)', () => {
  const filename = '2026-05-25--2026-05-28.md'
  const raw = FIXTURES[filename]!

  it('returns a non-null ParsedPlan', () => {
    const result = parsePlanFile(filename, raw)
    expect(result).not.toBeNull()
  })

  it('extracts windowStart = 2026-05-25 from frontmatter', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowStart).toBe('2026-05-25')
  })

  it('extracts windowEnd = 2026-05-28 from frontmatter', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowEnd).toBe('2026-05-28')
  })

  it('extracts a non-empty meals array', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals.length).toBeGreaterThan(0)
  })

  it('extracts normalized meal names from table Meal column', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    // Normalized: lowercase + trimmed. Batch table uses comma-free names.
    expect(result.meals).toContain('eggs and pb toast')
    expect(result.meals).toContain('chicken rice and broccoli')
    expect(result.meals).toContain('pasta beef cheese green beans')
    expect(result.meals).toContain('sweet potato beef cheese green beans')
    expect(result.meals).toContain('cereal and milk')
    expect(result.meals).toContain('greek yogurt with granola and berries')
    expect(result.meals).toContain('oatmeal and protein slop')
  })

  it('all meals are normalized (lowercase, trimmed)', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    for (const meal of result.meals) {
      expect(meal).toBe(meal.toLowerCase())
      expect(meal).toBe(meal.trim())
    }
  })
})

// ── V1: Single-day fixture 2026-05-21 (Food: prose format) ───────────────────
describe('parsePlanFile — V1 single-day fixture 2026-05-21 (Food: prose format)', () => {
  const filename = '2026-05-21.md'
  const raw = FIXTURES[filename]!

  it('returns a non-null ParsedPlan', () => {
    const result = parsePlanFile(filename, raw)
    expect(result).not.toBeNull()
  })

  it('windowStart === windowEnd === 2026-05-21 (from date: frontmatter)', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowStart).toBe('2026-05-21')
    expect(result.windowEnd).toBe('2026-05-21')
  })

  it('extracts meal names from **Food:** prose lines', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals).toContain('rice cakes with peanut butter and banana')
    expect(result.meals).toContain('protein shake and banana')
    expect(result.meals).toContain('eggs and pb toast')
    expect(result.meals).toContain('greek yogurt with granola and berries')
    expect(result.meals).toContain('qdoba bowl')
  })

  it('extracts exactly 5 meals (5 **Food:** lines in 2026-05-21.md)', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals.length).toBe(5)
  })
})

// ── V1: Single-day fixture 2026-05-18 ────────────────────────────────────────
describe('parsePlanFile — V1 single-day fixture 2026-05-18', () => {
  const filename = '2026-05-18.md'
  const raw = FIXTURES[filename]!

  it('returns windowStart === windowEnd === 2026-05-18', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowStart).toBe('2026-05-18')
    expect(result.windowEnd).toBe('2026-05-18')
  })

  it('extracts 5 meals', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals.length).toBe(5)
  })

  it('contains pasta, beef, cheese, green beans (normalized)', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals).toContain('pasta, beef, cheese, green beans')
  })

  it('contains french toast and eggs (normalized)', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals).toContain('french toast and eggs')
  })
})

// ── V1: Single-day fixture 2026-05-19 ────────────────────────────────────────
describe('parsePlanFile — V1 single-day fixture 2026-05-19', () => {
  const filename = '2026-05-19.md'
  const raw = FIXTURES[filename]!

  it('returns windowStart === windowEnd === 2026-05-19', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowStart).toBe('2026-05-19')
    expect(result.windowEnd).toBe('2026-05-19')
  })

  it('skips non-Food slots (lift slot has no **Food:** line)', () => {
    // 2026-05-19.md has 6 slots but slot 3 is LIFT (no **Food:** line) → 5 food slots
    const result = parsePlanFile(filename, raw) as ParsedPlan
    // 5 **Food:** lines (slots 1, 2, 4, 5, 6)
    expect(result.meals.length).toBe(5)
  })
})

// ── V1: Batch file 2026-05-29--2026-05-31 (Food: prose format) ───────────────
describe('parsePlanFile — V1 batch 2026-05-29--2026-05-31 (Food: prose format)', () => {
  const filename = '2026-05-29--2026-05-31.md'
  const raw = FIXTURES[filename]!

  it('extracts windowStart = 2026-05-29', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowStart).toBe('2026-05-29')
  })

  it('extracts windowEnd = 2026-05-31', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.windowEnd).toBe('2026-05-31')
  })

  it('extracts meals from **Food:** lines in date-range file', () => {
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.meals).toContain('cereal and milk')
    expect(result.meals).toContain('pasta, beef, cheese, green beans')
    expect(result.meals).toContain('chicken, rice, and broccoli')
    expect(result.meals).toContain('oatmeal cream pie and banana')
    expect(result.meals).toContain('eggs and pb toast')
    expect(result.meals).toContain('oatmeal and protein slop')
  })
})

// ── V1: Corpus — all 14 known meal strings covered across 5 fixtures ─────────
describe('parsePlanFile — V1 corpus: all 14 meals across 5 fixtures', () => {
  // The 14 known meal strings from STATE.md (normalized form).
  // Note: batch file 2026-05-25--2026-05-28 uses comma-free names in the table;
  // those are separate normalized forms that must also appear in the corpus.
  const KNOWN_MEALS_14 = [
    'cereal and milk',
    'eggs and pb toast',
    'french toast and eggs',
    'greek yogurt with granola and berries',
    'oatmeal and protein slop',
    'oatmeal cream pie and banana',
    'protein slop and granola',
    'protein shake and banana',
    'qdoba bowl',
    'rice cakes with peanut butter and banana',
    // Comma-with versions (from prose files):
    'pasta, beef, cheese, green beans',
    'chicken, rice, and broccoli',
    'sweet potato, beef, cheese, green beans',
    'turkey sandwich with cheese and green beans',
  ]

  const allFixtureEntries = Object.entries(FIXTURES) as [string, string][]

  function collectAllMeals(): Set<string> {
    const all = new Set<string>()
    for (const [filename, raw] of allFixtureEntries) {
      const result = parsePlanFile(filename, raw)
      if (result) {
        for (const m of result.meals) all.add(m)
      }
    }
    return all
  }

  it('zero dropped slots — all 14 known meal strings appear in union', () => {
    const allMeals = collectAllMeals()
    const missing = KNOWN_MEALS_14.filter((m) => !allMeals.has(m))
    expect(missing, `Missing meals: ${missing.join(', ')}`).toHaveLength(0)
  })

  it('total slot count matches expected 55 (5+5+5+24+16)', () => {
    // 2026-05-18: 5 slots
    // 2026-05-19: 5 food slots (slot 3 is lift, no Food:)
    // 2026-05-21: 5 slots
    // 2026-05-25--2026-05-28: 4 days × 6 slots = 24 slots
    // 2026-05-29--2026-05-31: 3 days → 6+5+5 = 16 food slots
    let total = 0
    for (const [filename, raw] of allFixtureEntries) {
      const result = parsePlanFile(filename, raw)
      if (result) total += result.meals.length
    }
    expect(total).toBe(55)
  })
})

// ── Filename fallback: no frontmatter ────────────────────────────────────────
describe('parsePlanFile — filename date fallback (no frontmatter)', () => {
  it('single-date filename yields windowStart === windowEnd === 2026-05-19', () => {
    const raw = `### 1. 5:00am\n**Food:** Oatmeal and protein slop\n**Selector:** x\n`
    const result = parsePlanFile('2026-05-19.md', raw) as ParsedPlan
    expect(result).not.toBeNull()
    expect(result.windowStart).toBe('2026-05-19')
    expect(result.windowEnd).toBe('2026-05-19')
  })

  it('date-range filename yields correct start/end', () => {
    const raw = `### 1. 5:00am\n**Food:** Cereal and milk\n**Selector:** x\n`
    const result = parsePlanFile('2026-05-25--2026-05-28.md', raw) as ParsedPlan
    expect(result).not.toBeNull()
    expect(result.windowStart).toBe('2026-05-25')
    expect(result.windowEnd).toBe('2026-05-28')
  })
})

// ── Null path: malformed input ────────────────────────────────────────────────
describe('parsePlanFile — null path (malformed input)', () => {
  it('returns null for no frontmatter + no date in filename + no meal lines', () => {
    const result = parsePlanFile('no-date.md', 'just some random text')
    expect(result).toBeNull()
  })

  it('does not throw on empty string input', () => {
    expect(() => parsePlanFile('2026-05-19.md', '')).not.toThrow()
  })

  it('does not throw on invalid markdown', () => {
    expect(() => parsePlanFile('2026-05-19.md', '--- garbage ---\nnot yaml\n---\n')).not.toThrow()
  })

  it('returns null when filename has no recognizable date and no meal lines', () => {
    const result = parsePlanFile('invalid.md', '# No date, no meals\nsome body text\n')
    expect(result).toBeNull()
  })
})

// ── CR-02: ParsedPlan.mealDays — distinct days with meals ────────────────────
//
// Contract:
//   - mealDays: number of distinct calendar days with >= 1 meal slot
//   - Single-date plans: mealDays = 1 (one day, one window)
//   - Batch plans: count distinct YYYY-MM-DD section headers that carry meals
//   - mealDays <= calendar span; mealDays >= 1 for any plan with meals
//   - A window with a gap day yields mealDays < span
describe('ParsedPlan.mealDays — CR-02 distinct days with meals', () => {
  it('single-date fixture 2026-05-18: mealDays === 1', () => {
    const filename = '2026-05-18.md'
    const raw = FIXTURES[filename]!
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.mealDays).toBe(1)
  })

  it('single-date fixture 2026-05-19: mealDays === 1', () => {
    const filename = '2026-05-19.md'
    const raw = FIXTURES[filename]!
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.mealDays).toBe(1)
  })

  it('single-date fixture 2026-05-21: mealDays === 1', () => {
    const filename = '2026-05-21.md'
    const raw = FIXTURES[filename]!
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.mealDays).toBe(1)
  })

  it('batch table fixture 2026-05-25--2026-05-28: mealDays === 4 (4 days with meals)', () => {
    const filename = '2026-05-25--2026-05-28.md'
    const raw = FIXTURES[filename]!
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.mealDays).toBe(4)
  })

  it('batch prose fixture 2026-05-29--2026-05-31: mealDays === 3 (3 days with meals)', () => {
    const filename = '2026-05-29--2026-05-31.md'
    const raw = FIXTURES[filename]!
    const result = parsePlanFile(filename, raw) as ParsedPlan
    expect(result.mealDays).toBe(3)
  })

  it('mealDays <= calendar span for all fixtures', () => {
    for (const [filename, raw] of Object.entries(FIXTURES) as [string, string][]) {
      const result = parsePlanFile(filename, raw)
      if (!result) continue
      const start = new Date(result.windowStart + 'T12:00:00Z')
      const end   = new Date(result.windowEnd   + 'T12:00:00Z')
      const span  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
      expect(result.mealDays).toBeLessThanOrEqual(span)
    }
  })

  it('mealDays >= 1 for all fixtures with meals', () => {
    for (const [filename, raw] of Object.entries(FIXTURES) as [string, string][]) {
      const result = parsePlanFile(filename, raw)
      if (!result) continue
      if (result.meals.length > 0) {
        expect(result.mealDays).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('inline fixture with gap day: 3-day window with only 2 days having meals → mealDays === 2', () => {
    // A plan window that spans 3 days but only has meals on 2 of them (one gap day)
    const raw = `---
window_start: "2026-06-01"
window_end: "2026-06-03"
---

## 2026-06-01

**Food:** Cereal and milk
**Selector:** x

## 2026-06-02

No meals today (rest day)

## 2026-06-03

**Food:** Chicken, rice, and broccoli
**Selector:** x
`
    const result = parsePlanFile('2026-06-01--2026-06-03.md', raw) as ParsedPlan
    expect(result).not.toBeNull()
    expect(result.mealDays).toBe(2)
    // mealDays < calendar span (2 < 3)
    expect(result.mealDays).toBeLessThan(3)
  })
})

// ── V2: tokenizeMealName ──────────────────────────────────────────────────────
describe('tokenizeMealName — V2 ingredient tokenizer contract', () => {
  it('"chicken, rice, and broccoli" → [chicken, rice, broccoli]', () => {
    const result = tokenizeMealName('chicken, rice, and broccoli')
    expect(result.tokens).toEqual(['chicken', 'rice', 'broccoli'])
    expect(result.isNonDecomposable).toBe(false)
  })

  it('"pasta, beef, cheese, green beans" → [pasta, beef, cheese, green beans]', () => {
    const result = tokenizeMealName('pasta, beef, cheese, green beans')
    expect(result.tokens).toEqual(['pasta', 'beef', 'cheese', 'green beans'])
    expect(result.isNonDecomposable).toBe(false)
  })

  it('"rice cakes with peanut butter and banana" → splits on "with" and "and"', () => {
    const result = tokenizeMealName('rice cakes with peanut butter and banana')
    expect(result.tokens).toContain('rice cakes')
    expect(result.tokens).toContain('peanut butter')
    expect(result.tokens).toContain('banana')
    expect(result.isNonDecomposable).toBe(false)
  })

  it('"qdoba bowl" → non-decomposable flag', () => {
    const result = tokenizeMealName('qdoba bowl')
    expect(result.isNonDecomposable).toBe(true)
  })

  it('tokens are trimmed and non-empty', () => {
    const result = tokenizeMealName('chicken, rice, and broccoli')
    for (const t of result.tokens) {
      expect(t.length).toBeGreaterThan(0)
      expect(t).toBe(t.trim())
    }
  })

  it('"eggs and pb toast" → [eggs, pb toast] (splits on "and ")', () => {
    const result = tokenizeMealName('eggs and pb toast')
    expect(result.tokens).toEqual(['eggs', 'pb toast'])
  })

  it('"cereal and milk" → [cereal, milk]', () => {
    const result = tokenizeMealName('cereal and milk')
    expect(result.tokens).toEqual(['cereal', 'milk'])
  })

  it('"protein shake and banana" → [protein shake, banana]', () => {
    const result = tokenizeMealName('protein shake and banana')
    expect(result.tokens).toEqual(['protein shake', 'banana'])
  })
})

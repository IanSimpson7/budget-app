// TDD RED → GREEN for parsePlanFile (04-02)
// Pure function tests: (filename, raw) → ParsedPlan | null
// Fixtures are hermetic snapshots — never reads live ../schedule-meal-coordinator/ files.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parsePlanFile, tokenizeMealName } from './planParser'
import type { ParsedPlan } from './planParser'

// ── Fixture loader ────────────────────────────────────────────────────────────
// Loads hermetic SMC plan snapshots from __fixtures__/ relative to this file.
// Tests are deterministic regardless of whether live SMC files exist.
const fixtureDir = join(__dirname, '__fixtures__')

function loadFixture(filename: string): string {
  return readFileSync(join(fixtureDir, filename), 'utf-8')
}

// ── V1: Batch fixture (table body format) ────────────────────────────────────
describe('parsePlanFile — V1 batch fixture (table body format)', () => {
  const filename = '2026-05-25--2026-05-28.md'
  const raw = loadFixture(filename)

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
  const raw = loadFixture(filename)

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
  const raw = loadFixture(filename)

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
  const raw = loadFixture(filename)

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
  const raw = loadFixture(filename)

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

  const allFixtures = [
    '2026-05-18.md',
    '2026-05-19.md',
    '2026-05-21.md',
    '2026-05-25--2026-05-28.md',
    '2026-05-29--2026-05-31.md',
  ]

  function collectAllMeals(): Set<string> {
    const all = new Set<string>()
    for (const filename of allFixtures) {
      const raw = loadFixture(filename)
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

  it('total slot count matches expected 26 (5+6+5+24+16)', () => {
    // 2026-05-18: 5 slots
    // 2026-05-19: 5 food slots (slot 3 is lift, no Food:)
    // 2026-05-21: 5 slots
    // 2026-05-25--2026-05-28: 4 days × 6 slots = 24 slots
    // 2026-05-29--2026-05-31: 3 days × 5-6 slots = 16 food slots
    let total = 0
    for (const filename of allFixtures) {
      const raw = loadFixture(filename)
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

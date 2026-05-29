# Phase 3: Expense Model + Sinking Funds - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 3-expense-model-sinking-funds
**Areas discussed:** Expense entry & classification, Sinking-fund mechanics, Survival floor + food placeholder, Funds surface scope

---

## Expense entry & classification

### Entry method
| Option | Description | Selected |
|--------|-------------|----------|
| Typed-only; defer CC adapter to P5 | Typed entry covers recurring/fixed lines; push CC adapter + reconciliation to Phase 5 where discretionary spend feeds surplus | ✓ |
| Build CC adapter + reconciliation now | Honor the Phase-2 deferral literally; larger phase, ahead of when surplus needs it | |

### Classification model
| Option | Description | Selected |
|--------|-------------|----------|
| Single enum: protected \| gateable | One mutually-exclusive field; prevents contradictory state; trivial filters | ✓ |
| Two independent bools (per spec §8) | Keep `protected`+`gateable` separate; allows 'neither'; needs validation | |

### Seed data
| Option | Description | Selected |
|--------|-------------|----------|
| Seed §4a fixed costs as editable line items | Real survival floor on day one; insurance→sinking fund; whey excluded (EXP-07) | ✓ |
| Start empty | Clean slate; survival floor reads foodSeed only until Ian enters costs | |

**Notes:** Insurance seeds as the sinking-fund instance, not a fixed line (avoids double-count). Whey deliberately excluded — it belongs to the Phase-4 protected food floor.

---

## Sinking-fund mechanics

### Balance model
| Option | Description | Selected |
|--------|-------------|----------|
| Manual balance + recommended accrual | Ian records actual balance; app shows recommended accrual + on-track status; C3-consistent | ✓ |
| Auto-projected balance (computed) | Balance = accrual × months elapsed; zero upkeep but can overstate, drifts from C3 | |

### Payout behavior + recurrence
| Option | Description | Selected |
|--------|-------------|----------|
| Ian marks paid; recurring auto-rolls +1yr | C3-consistent; `cadence: annual\|oneoff` distinguishes; EXP-05 zero-rework | (chosen via free-text) |
| App auto-covers on date | Less friction but acts on an unverifiable money event | |

**User's choice (free-text):** "My car insurance will be due in March of 2027 and I'll likely have a different car. I'm not sure we can accurately quantify what it'll be." → Confirmed in follow-up: mark-paid + recurring auto-roll is correct (not app auto-cover); on-track status = projected balance at payout vs current target; Ian repopulates the target value at renewal rather than the app guessing.
**Notes:** The $982 target is a soft, fully-editable provisional value; payoutDate = 2027-03.

### Floor link
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — monthly accrual feeds survival floor | Amortized ~$82/mo (not the $982 lump) is a protected monthly obligation | ✓ |
| No — funds tracked separately from floor | Simpler separation but understates true monthly survival cost | |

---

## Survival floor + food placeholder

### Food stub
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing floors.foodSeed (~$550) | Phase 4 swaps the computed floor into the same slot; zero new parameter | ✓ |
| New dedicated placeholder parameter | More explicit but Phase 4 must reconcile/retire it | |

### Floor display
| Option | Description | Selected |
|--------|-------------|----------|
| New font-mono metric card | Alongside existing cards; avoids band collision with the close passive floor | ✓ |
| Add a band/marker on the income bar | Richer single-glance read but risks visual collision (~$2,340 vs ~$2,400) | |

### Expense UI location
| Option | Description | Selected |
|--------|-------------|----------|
| New /expenses route — add + view split there | Dedicated surface; dashboard gets only the survival-floor number this phase | ✓ |
| Put the split on the dashboard now | Pulls Phase-5 UI-01 forward; dashboard scope creep | |

---

## Funds surface scope

### EF stub
| Option | Description | Selected |
|--------|-------------|----------|
| Sinking funds only; EF section added in P5 | No dead UI; EF math isn't wired until P5 | ✓ |
| Stub an EF placeholder section | Looks complete but ships non-functional UI | |

### Fund display
| Option | Description | Selected |
|--------|-------------|----------|
| Card per fund + progress bar + Add-fund form | Proves SC#5/EXP-05 (new instance, zero code) directly | ✓ |
| Compact list rows | Denser but less progress feedback | |

---

## Claude's Discretion

- Exact `ExpenseItem` / `SinkingFund` type shape within the chosen enum + field decisions.
- Schema migration v2→v3 mechanics (Dexie `.version(3)` + `MIGRATIONS[2]`, pure-function shared with JSON import).
- Seed implementation (first-run flag vs idempotent seed-if-empty) — must not clobber edits.
- `/expenses` + `/funds` form UX and progress-bar visuals within UI principles + existing primitives.

## Deferred Ideas

- CC / itemized statement paste-parse adapter → Phase 5 (re-scoped from Phase 3).
- Checking↔credit-card reconciliation (transfer-not-expense trap) → Phase 5.
- `Account` `credit` enum + account-balance wiring → Phase 5.
- Discretionary-food gating UI + soft caps → Phase 4/5.
- Emergency-fund progress section on `/funds` → Phase 5.

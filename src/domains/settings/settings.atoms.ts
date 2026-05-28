// Settings domain — Jotai atoms.
//
// Phase 1 uses PLAIN async atoms, NOT atomWithObservable (liveQuery). React 19
// has a known re-suspension bug with atomWithObservable (RESEARCH.md Pitfall 1).
// Phase 1's Settings/Backup surfaces don't need cross-tab live reactivity, so
// the simpler async-atom + manual refresh pattern is correct here. Reactive
// liveQuery is reserved for Phase 2's dashboard.
//
// Boundary: this file imports from '../../storage/storage' (the public
// abstraction), NEVER from '../../storage/db' (the Dexie implementation).
// Per D-05, domain code never imports Dexie directly.

import { atom } from 'jotai'
import * as storage from '../../storage/storage'
import type { Floors } from '../../storage/schema'

// Internal counter atom — incrementing it invalidates floorsLoadAtom and
// forces a refetch from the storage abstraction. Standard Jotai
// atom-with-refresh pattern without needing atomFamily / atom-with-reset.
const refreshCounterAtom = atom(0)

// Async read atom. Subscribes to refreshCounterAtom so each saveFloorsAtom
// write re-runs the loader and emits the freshly-persisted value.
export const floorsLoadAtom = atom(async (get): Promise<Floors> => {
  get(refreshCounterAtom)
  return storage.getFloors()
})

// Write-only atom. Persists via storage abstraction, then bumps the refresh
// counter so any subscriber of floorsLoadAtom or derivedSurvivalFloorAtom
// recomputes on the next read.
export const saveFloorsAtom = atom(null, async (_get, set, newFloors: Floors): Promise<void> => {
  await storage.saveFloors(newFloors)
  set(refreshCounterAtom, (n) => n + 1)
})

// Derived survival floor. Phase 1 placeholder: equals passive floor. Phase 3
// will compute fixed_ex_food + protected_food_floor per spec §4e. Per FOUND-06
// this is NEVER persisted — always recomputed from input atoms.
export const derivedSurvivalFloorAtom = atom(async (get): Promise<number> => {
  const floors = await get(floorsLoadAtom)
  return floors.passive
})

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { createStore } from 'jotai'
import {
  floorsLoadAtom,
  saveFloorsAtom,
  derivedSurvivalFloorAtom,
} from '../domains/settings/settings.atoms'
import { DEFAULT_FLOORS, type Floors } from '../storage/schema'
import * as storage from '../storage/storage'

beforeEach(async () => {
  await Dexie.delete('BudgetApp')
})

describe('floors atom (FOUND-05)', () => {
  it('floorsLoadAtom returns DEFAULT_FLOORS when settings row absent', async () => {
    const store = createStore()
    const floors = await store.get(floorsLoadAtom)
    expect(floors).toEqual(DEFAULT_FLOORS)
  })

  it('floorsLoadAtom returns persisted value when settings row exists', async () => {
    const persisted: Floors = { passive: 2750, defended: 3100, foodSeed: 575 }
    await storage.saveFloors(persisted)

    const store = createStore()
    const floors = await store.get(floorsLoadAtom)
    expect(floors).toEqual(persisted)
  })

  it('saveFloorsAtom writes through storage AND triggers floorsLoadAtom refresh', async () => {
    const store = createStore()
    // First read populates the atom from DEFAULT_FLOORS (DB empty).
    await store.get(floorsLoadAtom)

    const next: Floors = { passive: 2999, defended: 3001, foodSeed: 551 }
    await store.set(saveFloorsAtom, next)

    const after = await store.get(floorsLoadAtom)
    expect(after).toEqual(next)
  })
})

describe('derived recompute (FOUND-06)', () => {
  it('derivedSurvivalFloorAtom equals floors.passive (Phase 1 placeholder)', async () => {
    const store = createStore()
    const survival = await store.get(derivedSurvivalFloorAtom)
    expect(survival).toBe(DEFAULT_FLOORS.passive)
  })

  it('derivedSurvivalFloorAtom recomputes when floors change (FOUND-06 proof)', async () => {
    const store = createStore()
    // Prime atom
    const before = await store.get(derivedSurvivalFloorAtom)
    expect(before).toBe(DEFAULT_FLOORS.passive)

    const next: Floors = { passive: 2850, defended: 3010, foodSeed: 555 }
    await store.set(saveFloorsAtom, next)

    const after = await store.get(derivedSurvivalFloorAtom)
    expect(after).toBe(2850)
    expect(after).not.toBe(DEFAULT_FLOORS.passive)
  })
})

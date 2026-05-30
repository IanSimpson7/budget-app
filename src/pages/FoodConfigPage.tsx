// FoodConfigPage — /food/config route.
// C1-CRITICAL: This surface is framed STRICTLY as accuracy/convergence tooling.
// Heading: "Meal cost configuration" — NOT "Adjust food budget" or "Food spending controls".
// Edits raise or refine the computed floor; there is NO downward affordance.
//
// Tables:
//   Table A — Meal definitions (Decomposed / Flat cost; stub rows flagged)
//   Table B — Unit-cost map (Ingredient | Tag | Unit | Cost/unit)
//            I-05: NEW rows default Tag to "macro-bearing" — never "flavor-condiment"
//            EDGE-03: cost=0 rows styled with warning + visible text flag
//   Table C — Portion model (macro-bearing ingredients only)
// FOOD-13: lastRefinedFromReceipts timestamp + "Mark refined today" button (timestamp only)
//
// C1 NEVER-USE: "Cut food spending" / "Reduce food budget" / "Save on food" / "Trim food costs"

import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  mealDefinitionsAtom,
  unitCostMapAtom,
  portionModelAtom,
  foodFloorMetaAtom,
  saveUnitCostMapAtom,
  savePortionModelAtom,
  saveMealDefinitionAtom,
  updateMealDefinitionAtom,
  deleteMealDefinitionAtom,
  saveFoodFloorMetaAtom,
} from '../domains/food/food.atoms'
import type { MealDefinition, UnitCostEntry, PortionEntry, IngredientTag } from '../domains/food/food.types'
import NumberInput from '../components/NumberInput'
import SelectInput from '../components/SelectInput'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import DestructiveButton from '../components/DestructiveButton'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDate(iso: string | null): string {
  if (!iso) return 'Not yet recorded'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

const TAG_OPTIONS = [
  { value: 'macro-bearing', label: 'Macro-bearing' },
  { value: 'flavor-condiment', label: 'Flavor / condiment' },
]

// ── Table A: Meal definitions ──────────────────────────────────────────────────

type MealRowProps = {
  meal: MealDefinition
  onDelete: (id: number) => void
  onUpdate: (id: number, patch: Partial<MealDefinition>) => void
}

function MealRow({ meal, onDelete, onUpdate }: MealRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [editingCost, setEditingCost] = useState(false)
  const [cost, setCost] = useState(meal.flatCost ?? 0)

  const isStub = meal.type === 'decomposed' && meal.ingredients.length === 0
  const isFlatUnset = meal.type === 'flat-cost' && (meal.flatCost == null || meal.flatCost === 0)

  if (confirming) {
    return (
      <tr className="bg-surface-raised">
        <td colSpan={4} className="p-sp-3">
          <div className="flex flex-col gap-sp-2">
            <span className="font-sans text-sm text-text-secondary">
              Delete &lsquo;{meal.mealName}&rsquo;? This removes it from the floor calculation.
            </span>
            <div className="flex gap-sp-2">
              <DestructiveButton
                onClick={() => {
                  if (meal.id != null) onDelete(meal.id)
                }}
              >
                Yes, delete
              </DestructiveButton>
              <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-surface-border ${isStub || isFlatUnset ? 'bg-warning bg-opacity-10 border-l-2 border-l-warning' : 'bg-surface-raised'}`}>
      <th scope="row" className="p-sp-3 font-sans text-sm text-text-primary text-left">
        {meal.mealName}
        {(isStub || isFlatUnset) && (
          <span className="ml-sp-2 font-sans text-xs text-warning">
            {isStub ? '— Needs ingredients' : '— Needs cost'}
          </span>
        )}
      </th>
      <td className="p-sp-3">
        <span
          className={`font-sans text-xs rounded-sm px-sp-2 py-sp-1 ${
            meal.type === 'decomposed'
              ? 'bg-success bg-opacity-10 border border-success text-success'
              : 'text-text-secondary border border-surface-border'
          }`}
        >
          {meal.type === 'decomposed' ? 'Decomposed' : 'Flat cost'}
        </span>
        {isStub && (
          <span className="ml-sp-2 font-sans text-xs bg-warning bg-opacity-10 border border-warning text-warning rounded-sm px-sp-2 py-sp-1">
            Needs ingredients
          </span>
        )}
      </td>
      <td className="p-sp-3">
        {meal.type === 'decomposed' ? (
          <span className="font-sans text-sm text-text-secondary">
            {meal.ingredients.length > 0 ? meal.ingredients.join(', ') : '—'}
          </span>
        ) : editingCost ? (
          <div className="flex items-center gap-sp-2">
            <NumberInput
              id={`meal-cost-${meal.id}`}
              label=""
              value={cost}
              onChange={setCost}
              className="w-[120px]"
            />
            <PrimaryButton
              onClick={() => {
                if (meal.id != null) onUpdate(meal.id, { flatCost: cost })
                setEditingCost(false)
              }}
            >
              Save
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditingCost(false)}>Cancel</SecondaryButton>
          </div>
        ) : (
          <div className="flex items-center gap-sp-2">
            <span className="font-mono text-sm text-text-primary">
              {meal.flatCost != null && meal.flatCost > 0
                ? currency.format(meal.flatCost)
                : <span className="text-warning">Not set</span>
              }
            </span>
            {meal.type === 'flat-cost' && (
              <SecondaryButton onClick={() => setEditingCost(true)}>
                Edit cost
              </SecondaryButton>
            )}
          </div>
        )}
      </td>
      <td className="p-sp-3">
        <DestructiveButton onClick={() => setConfirming(true)}>Delete</DestructiveButton>
      </td>
    </tr>
  )
}

type TableAProps = {
  meals: MealDefinition[]
  onDelete: (id: number) => void
  onUpdate: (id: number, patch: Partial<MealDefinition>) => void
  onAdd: () => void
}

function TableA({ meals, onDelete, onUpdate, onAdd }: TableAProps) {
  return (
    <div className="flex flex-col gap-sp-3">
      <h3 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Meal definitions
      </h3>
      {meals.length === 0 ? (
        <div className="flex flex-col gap-sp-2">
          <p className="font-sans text-sm font-semibold text-text-primary">No meal definitions yet</p>
          <p className="font-sans text-sm text-text-secondary">
            Add your first meal definition to start computing the protected food floor.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="table-a-meal-definitions"
            className="w-full border-collapse border border-surface-border rounded-sm"
          >
            <thead>
              <tr className="border-b border-surface-border">
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Meal name
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Type
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Cost / Ingredients
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {meals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <PrimaryButton onClick={onAdd}>Add meal definition</PrimaryButton>
      </div>
    </div>
  )
}

// ── Table B: Unit-cost map ────────────────────────────────────────────────────
// I-05: NEW ingredient rows MUST default tag to "macro-bearing".
// EDGE-03: cost=0 rows styled with warning + visible text flag.

type IngredientRowProps = {
  entry: UnitCostEntry & { _isNew?: boolean }
  onSave: (updated: UnitCostEntry) => void
  onDelete: (name: string) => void
}

function IngredientRow({ entry, onSave, onDelete }: IngredientRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [cost, setCost] = useState(entry.costPerUnit)
  const [tag, setTag] = useState<IngredientTag>(entry.tag)
  const [editing, setEditing] = useState(entry._isNew ?? false)

  const isUnpriced = entry.costPerUnit === 0 || entry.costPerUnit == null

  if (confirming) {
    return (
      <tr className="bg-surface-raised">
        <td colSpan={5} className="p-sp-3">
          <div className="flex flex-col gap-sp-2">
            <span className="font-sans text-sm text-text-secondary">
              Delete &lsquo;{entry.ingredientName}&rsquo;? Any meal using this ingredient will need rechecking.
            </span>
            <div className="flex gap-sp-2">
              <DestructiveButton onClick={() => onDelete(entry.ingredientName)}>
                Yes, delete
              </DestructiveButton>
              <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  if (editing) {
    return (
      <tr
        className={`border-b border-surface-border border border-accent bg-surface-raised`}
      >
        <th scope="row" className="p-sp-3 font-sans text-sm text-text-primary text-left">
          {entry.ingredientName}
        </th>
        <td className="p-sp-3">
          <SelectInput
            id={`tag-${entry.ingredientName}`}
            label="Tag"
            value={tag}
            onChange={(v) => setTag(v as IngredientTag)}
            options={TAG_OPTIONS}
          />
        </td>
        <td className="p-sp-3 font-mono text-sm text-text-secondary">{entry.unit}</td>
        <td className="p-sp-3">
          <NumberInput
            id={`cost-${entry.ingredientName}`}
            label="Cost/unit"
            value={cost}
            onChange={setCost}
          />
        </td>
        <td className="p-sp-3">
          <div className="flex gap-sp-2">
            <PrimaryButton
              onClick={() => {
                onSave({ ...entry, costPerUnit: cost, tag })
                setEditing(false)
              }}
            >
              Save
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={`border-b border-surface-border ${
        isUnpriced
          ? 'bg-warning bg-opacity-10 border-l-2 border-l-warning'
          : 'bg-surface-raised'
      }`}
    >
      <th scope="row" className="p-sp-3 font-sans text-sm text-text-primary text-left">
        {entry.ingredientName}
        {isUnpriced && (
          <span className="ml-sp-2 font-sans text-xs text-warning">— Unpriced</span>
        )}
      </th>
      <td className="p-sp-3 font-sans text-xs text-text-secondary">{entry.tag}</td>
      <td className="p-sp-3 font-mono text-sm text-text-secondary">{entry.unit}</td>
      <td className="p-sp-3 font-mono text-sm text-text-primary">
        {isUnpriced
          ? <span className="text-warning font-sans text-xs">No cost set — add it in Meal config</span>
          : currency.format(entry.costPerUnit)
        }
      </td>
      <td className="p-sp-3">
        <div className="flex gap-sp-2">
          <SecondaryButton onClick={() => setEditing(true)}>Edit</SecondaryButton>
          <DestructiveButton onClick={() => setConfirming(true)}>Delete</DestructiveButton>
        </div>
      </td>
    </tr>
  )
}

type TableBProps = {
  entries: UnitCostEntry[]
  onUpdateAll: (updated: UnitCostEntry[]) => void
  onAdd: () => void
  newRowActive: boolean
  newRow: UnitCostEntry | null
  onNewRowChange: (row: UnitCostEntry) => void
  onNewRowSave: () => void
  onNewRowCancel: () => void
  meta: { lastRefinedFromReceipts: string | null }
  onMarkRefined: () => void
}

function TableB({
  entries,
  onUpdateAll,
  onAdd,
  newRowActive,
  newRow,
  onNewRowChange,
  onNewRowSave,
  onNewRowCancel,
  meta,
  onMarkRefined,
}: TableBProps) {
  function handleSave(updated: UnitCostEntry) {
    const next = entries.map((e) =>
      e.ingredientName === updated.ingredientName ? updated : e,
    )
    onUpdateAll(next)
  }

  function handleDelete(name: string) {
    onUpdateAll(entries.filter((e) => e.ingredientName !== name))
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <h3 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Unit-cost map
      </h3>
      {entries.length === 0 && !newRowActive ? (
        <div className="flex flex-col gap-sp-2">
          <p className="font-sans text-sm font-semibold text-text-primary">
            No ingredients in the cost map
          </p>
          <p className="font-sans text-sm text-text-secondary">
            Add ingredients and their unit costs. The floor seeds at $550/mo until costs are entered.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="table-b-unit-cost-map"
            className="w-full border-collapse border border-surface-border rounded-sm"
          >
            <thead>
              <tr className="border-b border-surface-border">
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Ingredient
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Tag
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Unit
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Cost/unit
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <IngredientRow
                  key={entry.ingredientName}
                  entry={entry}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
              {newRowActive && newRow && (
                <tr
                  data-testid="new-ingredient-row"
                  className="border-b border-surface-border border border-accent bg-surface-raised"
                >
                  <td className="p-sp-3">
                    <input
                      type="text"
                      placeholder="Ingredient name"
                      value={newRow.ingredientName}
                      onChange={(e) => onNewRowChange({ ...newRow, ingredientName: e.target.value })}
                      className="bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-sp-3 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="p-sp-3">
                    {/* I-05: default is macro-bearing — Ian opts INTO flavor-condiment explicitly */}
                    <select
                      aria-label="Tag"
                      value={newRow.tag}
                      onChange={(e) => onNewRowChange({ ...newRow, tag: e.target.value as IngredientTag })}
                      className="bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-sp-3 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <option value="macro-bearing">Macro-bearing</option>
                      <option value="flavor-condiment">Flavor / condiment</option>
                    </select>
                  </td>
                  <td className="p-sp-3">
                    <input
                      type="text"
                      placeholder="Unit (e.g. lb)"
                      value={newRow.unit}
                      onChange={(e) => onNewRowChange({ ...newRow, unit: e.target.value })}
                      className="bg-surface-raised text-text-primary font-sans text-sm border border-surface-border rounded-sm min-h-[44px] px-sp-3 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="p-sp-3">
                    <NumberInput
                      id="new-ingredient-cost"
                      label="Cost/unit"
                      value={newRow.costPerUnit}
                      onChange={(v) => onNewRowChange({ ...newRow, costPerUnit: v })}
                    />
                  </td>
                  <td className="p-sp-3">
                    <div className="flex gap-sp-2">
                      <PrimaryButton
                        onClick={onNewRowSave}
                        disabled={!newRow.ingredientName.trim() || !newRow.unit.trim()}
                      >
                        Save
                      </PrimaryButton>
                      <SecondaryButton onClick={onNewRowCancel}>Cancel</SecondaryButton>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* FOOD-13: lastRefinedFromReceipts timestamp */}
      <div className="flex items-center gap-sp-3 flex-wrap">
        <span className="font-sans text-xs text-text-secondary">
          Last refined from receipts: {formatDate(meta.lastRefinedFromReceipts)}
        </span>
        <SecondaryButton onClick={onMarkRefined}>Mark refined today</SecondaryButton>
      </div>
      <div>
        <PrimaryButton onClick={onAdd}>Add ingredient</PrimaryButton>
      </div>
    </div>
  )
}

// ── Table C: Portion model ────────────────────────────────────────────────────
// Only macro-bearing ingredients; portions are global per ingredient (D-03).

type PortionRowProps = {
  entry: PortionEntry
  unit: string
  onSave: (updated: PortionEntry) => void
  onDelete: (name: string) => void
}

function PortionRow({ entry, unit, onSave, onDelete }: PortionRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [portion, setPortion] = useState(entry.portionSize)

  if (confirming) {
    return (
      <tr className="bg-surface-raised">
        <td colSpan={4} className="p-sp-3">
          <div className="flex flex-col gap-sp-2">
            <span className="font-sans text-sm text-text-secondary">
              Remove portion for &lsquo;{entry.ingredientName}&rsquo;?
            </span>
            <div className="flex gap-sp-2">
              <DestructiveButton onClick={() => onDelete(entry.ingredientName)}>
                Yes, delete
              </DestructiveButton>
              <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-surface-border ${editing ? 'border border-accent' : ''} bg-surface-raised`}>
      <th scope="row" className="p-sp-3 font-sans text-sm text-text-primary text-left">
        {entry.ingredientName}
      </th>
      <td className="p-sp-3">
        {editing ? (
          <NumberInput
            id={`portion-${entry.ingredientName}`}
            label="Portion"
            value={portion}
            onChange={setPortion}
          />
        ) : (
          <span className="font-mono text-sm text-text-primary">{entry.portionSize}</span>
        )}
      </td>
      <td className="p-sp-3 font-mono text-sm text-text-secondary">{unit}</td>
      <td className="p-sp-3">
        {editing ? (
          <div className="flex gap-sp-2">
            <PrimaryButton
              onClick={() => {
                onSave({ ...entry, portionSize: portion })
                setEditing(false)
              }}
            >
              Save
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        ) : (
          <div className="flex gap-sp-2">
            <SecondaryButton onClick={() => setEditing(true)}>Edit</SecondaryButton>
            <DestructiveButton onClick={() => setConfirming(true)}>Delete</DestructiveButton>
          </div>
        )}
      </td>
    </tr>
  )
}

type TableCProps = {
  portions: PortionEntry[]
  unitCostMap: UnitCostEntry[]
  onUpdateAll: (updated: PortionEntry[]) => void
}

function TableC({ portions, unitCostMap, onUpdateAll }: TableCProps) {
  // Only macro-bearing ingredients (D-03 union of macro-bearing from meal defs)
  const macroBearingNames = unitCostMap
    .filter((e) => e.tag === 'macro-bearing')
    .map((e) => e.ingredientName)

  const macroBearingPortions = portions.filter((p) =>
    macroBearingNames.includes(p.ingredientName),
  )

  function handleSave(updated: PortionEntry) {
    const existing = portions.find((p) => p.ingredientName === updated.ingredientName)
    if (existing) {
      onUpdateAll(portions.map((p) => p.ingredientName === updated.ingredientName ? updated : p))
    } else {
      onUpdateAll([...portions, updated])
    }
  }

  function handleDelete(name: string) {
    onUpdateAll(portions.filter((p) => p.ingredientName !== name))
  }

  function getUnit(name: string): string {
    return unitCostMap.find((e) => e.ingredientName === name)?.unit ?? '—'
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <h3 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Portion model
      </h3>
      {macroBearingPortions.length === 0 ? (
        <p className="font-sans text-sm text-text-secondary">
          No macro-bearing ingredients with portions yet. Add ingredients in the unit-cost map first.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            data-testid="table-c-portion-model"
            className="w-full border-collapse border border-surface-border rounded-sm"
          >
            <thead>
              <tr className="border-b border-surface-border">
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Ingredient
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Portion
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Unit
                </th>
                <th scope="col" className="p-sp-3 font-sans text-xs font-semibold text-text-secondary text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {macroBearingPortions.map((p) => (
                <PortionRow
                  key={p.ingredientName}
                  entry={p}
                  unit={getUnit(p.ingredientName)}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── FoodConfigPage ─────────────────────────────────────────────────────────────

export default function FoodConfigPage() {
  const mealDefinitions = useAtomValue(mealDefinitionsAtom)
  const unitCostMap = useAtomValue(unitCostMapAtom)
  const portionModel = useAtomValue(portionModelAtom)
  const foodFloorMeta = useAtomValue(foodFloorMetaAtom)

  const saveMealDef = useSetAtom(saveMealDefinitionAtom)
  const updateMealDef = useSetAtom(updateMealDefinitionAtom)
  const deleteMealDef = useSetAtom(deleteMealDefinitionAtom)
  const saveUnitCostMap = useSetAtom(saveUnitCostMapAtom)
  const savePortionModel = useSetAtom(savePortionModelAtom)
  const saveFoodFloorMeta = useSetAtom(saveFoodFloorMetaAtom)

  // New ingredient row state (I-05: default tag MUST be macro-bearing)
  const [newIngredientActive, setNewIngredientActive] = useState(false)
  const [newIngredient, setNewIngredient] = useState<UnitCostEntry>({
    ingredientName: '',
    costPerUnit: 0,
    unit: '',
    tag: 'macro-bearing', // I-05: ALWAYS default macro-bearing — never flavor-condiment
  })

  // Resolve async atoms (they return the resolved value synchronously after Suspense)
  const meals = Array.isArray(mealDefinitions) ? mealDefinitions : []
  const costMap = Array.isArray(unitCostMap) ? (unitCostMap as UnitCostEntry[]) : []
  const portions = Array.isArray(portionModel) ? (portionModel as PortionEntry[]) : []
  const meta = foodFloorMeta && typeof foodFloorMeta === 'object'
    ? (foodFloorMeta as { lastRefinedFromReceipts: string | null; lastComputedFloor: number; allTimeHighWater: number })
    : { lastRefinedFromReceipts: null, lastComputedFloor: 0, allTimeHighWater: 0 }

  function handleMealDelete(id: number) {
    void deleteMealDef(id)
  }

  function handleMealUpdate(id: number, patch: Partial<MealDefinition>) {
    void updateMealDef({ id, patch })
  }

  function handleAddMeal() {
    void saveMealDef({
      mealName: 'New meal',
      type: 'decomposed',
      ingredients: [],
    })
  }

  function handleUnitCostUpdateAll(updated: UnitCostEntry[]) {
    void saveUnitCostMap(updated)
  }

  function handleAddIngredient() {
    setNewIngredientActive(true)
    // I-05: always reset to macro-bearing when opening a new row
    setNewIngredient({ ingredientName: '', costPerUnit: 0, unit: '', tag: 'macro-bearing' })
  }

  function handleNewIngredientSave() {
    if (!newIngredient.ingredientName.trim() || !newIngredient.unit.trim()) return
    const updated = [...costMap, newIngredient]
    void saveUnitCostMap(updated)
    setNewIngredientActive(false)
    setNewIngredient({ ingredientName: '', costPerUnit: 0, unit: '', tag: 'macro-bearing' })
  }

  function handleNewIngredientCancel() {
    setNewIngredientActive(false)
    setNewIngredient({ ingredientName: '', costPerUnit: 0, unit: '', tag: 'macro-bearing' })
  }

  function handlePortionUpdateAll(updated: PortionEntry[]) {
    void savePortionModel(updated)
  }

  function handleMarkRefined() {
    const now = new Date().toISOString()
    void saveFoodFloorMeta({
      ...meta,
      lastRefinedFromReceipts: now,
    })
  }

  return (
    <div className="flex flex-col gap-sp-6 max-w-[640px] mx-auto">
      {/* C1 heading — MUST read "Meal cost configuration", NOT "Adjust food budget" */}
      <h2 className="font-display text-[20px] leading-[1.2] text-text-primary">
        Meal cost configuration
      </h2>
      <p className="font-sans text-sm text-text-secondary">
        Edit these tables for accuracy. Changes recompute the protected floor immediately.
      </p>

      {/* Table A: Meal definitions */}
      <TableA
        meals={meals}
        onDelete={handleMealDelete}
        onUpdate={handleMealUpdate}
        onAdd={handleAddMeal}
      />

      {/* Table B: Unit-cost map (I-05, EDGE-03, FOOD-13) */}
      <TableB
        entries={costMap}
        onUpdateAll={handleUnitCostUpdateAll}
        onAdd={handleAddIngredient}
        newRowActive={newIngredientActive}
        newRow={newIngredient}
        onNewRowChange={setNewIngredient}
        onNewRowSave={handleNewIngredientSave}
        onNewRowCancel={handleNewIngredientCancel}
        meta={meta}
        onMarkRefined={handleMarkRefined}
      />

      {/* Table C: Portion model */}
      <TableC
        portions={portions}
        unitCostMap={costMap}
        onUpdateAll={handlePortionUpdateAll}
      />
    </div>
  )
}

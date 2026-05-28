// ConfirmTable — editable parsed-row table for the paste-parse confirm step.
// UI-SPEC §Paste & Parse Tab — confirm table structure, row states, a11y.
//
// Controlled via rows / onChange props — no local state, no I/O.
// Security T-02-X: React auto-escapes all JSX text; no dangerouslySetInnerHTML.
// Tokens only (no inline hex). min-h-[44px] on every interactive element.
import type { CandidateRow } from './income.types'
import type { Category } from './income.types'

type Props = {
  rows: CandidateRow[]
  onChange: (rows: CandidateRow[]) => void
}

const CATEGORIES: Category[] = ['payroll', 'gift', 'other']

function updateRow(rows: CandidateRow[], idx: number, patch: Partial<CandidateRow>): CandidateRow[] {
  return rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
}

export default function ConfirmTable({ rows, onChange }: Props) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-sm overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {/* Checkbox col — no header text */}
            <th
              scope="col"
              className="w-[44px] font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2"
            />
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-left whitespace-nowrap"
            >
              Date
            </th>
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-right whitespace-nowrap"
            >
              Amount
            </th>
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-left whitespace-nowrap"
            >
              Source
            </th>
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-left whitespace-nowrap"
            >
              Category
            </th>
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-center whitespace-nowrap"
            >
              Tax
            </th>
            <th
              scope="col"
              className="font-sans text-xs font-semibold text-text-secondary uppercase tracking-wide px-sp-2 py-sp-2 text-left whitespace-nowrap"
            >
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const dim = !row.checked
            const amountClass = row.isCredit
              ? dim
                ? 'text-text-disabled font-mono text-sm tabular-nums'
                : 'text-success font-mono text-sm tabular-nums'
              : 'text-text-secondary font-mono text-sm tabular-nums'
            const textClass = dim ? 'text-text-disabled' : 'text-text-primary'

            return (
              <tr key={idx} className="border-t border-surface-border">
                {/* Checkbox */}
                <td className="px-sp-2 py-sp-1">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) =>
                      onChange(updateRow(rows, idx, { checked: e.target.checked }))
                    }
                    className="min-h-[44px] w-[44px] cursor-pointer accent-accent"
                    aria-label={`Select row ${idx + 1}`}
                  />
                </td>

                {/* Date — read-only */}
                <td className={`px-sp-2 py-sp-1 font-mono text-sm whitespace-nowrap ${textClass}`}>
                  {row.date ?? '—'}
                </td>

                {/* Amount — read-only */}
                <td className={`px-sp-2 py-sp-1 text-right whitespace-nowrap ${amountClass}`}>
                  {row.netAmount !== undefined
                    ? (row.isCredit ? '+' : '') + row.netAmount.toFixed(2)
                    : '—'}
                </td>

                {/* Source — inline editable */}
                <td className="px-sp-2 py-sp-1">
                  <input
                    type="text"
                    value={row.source ?? ''}
                    onChange={(e) => onChange(updateRow(rows, idx, { source: e.target.value }))}
                    className={`min-h-[44px] w-full min-w-[120px] bg-transparent border-b border-surface-border font-sans text-sm px-sp-1 focus:outline-none focus:border-accent ${textClass}`}
                    aria-label={`Source for row ${idx + 1}`}
                  />
                </td>

                {/* Category select */}
                <td className="px-sp-2 py-sp-1">
                  <select
                    value={row.category}
                    onChange={(e) =>
                      onChange(
                        updateRow(rows, idx, { category: e.target.value as Category }),
                      )
                    }
                    className={`min-h-[44px] font-sans text-sm bg-surface-raised border border-surface-border rounded-sm px-sp-2 focus:outline-none focus:border-accent ${textClass}`}
                    aria-label={`Category for row ${idx + 1}`}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Taxable checkbox */}
                <td className="px-sp-2 py-sp-1 text-center">
                  <input
                    type="checkbox"
                    checked={row.taxable}
                    onChange={(e) =>
                      onChange(updateRow(rows, idx, { taxable: e.target.checked }))
                    }
                    className="min-h-[44px] w-[44px] cursor-pointer accent-accent"
                    aria-label={`Taxable for row ${idx + 1}`}
                  />
                </td>

                {/* Note — truncated, non-editable */}
                <td
                  className={`px-sp-2 py-sp-1 font-sans text-xs max-w-[160px] truncate ${dim ? 'text-text-disabled' : 'text-text-secondary'}`}
                  title={row.note ?? row.raw}
                >
                  {(row.note ?? row.raw).slice(0, 40)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

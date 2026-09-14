import type { ReactNode } from 'react'

/**
 * Every chart's numbers as a real table, behind a disclosure. The text
 * alternative for charts (WCAG 1.1.1): screen readers and keyboard users get
 * the values without depending on hover tooltips.
 */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: ReactNode[][]
}) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-ink-2 hover:text-white">
        Show the data as a table
      </summary>
      <div className="custom-scroll mt-2 max-h-80 overflow-auto rounded-md border border-edge">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2 text-ink">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge text-ink-2">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-3 py-1.5 font-normal text-ink">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-3 py-1.5 tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

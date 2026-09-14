'use client'

import { useMemo } from 'react'
import { DataTable } from './DataTable'
import { Tooltip, useTooltip } from './Tooltip'

/**
 * A small month calendar per month played, each day shaded by hours against
 * that month's busiest day. Days are UTC, as the source totals are.
 */

const DAY = 86_400_000
const empty = 'rgba(55, 65, 81, 0.3)'
const shade = (ms: number, max: number) =>
  ms > 0 ? `rgba(239, 68, 68, ${max > 0 ? 0.2 + (0.8 * ms) / max : 0.1})` : empty

export function PlaytimeCalendar({
  daily,
  firstSeen,
  showEmpty,
  now,
}: {
  daily: Map<number, number>
  firstSeen: number | null
  showEmpty: boolean
  now: number
}) {
  const { tip, bind } = useTooltip()

  const months = useMemo(() => {
    const byMonth = new Map<number, { days: Map<number, number>; max: number }>()
    const month = (y: number, m: number) => {
      const key = Date.UTC(y, m, 1)
      if (!byMonth.has(key)) byMonth.set(key, { days: new Map(), max: 0 })
      return byMonth.get(key)!
    }
    for (const [day, ms] of daily) {
      const d = new Date(day)
      const entry = month(d.getUTCFullYear(), d.getUTCMonth())
      entry.days.set(d.getUTCDate(), ms)
      entry.max = Math.max(entry.max, ms)
    }
    if (showEmpty && firstSeen) {
      const start = new Date(firstSeen)
      for (
        let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        cursor.getTime() <= now;
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      )
        month(cursor.getUTCFullYear(), cursor.getUTCMonth())
    }
    return [...byMonth].sort(([a], [b]) => a - b)
  }, [daily, firstSeen, showEmpty, now])

  return (
    <div className="min-h-[400px] w-full">
      <div className="mb-4 flex items-center justify-center gap-2 text-xs text-ink-3">
        <span>Less</span>
        {[0.1, 0.4, 0.6, 0.8, 1].map((opacity) => (
          <span
            key={opacity}
            className="size-3.5 rounded-sm"
            style={{ background: `rgba(239,68,68,${opacity})` }}
          />
        ))}
        <span>More</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {months.map(([key, { days, max }]) => {
          const d = new Date(key)
          const inMonth = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
          ).getUTCDate()
          return (
            <div key={key} className="rounded-lg bg-surface-2/30 p-1">
              <h4 className="mb-1 truncate text-center text-xs font-bold text-ink-2">
                {d.toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </h4>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: d.getUTCDay() }, (_, i) => (
                  <span key={`pad${i}`} />
                ))}
                {Array.from({ length: inMonth }, (_, i) => {
                  const ms = Math.min(days.get(i + 1) ?? 0, DAY)
                  const date = new Date(key + i * DAY).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })
                  return (
                    <span
                      key={i}
                      className="aspect-square rounded-[2px]"
                      style={{ background: shade(ms, max) }}
                      {...bind(
                        <>
                          <strong>{date}</strong>
                          <br />
                          {(ms / 3_600_000).toFixed(1)}h
                        </>,
                      )}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <DataTable
        caption="Hours played per day, UTC"
        columns={['Day (UTC)', 'Hours']}
        rows={[...daily]
          .sort(([a], [b]) => a - b)
          .map(([day, ms]) => [
            new Date(day).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }),
            (Math.min(ms, DAY) / 3_600_000).toFixed(1),
          ])}
      />
      <Tooltip tip={tip} />
    </div>
  )
}

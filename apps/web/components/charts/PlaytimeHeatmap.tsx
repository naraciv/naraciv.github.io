'use client'

import { useMemo, useState } from 'react'
import { clip, heatColor, heatmap, logOnChance, monthTicks, type Session } from '@nara/lib'
import { RangeSlider } from './RangeSlider'
import { DataTable } from './DataTable'
import { Tooltip, useTooltip } from './Tooltip'

/**
 * Hour-of-week heatmap in the viewer's local time, over a chosen date range.
 * Three readings: share of total playtime, total hours, or the chance they
 * are online in that hour in a typical active week.
 */

export type HeatmapMode = 'percent' | 'total' | 'chance'

const DAY = 86_400_000
const TWO_MONTHS = 60 * DAY
const monthYear = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export function PlaytimeHeatmap({ sessions, mode }: { sessions: Session[]; mode: HeatmapMode }) {
  const { tip, bind } = useTooltip()
  const first = sessions[0]?.login ?? 0
  const last = sessions.at(-1)?.logout ?? 0

  /* Until the viewer moves the slider, "chance" looks at the last two months —
     how someone plays now — and the other modes at everything. */
  const [chosen, setChosen] = useState<[number, number] | null>(null)

  const { range, grid, max, total, weeks } = useMemo(() => {
    const range: [number, number] = chosen ?? [
      mode === 'chance' ? Math.max(first, last - TWO_MONTHS) : first,
      last,
    ]
    const inRange = clip(sessions, range[0], range[1])
    const minutes = heatmap(inRange)
    const chance = logOnChance(inRange)
    const shown = mode === 'chance' ? chance.grid : minutes
    return {
      range,
      grid: shown,
      max: Math.max(...shown.flat()),
      total: minutes.flat().reduce((a, b) => a + b, 0),
      weeks: chance.weeks,
    }
  }, [sessions, first, last, chosen, mode])

  const labels = useMemo(() => {
    const use12h = /[ap]/i.test(
      new Date(2000, 0, 1, 13).toLocaleTimeString(undefined, { hour: 'numeric' }),
    )
    return {
      days: Array.from({ length: 7 }, (_, i) =>
        new Date(2000, 0, 2 + i).toLocaleDateString(undefined, { weekday: 'short' }),
      ),
      hours: Array.from({ length: 24 }, (_, h) =>
        new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', hour12: use12h }),
      ),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    }
  }, [])

  if (!sessions.length)
    return <p className="py-20 text-center text-ink-3">No heatmap data available.</p>

  const describe = (value: number) => {
    if (mode === 'chance') return `${Math.round(value) < 1 ? '<1' : Math.round(value)}% chance`
    if (mode === 'total')
      return `${value > 0 && value / 60 < 0.01 ? '<0.01' : (value / 60).toFixed(1)}h total`
    const pct = total ? (value / total) * 100 : 0
    return `${pct > 0 && pct < 0.1 ? '<0.1' : pct.toFixed(1)}% of total playtime`
  }

  return (
    <div className="min-h-[300px] w-full">
      <div className="mb-3 flex items-center justify-center gap-1.5 text-xs text-ink-3">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5, 6].map((step) => (
          <span
            key={step}
            className="size-3 rounded-sm"
            style={{ background: heatColor(step, 6) }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Only the grid scrolls: around the slider too, its edge tick labels overhang by a
          few px and drew a permanent scrollbar. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Heatmap, scrolls sideways"
        className="overflow-x-auto pb-1"
      >
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: '60px repeat(24, minmax(18px, 1fr))' }}
        >
          <span />
          {labels.hours.map((hour) => (
            <span key={hour} className="text-center text-[10px] text-ink-3">
              {hour}
            </span>
          ))}
          {grid.map((row, day) => [
            <span
              key={`d${day}`}
              className="flex items-center justify-end pr-1.5 text-[11px] whitespace-nowrap text-ink-2"
            >
              {labels.days[day]}
            </span>,
            ...row.map((value, hour) => (
              <span
                key={`${day}-${hour}`}
                className="flex min-h-[22px] items-center justify-center rounded-[2px]"
                style={{ background: heatColor(value, max) }}
                {...bind(
                  <>
                    <strong>
                      {labels.days[day]} {labels.hours[hour]}
                    </strong>
                    <br />
                    {describe(value)}
                  </>,
                )}
              >
                {mode === 'chance' && value > 0 && Math.round(value) < 1 && (
                  <span className="text-[9px] text-[#f87171]">&lt;1%</span>
                )}
              </span>
            )),
          ])}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">
        Times shown in your local timezone ({labels.zone})
      </p>

      <RangeSlider
        label="Heatmap date range"
        min={first}
        max={last}
        step={DAY}
        value={range}
        onChange={setChosen}
        ticks={monthTicks(first, last)}
        format={monthYear}
      />

      {mode === 'chance' && (
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          <strong className="text-ink-2">How this is calculated:</strong> Only weeks within the
          selected range where the player logged at least 5 hours are included ({weeks} qualifying
          week{weeks === 1 ? '' : 's'}). For each time slot, the chance is:{' '}
          <em>weeks played during this hour ÷ total qualifying weeks × 100</em>.
        </p>
      )}
      <DataTable
        caption={`Heatmap by weekday and hour, ${labels.zone}`}
        columns={['Day', ...labels.hours]}
        rows={grid.map((row, day) => [labels.days[day], ...row.map(describe)])}
      />
      <Tooltip tip={tip} />
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthTicks, type Point } from '@nara/lib'
import { DataTable } from './DataTable'
import { RangeSlider } from './RangeSlider'

/**
 * Hours per day or per week as bars, with a range slider to zoom.
 *
 * Recharts, for its accessibility layer: the chart takes focus and the arrow
 * keys step through the bars with the tooltip following.
 */

export type Granularity = 'daily' | 'weekly'

const DAY = 86_400_000

const utcDate = (t: number, opts: Intl.DateTimeFormatOptions) =>
  new Date(t).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })

const periodLabel = (date: number, granularity: Granularity) =>
  granularity === 'weekly'
    ? `${utcDate(date, { month: 'short', day: 'numeric' })} – ${utcDate(date + 6 * DAY, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : utcDate(date, { month: 'short', day: 'numeric', year: 'numeric' })

export function PlaytimeBars({
  daily,
  weekly,
  firstSeen,
  granularity,
}: {
  daily: Point[]
  weekly: Point[]
  firstSeen: number
  granularity: Granularity
}) {
  const [now] = useState(() => Date.now())
  const [range, setRange] = useState<[number, number] | null>(null)

  const data = granularity === 'daily' ? daily : weekly
  const [from, to] = range ?? [firstSeen, now]

  const { visible, yMax } = useMemo(() => {
    const cap = granularity === 'daily' ? 24 : 24 * 7
    return {
      visible: data.filter((d) => d.date >= from && d.date <= to),
      yMax: Math.ceil(Math.min(cap, Math.max(1, ...data.map((d) => d.hours)) * 1.1)),
    }
  }, [data, from, to, granularity])

  const unit = granularity === 'daily' ? 'day' : 'week'

  return (
    <div className="w-full">
      <div className="h-[350px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={visible}
            margin={{ top: 20, right: 20, bottom: 10, left: 0 }}
            accessibilityLayer
            title={`Hours played per ${unit}`}
          >
            <CartesianGrid vertical={false} stroke="rgba(75,85,99,0.35)" />
            <XAxis
              dataKey="date"
              type="number"
              scale="time"
              domain={[from, to]}
              ticks={monthTicks(from, to)}
              tickFormatter={(t: number) =>
                new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
              }
              tick={{ fill: 'var(--color-ink-2)', fontSize: 11 }}
              stroke="rgba(75,85,99,0.6)"
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={(h: number) => `${h}h`}
              tick={{ fill: 'var(--color-ink-2)', fontSize: 11 }}
              stroke="rgba(75,85,99,0.6)"
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.06)' }}
              content={(props) => <BarTip {...props} granularity={granularity} />}
            />
            <Bar dataKey="hours" fill="#ef4444" isAnimationActive={false} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <RangeSlider
        label="Chart date range"
        min={firstSeen}
        max={now}
        step={DAY}
        value={[from, to]}
        onChange={setRange}
        format={(t) =>
          new Date(t).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        }
      />
      <p className="mt-2 text-center text-xs text-ink-3">
        Drag either handle to filter the range. Focus the chart and use the arrow keys to read each
        bar.
      </p>
      <DataTable
        caption={`Hours played per ${unit}, in the selected range`}
        columns={[granularity === 'daily' ? 'Day (UTC)' : 'Week (UTC)', 'Hours']}
        rows={visible
          .filter((d) => d.hours > 0)
          .map((d) => [periodLabel(d.date, granularity), d.hours.toFixed(2)])}
      />
    </div>
  )
}

function BarTip({
  active,
  payload,
  granularity,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  granularity: Granularity
}) {
  const point = payload?.[0]?.payload as Point | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-md border border-[#374151] bg-[rgba(31,41,55,0.95)] px-3 py-1.5 text-[0.85rem] font-medium text-[#f9fafb] shadow-lg">
      <strong>{periodLabel(point.date, granularity)}</strong>
      <br />
      {point.hours.toFixed(2)} hours
    </div>
  )
}

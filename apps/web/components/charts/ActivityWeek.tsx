'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  activityWeeks,
  addLocalDays,
  localWeekStart,
  weekStartsSunday,
  type History,
} from '@nara/lib'
import { DataTable } from './DataTable'
import { Tooltip, useTooltip } from './Tooltip'

/**
 * One week of sessions as blocks on a 24-hour grid, in local time, with the
 * live session drawn in green up to now.
 */
const CHART_H = 400
const HOUR_H = CHART_H / 24

export function ActivityWeek({ history }: { history: History }) {
  const [now] = useState(() => Date.now())
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  const weeks = useMemo(
    () => activityWeeks(history, weekStartsSunday(zone), now),
    [history, zone, now],
  )
  const [chosen, setChosen] = useState<number | null>(null)
  const picker = useRef<HTMLDialogElement>(null)
  const { tip, bind } = useTooltip()

  if (!weeks.length)
    return <p className="py-20 text-center text-ink-3">No activity data available.</p>

  const index = Math.max(
    0,
    chosen === null ? weeks.length - 1 : weeks.findIndex((w) => w.start === chosen),
  )
  const week = weeks[index]
  const todayStart = localWeekStart(now, weekStartsSunday(zone))
  const today = weeks.some((w) => w.start === todayStart) ? todayStart : weeks.at(-1)!.start

  const use12h = /[ap]/i.test(
    new Date(2000, 0, 1, 13).toLocaleTimeString(undefined, { hour: 'numeric' }),
  )
  const time = (t: number) =>
    new Date(t).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: use12h,
    })
  const short = { month: 'short', day: 'numeric' } as const
  const span = (w: (typeof weeks)[number], opts: Intl.DateTimeFormatOptions = short) =>
    `${new Date(w.start).toLocaleDateString(undefined, opts)} – ${new Date(w.end - 1).toLocaleDateString(undefined, opts)}`
  const hm = (ms: number) => {
    const m = Math.round(ms / 60_000)
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }
  const navButton =
    'flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[#374151] bg-surface-2 px-3 text-sm text-ink transition-colors hover:bg-[#374151] hover:text-white disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <div className="min-h-[400px] w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous week"
            disabled={index === 0}
            onClick={() => setChosen(weeks[index - 1].start)}
            className={navButton}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => picker.current?.showModal()}
            aria-label="Pick a week"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-[#e5e7eb] transition-colors hover:bg-surface-2"
          >
            {span(week)}, {new Date(week.end - 1).getFullYear()}
          </button>
          <button
            type="button"
            aria-label="Next week"
            disabled={index === weeks.length - 1}
            onClick={() => setChosen(weeks[index + 1].start)}
            className={navButton}
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            disabled={week.start === today}
            onClick={() => setChosen(today)}
            className={`${navButton} text-xs`}
          >
            Today
          </button>
        </div>
        <span className="text-sm text-ink-2">
          {(week.totalMs / 3_600_000).toFixed(1)}h this week
        </span>
      </div>

      {/* pb-2: the bottom hour label hangs below the grid, and overflow-x would
          otherwise turn that into a vertical scrollbar. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Week chart, scrolls sideways"
        className="overflow-x-auto overflow-y-hidden pb-2"
      >
        <div
          className="grid min-w-[344px]"
          style={{ gridTemplateColumns: '55px repeat(7, minmax(40px, 1fr))' }}
        >
          <span />
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(addLocalDays(week.start, i))
            return (
              <span
                key={i}
                className="flex h-9 flex-col items-center justify-center text-[11px] leading-[18px] font-semibold text-ink-2"
              >
                <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span className="text-[10px] font-normal text-ink-3">
                  {d.toLocaleDateString(undefined, short)}
                </span>
              </span>
            )
          })}

          <div className="relative" style={{ height: CHART_H }}>
            {Array.from({ length: 13 }, (_, i) => i * 2).map((h) => (
              <span
                key={h}
                className="absolute right-1 text-[10px] leading-3 whitespace-nowrap text-ink-3"
                style={{ top: h * HOUR_H - 6 }}
              >
                {h % 24 === 0
                  ? use12h
                    ? '12:00 AM'
                    : '0:00'
                  : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: use12h,
                    })}
              </span>
            ))}
          </div>

          {Array.from({ length: 7 }, (_, i) => {
            /* Calendar days, not 24h steps: a DST day is 23 or 25 hours. */
            const dayStart = addLocalDays(week.start, i)
            const dayEnd = addLocalDays(week.start, i + 1)
            const dayMs = dayEnd - dayStart
            const block = (from: number, to: number) => ({
              top: ((Math.max(from, dayStart) - dayStart) / dayMs) * CHART_H,
              height: Math.max(
                2,
                ((Math.min(to, dayEnd) - Math.max(from, dayStart)) / dayMs) * CHART_H,
              ),
            })
            const live = history.onlineSince
            const liveHere = live !== null && live < dayEnd && Math.min(now, dayEnd) > dayStart
            return (
              <div
                key={i}
                className={`relative border-r border-edge/40 last:border-r-0 ${i % 2 ? 'bg-[rgba(31,41,55,0.3)]' : 'bg-[rgba(17,24,39,0.5)]'}`}
                style={{ height: CHART_H }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className={`absolute inset-x-0 border-t ${h % 6 ? 'border-[rgba(55,65,81,0.3)]' : 'border-[rgba(75,85,99,0.6)]'}`}
                    style={{ top: h * HOUR_H }}
                  />
                ))}
                {week.sessions
                  .filter((s) => s.login < dayEnd && s.logout > dayStart)
                  .map((s) => (
                    <span
                      key={s.login}
                      className="absolute inset-x-0.5 rounded-sm border border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.45)] transition-colors hover:bg-[rgba(239,68,68,0.7)]"
                      style={block(s.login, s.logout)}
                      {...bind(
                        <>
                          <strong>
                            {time(s.login)} – {time(s.logout)}
                          </strong>
                          <br />
                          <span className="text-ink-2">{hm(s.logout - s.login)}</span>
                        </>,
                      )}
                    />
                  ))}
                {liveHere && (
                  <>
                    <span
                      className="absolute inset-x-0.5 rounded-sm border border-[rgba(16,185,129,0.6)] bg-[rgba(16,185,129,0.4)]"
                      style={block(live, now)}
                      {...bind(
                        <>
                          <strong className="text-[#10b981]">Online since {time(live)}</strong>
                          <br />
                          <span className="text-ink-2">{hm(now - live)} so far</span>
                        </>,
                      )}
                    />
                    {now >= dayStart && now < dayEnd && (
                      <span
                        className="absolute inset-x-0 z-10 border-t-2 border-[#10b981]"
                        style={{ top: ((now - dayStart) / dayMs) * CHART_H }}
                      >
                        <span className="absolute -top-4 left-1 text-[9px] font-semibold whitespace-nowrap text-[#10b981]">
                          currently online
                        </span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-ink-3">
        Times shown in your local timezone ({zone})
      </p>

      <dialog
        ref={picker}
        onClick={(e) => e.target === picker.current && picker.current.close()}
        aria-labelledby="week-picker-title"
        className="m-auto max-h-[70vh] w-[90%] max-w-sm overflow-y-auto rounded-xl border border-edge bg-surface p-4 text-ink backdrop:bg-black/60"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="week-picker-title" className="font-bold text-white">
            Pick a Week
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={() => picker.current?.close()}
            className="text-ink-3 hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {byMonth(weeks).map(([month, list]) => (
          <div key={month} className="mb-3">
            <div className="mb-1 text-xs font-semibold text-ink-3">{month}</div>
            {list.map((w) => (
              <button
                key={w.start}
                type="button"
                autoFocus={w.start === week.start}
                onClick={() => {
                  setChosen(w.start)
                  picker.current?.close()
                }}
                className={`flex w-full justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${w.start === week.start ? 'bg-surface-2 font-semibold text-white' : 'text-ink'}`}
              >
                <span>{span(w, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span className="text-ink-2">{(w.totalMs / 3_600_000).toFixed(1)}h</span>
              </button>
            ))}
          </div>
        ))}
      </dialog>
      <DataTable
        caption={`Sessions, ${span(week)}, ${zone}`}
        columns={['Start', 'End', 'Length']}
        rows={[
          ...week.sessions.map((s) => [
            `${new Date(s.login).toLocaleDateString(undefined, { weekday: 'short', ...short })} ${time(s.login)}`,
            time(s.logout),
            hm(s.logout - s.login),
          ]),
          ...(history.onlineSince && history.onlineSince < week.end && now > week.start
            ? [[`${time(history.onlineSince)} (online now)`, '—', hm(now - history.onlineSince)]]
            : []),
        ]}
      />
      <Tooltip tip={tip} />
    </div>
  )
}

/** Newest month first, newest week first within it. Map.groupBy would do this, but not in Safari < 17.4. */
function byMonth<T extends { start: number }>(weeks: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const week of [...weeks].reverse()) {
    const month = new Date(week.start).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
    groups.set(month, [...(groups.get(month) ?? []), week])
  }
  return [...groups]
}

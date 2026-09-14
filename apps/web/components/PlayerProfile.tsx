'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  dailySeries,
  dailyTotals,
  history as toHistory,
  monthlyTotals,
  summary,
  weeklySeries,
  type History,
  type SessionsResponse,
} from '@nara/lib'
import { ButtonGroup, Switch } from '@/components/ui'
import { SkinViewer3D } from './SkinViewer3D'
import { ActivityWeek } from './charts/ActivityWeek'
import { PlaytimeBars, type Granularity } from './charts/PlaytimeBars'
import { PlaytimeCalendar } from './charts/PlaytimeCalendar'
import { PlaytimeHeatmap, type HeatmapMode } from './charts/PlaytimeHeatmap'

/**
 * A player's profile: skin, totals, four charts and a month-by-month list.
 *
 * Name casing, UUID and rank arrive from the server (see
 * app/stats/[player]/page.tsx); only the session history is fetched here,
 * because civinfo answers nara.rocks alone. The weekly activity chart is always
 * shown; the others share a selector set by `?graph_type=` (`activity` opens the
 * default).
 */

const API = 'https://api.civinfo.net'
const CHARTS = [
  ['heatmap', 'Heatmap'],
  ['calendar', 'Calendar'],
  ['bar', 'Bar'],
] as const
type Chart = (typeof CHARTS)[number][0]

const RANK_STYLE = [
  'border-[#fde68a] bg-gradient-to-br from-[#fbbf24] to-[#f59e0b]',
  'border-[#d1d5db] bg-gradient-to-br from-[#9ca3af] to-[#6b7280]',
  'border-[#fbbf24] bg-gradient-to-br from-[#d97706] to-[#b45309]',
]

const dateTime: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
}

export function PlayerProfile({
  name,
  uuid: knownUuid,
  rank,
}: {
  name: string
  uuid: string | null
  rank: number | null
}) {
  const [data, setData] = useState<History | null>(null)
  const [failed, setFailed] = useState(false)
  const [uuid, setUuid] = useState(knownUuid)
  const [chart, setChart] = useState<Chart>('heatmap')
  const [granularity, setGranularity] = useState<Granularity>('weekly')
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('percent')
  const [showEmpty, setShowEmpty] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get('graph_type')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once, after hydration
    if (CHARTS.some(([key]) => key === type)) setChart(type as Chart)
  }, [])

  /* Written on change, not in an effect: an effect wrote the default back before the
     URL was read, so shared ?graph_type= links opened on the default chart. */
  const pickChart = (next: Chart) => {
    setChart(next)
    const url = new URL(window.location.href)
    url.searchParams.set('graph_type', next)
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    let alive = true
    const mcName = encodeURIComponent(name)
    fetch(`${API}/mc-sessions/all?mcName=${mcName}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: SessionsResponse) => alive && setData(toHistory(json, now)))
      .catch((error) => {
        console.warn('[nara] civinfo history failed.', error)
        if (alive) setFailed(true)
      })
    /* Not in the server's name cache (a player newer than the last deploy). civinfo's mcName
       is case-sensitive, so find the account's exact casing — the same name, never another —
       and go there; otherwise it may just be a UUID we lack. */
    if (!knownUuid)
      fetch(`${API}/mc-accounts/all?limit=1000000`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { mcNames?: (string | null)[]; uuids?: (string | null)[] } | null) => {
          const i = json?.mcNames?.findIndex((n) => n?.toLowerCase() === name.toLowerCase()) ?? -1
          if (!alive || i < 0) return
          const exact = json!.mcNames![i]!
          if (exact !== name) window.location.replace(`/stats/${encodeURIComponent(exact)}`)
          else if (json!.uuids?.[i]) setUuid(json!.uuids[i])
        })
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [name, knownUuid, now])

  const derived = useMemo(() => {
    if (!data) return null
    const daily = dailyTotals(data.sessions)
    return {
      stats: summary(data, now),
      daily,
      dailyPoints: dailySeries(daily),
      weeklyPoints: weeklySeries(daily),
      monthly: monthlyTotals(data.sessions),
    }
  }, [data, now])

  const online = data?.onlineSince != null
  const loading = !data && !failed

  return (
    <div className="mx-auto flex w-full max-w-[95%] flex-col gap-8 py-10 lg:flex-row">
      {/* ── Sidebar ── */}
      {/* Below lg the aside dissolves (`contents`) so Sources can drop to the very bottom. */}
      <aside className="flex w-full flex-col gap-6 max-lg:contents lg:sticky lg:top-24 lg:w-1/4 lg:self-start">
        <section className="flex h-fit flex-col items-center rounded-lg border border-edge bg-surface p-6 text-center">
          <div className="relative mb-4 flex w-full justify-center">
            {rank && (
              <span
                title={`#${rank} All-Time`}
                className={`absolute top-2 left-2 z-20 flex size-8 items-center justify-center rounded-full border-2 text-sm font-extrabold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] ${
                  RANK_STYLE[rank - 1] ??
                  'border-[#4b5563] bg-gradient-to-br from-[#374151] to-[#1f2937]'
                }`}
              >
                #{rank}
              </span>
            )}
            <SkinViewer3D name={name} uuid={uuid} />
          </div>
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <span
              title={online ? 'Online' : 'Offline'}
              className={`size-2.5 shrink-0 rounded-full ${online ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#ef4444]'}`}
            />
            <span className="sr-only">{online ? 'Online' : 'Offline'}</span>
            <h1 className="text-3xl font-bold break-all text-white">{name}</h1>
          </div>

          <dl className="w-full space-y-4 text-left text-sm">
            <Field label="Total Playtime" valueClass="font-mono text-xl text-primary">
              {derived
                ? `${derived.stats.totalHours.toFixed(1)}h`
                : failed
                  ? 'Unavailable'
                  : 'Loading...'}
            </Field>
            <Field label="First Join">
              {loading
                ? 'Loading...'
                : derived?.stats.firstSeen
                  ? new Date(derived.stats.firstSeen).toLocaleString(undefined, dateTime)
                  : 'N/A'}
            </Field>
            <Field label="Last Join">
              {loading
                ? 'Loading...'
                : derived?.stats.lastSeen
                  ? new Date(derived.stats.lastSeen).toLocaleString(undefined, dateTime)
                  : 'N/A'}
            </Field>
            {derived?.stats.firstSeen &&
              (online ? (
                <Field label="Status" valueClass="font-semibold text-[#4ade80]">
                  Online
                </Field>
              ) : (
                data?.lastLogout && (
                  <Field label="Last Logout">
                    {new Date(data.lastLogout).toLocaleString(undefined, dateTime)}
                  </Field>
                )
              ))}
          </dl>
          <a
            href={`https://namemc.com/profile/${uuid ? uuid.replace(/-/g, '') : encodeURIComponent(name)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-surface-2 p-2 text-ink transition-colors hover:bg-[#374151] hover:text-white"
          >
            <ExternalLink aria-hidden className="size-4" /> NameMC Profile
          </a>
        </section>

        <section className="rounded-lg border border-edge bg-surface p-4 text-sm text-ink-2 max-lg:order-last">
          <h2 className="font-semibold text-white">Sources</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Playtime stats are provided by{' '}
            <a
              href="https://civinfo.net"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              civinfo.net
            </a>
            . Please contact <span className="font-medium">@realhusky</span> on Discord if you spot
            any data errors. Player skins are sourced from{' '}
            <a
              href="https://mc-heads.net"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              mc-heads.net
            </a>
            .
          </p>
          <p className="text-sm">Performance errors are likely my fault.</p>
        </section>
      </aside>

      {/* ── Charts: one container, divided into weekly activity, the chart picker and months ── */}
      <div className="w-full divide-y divide-edge rounded-lg border border-edge bg-surface lg:w-3/4">
        <section aria-labelledby="activity-heading" className="p-4">
          <h2 id="activity-heading" className="mb-3 text-xl font-bold text-white">
            Hourly Activity
          </h2>
          {failed ? (
            <p className="py-20 text-center text-danger">Failed to load player history.</p>
          ) : !data ? (
            <p className="py-20 text-center text-ink-3">Loading history...</p>
          ) : (
            <ActivityWeek history={data} />
          )}
        </section>

        <section aria-label="Playtime charts" className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ButtonGroup
              label="Chart"
              value={chart}
              onChange={pickChart}
              options={CHARTS}
              mobileSelect
            />
            {chart === 'bar' && (
              <ButtonGroup
                size="sm"
                label="Smoothing"
                showLabel
                value={granularity}
                onChange={setGranularity}
                mobileSelect
                options={[
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                ]}
              />
            )}
            {chart === 'heatmap' && (
              <ButtonGroup
                size="sm"
                label="Display"
                showLabel
                value={heatmapMode}
                onChange={setHeatmapMode}
                mobileSelect
                options={[
                  ['percent', '% Playtime'],
                  ['total', 'Total Time'],
                  ['chance', '% Log On Chance'],
                ]}
              />
            )}
          </div>

          {failed ? (
            <p className="py-20 text-center text-danger">Failed to load player history.</p>
          ) : !data || !derived ? (
            <p className="py-20 text-center text-ink-3">Loading history...</p>
          ) : chart === 'heatmap' ? (
            <PlaytimeHeatmap sessions={data.sessions} mode={heatmapMode} />
          ) : chart === 'calendar' ? (
            <PlaytimeCalendar
              daily={derived.daily}
              firstSeen={derived.stats.firstSeen}
              showEmpty={showEmpty}
              now={now}
            />
          ) : derived.stats.firstSeen ? (
            <PlaytimeBars
              daily={derived.dailyPoints}
              weekly={derived.weeklyPoints}
              firstSeen={derived.stats.firstSeen}
              granularity={granularity}
            />
          ) : (
            <p className="py-20 text-center text-ink-3">No playtime recorded.</p>
          )}
        </section>

        <section className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-white">Monthly Playdata</h2>
            <Switch
              label={<span className="text-xs text-ink-2">Show Empty Months</span>}
              checked={showEmpty}
              onChange={setShowEmpty}
            />
          </div>
          {derived?.stats.firstSeen && (
            <MonthlyList
              from={derived.stats.firstSeen}
              monthly={derived.monthly}
              showEmpty={showEmpty}
              now={now}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  valueClass = 'text-white',
  children,
}: {
  label: string
  valueClass?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg bg-surface-2/50 p-3">
      <dt className="mb-1 text-xs tracking-wider text-ink-2 uppercase">{label}</dt>
      <dd className={valueClass}>{children}</dd>
    </div>
  )
}

/** Months in columns of six, oldest first, from the first join to now. */
function MonthlyList({
  from,
  monthly,
  showEmpty,
  now,
}: {
  from: number
  monthly: Map<string, number>
  showEmpty: boolean
  now: number
}) {
  const rows: [string, number][] = []
  const start = new Date(from)
  for (
    let d = new Date(start.getFullYear(), start.getMonth(), 1);
    d.getTime() <= now;
    d.setMonth(d.getMonth() + 1)
  ) {
    const hours =
      monthly.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) ?? 0
    if (showEmpty || hours > 0)
      rows.push([d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), hours])
  }
  const columns = Array.from({ length: Math.ceil(rows.length / 6) }, (_, i) =>
    rows.slice(i * 6, i * 6 + 6),
  )

  return (
    <div className="flex flex-wrap gap-6">
      {columns.map((column, i) => (
        <dl key={i} className="flex min-w-[160px] flex-col gap-1">
          {column.map(([month, hours]) => (
            <div key={month} className="flex justify-between text-sm">
              <dt className="text-ink-2">{month}:</dt>
              <dd className="font-mono text-white">{hours.toFixed(1)}h</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  )
}

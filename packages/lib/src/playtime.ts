/**
 * A single player's session history, turned into what /stats/[player] draws.
 *
 * Pure functions over plain arrays, so it can be tested.
 *
 * Two clocks are in play: day and week totals are bucketed in UTC
 * (calendar, bar chart, monthly list), while the heatmap and the weekly
 * activity chart use the viewer's local time, because "what hour do they play"
 * only means something in your own timezone.
 */

import { stillOnline, type SessionsResponse } from './players.ts'

export type Session = { login: number; logout: number }

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** CivMC opened on 1 June 2022; nothing can be earlier. */
const SERVER_START = Date.UTC(2022, 5, 1)

export type History = {
  /** Completed sessions, oldest first. */
  sessions: Session[]
  /** Set while the player is on right now. */
  onlineSince: number | null
  lastLogout: number | null
}

export function history(data: SessionsResponse, now: number): History {
  const logins = data.loginTimestamps ?? []
  const logouts = data.logoutTimestamps ?? []
  let latest = -1
  logins.forEach((login, i) => {
    if (login && (latest < 0 || login > logins[latest])) latest = i
  })

  const sessions: Session[] = []
  let lastLogout: number | null = null
  logins.forEach((login, i) => {
    const logout = logouts[i]
    if (logout && logout > (lastLogout ?? 0)) lastLogout = logout
    if (login && logout && logout > login) sessions.push({ login, logout })
  })
  sessions.sort((a, b) => a.login - b.login)

  return {
    sessions,
    /* civinfo misses some logouts; a session open a day or more is not "online". */
    onlineSince:
      latest >= 0 && logouts[latest] === null && stillOnline(logins[latest], now)
        ? logins[latest]
        : null,
    lastLogout,
  }
}

export type Summary = {
  totalHours: number
  firstSeen: number | null
  /** The last logout — or now, while online. */
  lastSeen: number | null
}

export function summary({ sessions, onlineSince }: History, now: number): Summary {
  return {
    totalHours: sessions.reduce((h, s) => h + (s.logout - s.login) / HOUR, 0),
    firstSeen: sessions[0]?.login ?? null,
    lastSeen: onlineSince
      ? now
      : sessions.length
        ? Math.max(...sessions.map((s) => s.logout))
        : null,
  }
}

/** ms played per UTC day, a session split across midnight counting on both days. */
export function dailyTotals(sessions: Session[]): Map<number, number> {
  const days = new Map<number, number>()
  for (const { login, logout } of sessions) {
    for (let t = login; t < logout;) {
      const day = Math.floor(t / DAY) * DAY
      const end = Math.min(logout, day + DAY)
      days.set(day, (days.get(day) ?? 0) + end - t)
      t = end
    }
  }
  return days
}

export type Point = { date: number; hours: number }

/** Hours per UTC day, capped at 24 — overlapping sessions can otherwise exceed it. */
export const dailySeries = (daily: Map<number, number>): Point[] =>
  [...daily]
    .sort(([a], [b]) => a - b)
    .map(([date, ms]) => ({ date, hours: Math.min(24, ms / HOUR) }))

/** Hours per UTC week starting Monday, each day capped at 24 first. */
export function weeklySeries(daily: Map<number, number>): Point[] {
  const weeks = new Map<number, number>()
  for (const [day, ms] of daily) {
    const weekday = (new Date(day).getUTCDay() + 6) % 7
    const monday = Math.max(day - weekday * DAY, SERVER_START)
    weeks.set(monday, (weeks.get(monday) ?? 0) + Math.min(ms, DAY))
  }
  return [...weeks]
    .sort(([a], [b]) => a - b)
    .map(([date, ms]) => ({ date, hours: Math.min(24 * 7, ms / HOUR) }))
}

/** Hours per local calendar month, keyed "YYYY-MM", by the month each session began. */
export function monthlyTotals(sessions: Session[]): Map<string, number> {
  const months = new Map<string, number>()
  for (const { login, logout } of sessions) {
    const d = new Date(login)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.set(key, (months.get(key) ?? 0) + (logout - login) / HOUR)
  }
  return months
}

/** Sessions clipped to [from, to]. */
export const clip = (sessions: Session[], from: number, to: number) =>
  sessions
    .filter((s) => s.logout >= from && s.login <= to)
    .map((s) => ({ login: Math.max(s.login, from), logout: Math.min(s.logout, to) }))

/** Minutes played in each [local weekday 0=Sun][hour] slot. */
export function heatmap(sessions: Session[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const { login, logout } of sessions) {
    for (let t = login; t < logout;) {
      const d = new Date(t)
      const pastHour = d.getMinutes() * 60_000 + d.getSeconds() * 1000 + d.getMilliseconds()
      const end = Math.min(logout, t - pastHour + HOUR)
      grid[d.getDay()][d.getHours()] += (end - t) / 60_000
      t = end
    }
  }
  return grid
}

/**
 * The chance, in percent, that the player is on in each [weekday][hour] slot:
 * of the weeks with at least five hours played, the share in which they were
 * online at any point in that hour.
 */
export function logOnChance(sessions: Session[]): { grid: number[][]; weeks: number } {
  const byWeek = new Map<number, Session[]>()
  for (const s of sessions) {
    const week = localWeekStart(s.login, false)
    byWeek.set(week, [...(byWeek.get(week) ?? []), s])
  }
  const qualifying = [...byWeek.values()].filter(
    (list) => list.reduce((ms, s) => ms + s.logout - s.login, 0) >= 5 * HOUR,
  )

  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const list of qualifying) {
    const seen = new Set<number>()
    for (const { login, logout } of list) {
      const cursor = new Date(login)
      cursor.setMinutes(0, 0, 0)
      for (let t = cursor.getTime(); t < logout; t += HOUR) {
        const d = new Date(t)
        seen.add(d.getDay() * 24 + d.getHours())
      }
    }
    for (const slot of seen) grid[Math.floor(slot / 24)][slot % 24]++
  }
  if (qualifying.length)
    for (const row of grid) row.forEach((hits, h) => (row[h] = (hits / qualifying.length) * 100))

  return { grid, weeks: qualifying.length }
}

/**
 * The blue-to-red ramp the heatmap and its legend share: square-root scaled
 * so a few heavy hours do not wash every other cell out.
 */
export function heatColor(value: number, max: number): string {
  if (!max || value <= 0) return 'rgba(55, 65, 81, 0.3)'
  const intensity = Math.sqrt(value / max)
  const hue = Math.round(220 + 140 * intensity) % 360
  return `hsla(${hue}, 75%, 60%, ${0.25 + 0.75 * intensity})`
}

/* ── Weekly activity ───────────────────────────────────── */

/**
 * US timezones start their weeks on Sunday; everywhere else on Monday. A
 * heuristic — `Intl.Locale#weekInfo` would be the proper answer but is
 * not in Firefox.
 */
const SUNDAY_START_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Adak',
  'America/Boise',
  'America/Detroit',
  'America/Indiana',
  'America/Kentucky',
  'America/Menominee',
  'America/Nome',
  'America/North_Dakota',
  'America/Sitka',
  'America/Yakutat',
  'America/Juneau',
  'America/Metlakatla',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
  'America/Virgin',
]
export const weekStartsSunday = (timeZone: string) =>
  SUNDAY_START_ZONES.some((zone) => timeZone.startsWith(zone))

/** Local midnight `days` calendar days after `t`'s — not `t + days * 24h`, which drifts an hour across DST. */
export function addLocalDays(t: number, days: number) {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

export function localWeekStart(t: number, sundayStart: boolean) {
  const day = new Date(t).getDay()
  return addLocalDays(t, -(sundayStart ? day : (day + 6) % 7))
}

export type ActivityWeek = { start: number; end: number; totalMs: number; sessions: Session[] }

/**
 * Every local week with play in it, oldest first, including ongoing time. A
 * session that crosses into a new week is listed, and counted, in both.
 */
export function activityWeeks(
  { sessions, onlineSince }: History,
  sundayStart: boolean,
  now: number,
): ActivityWeek[] {
  const weeks = new Map<number, ActivityWeek>()
  const add = (from: number, to: number, session?: Session) => {
    for (let start = localWeekStart(from, sundayStart); start < to;) {
      const end = addLocalDays(start, 7)
      if (!weeks.has(start)) weeks.set(start, { start, end, totalMs: 0, sessions: [] })
      const week = weeks.get(start)!
      week.totalMs += Math.min(to, end) - Math.max(from, start)
      if (session) week.sessions.push(session)
      start = end
    }
  }
  for (const s of sessions) add(s.login, s.logout, s)
  if (onlineSince) add(onlineSince, now)
  return [...weeks.values()].sort((a, b) => a.start - b.start)
}

/** Month labels for a date range: every 1, 2, 4 or 6 months as the span grows. */
export function monthTicks(from: number, to: number): number[] {
  const months = (to - from) / (30.44 * DAY)
  const step = months <= 6 ? 1 : months <= 12 ? 2 : months <= 24 ? 4 : 6
  const start = new Date(from)
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  if (cursor.getTime() < from) cursor = new Date(start.getFullYear(), start.getMonth() + step, 1)
  const ticks: number[] = []
  while (cursor.getTime() <= to) {
    ticks.push(cursor.getTime())
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1)
  }
  return ticks
}

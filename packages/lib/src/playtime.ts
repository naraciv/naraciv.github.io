/**
 * A single player's session history, turned into what /stats/[player] draws.
 *
 * Pure functions over plain arrays, so it can be tested.
 *
 * Two clocks are in play: day and week totals are bucketed in UTC
 * (calendar, bar chart, monthly list), while the heatmap and the weekly
 * activity chart use the viewer's local time, because "what hour do they play"
 * only means something in your own timezone. Every local-time function takes
 * `utc` to use UTC instead, for the stats page's UTC toggle.
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

/** Sessions reset daily at 10:15 UTC (06:15 Eastern), when players can log back in after the restart. */
const RESTART = 10 * HOUR + 15 * 60_000
const SESSION_LIMIT = 10 * HOUR

/**
 * ms used of the current 10-hour session. The budget resets at each restart,
 * and on a logout within 5 minutes of the 10-hour mark (the kick). Playing well
 * past 10h without a kick (staff bypass) just reads as full.
 */
export function sessionTime({ sessions, onlineSince }: History, now: number): number {
  const restart = Math.floor((now - RESTART) / DAY) * DAY + RESTART
  let used = 0
  for (const s of clip(sessions, restart, now)) {
    used += s.logout - s.login
    if (Math.abs(used - SESSION_LIMIT) <= 5 * 60_000) used = 0
  }
  if (onlineSince) used += now - Math.max(onlineSince, restart)
  return Math.min(used, SESSION_LIMIT)
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

/** `t`'s calendar fields in local time, or UTC. */
function fields(t: number, utc: boolean) {
  const d = new Date(t)
  return utc
    ? {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        date: d.getUTCDate(),
        day: d.getUTCDay(),
        hour: d.getUTCHours(),
      }
    : {
        year: d.getFullYear(),
        month: d.getMonth(),
        date: d.getDate(),
        day: d.getDay(),
        hour: d.getHours(),
      }
}

const midnight = (year: number, month: number, date: number, utc: boolean) =>
  utc ? Date.UTC(year, month, date) : new Date(year, month, date).getTime()

function hourStart(t: number, utc: boolean) {
  const d = new Date(t)
  return utc ? d.setUTCMinutes(0, 0, 0) : d.setMinutes(0, 0, 0)
}

/** "YYYY-MM" of the month `t` falls in. */
export function monthKey(t: number, utc = false) {
  const { year, month } = fields(t, utc)
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/** The 1st of the month `months` after `t`'s. */
export function monthStart(t: number, months: number, utc = false) {
  const { year, month } = fields(t, utc)
  return midnight(year, month + months, 1, utc)
}

/** Hours per local calendar month, keyed "YYYY-MM", by the month each session began. */
export function monthlyTotals(sessions: Session[], utc = false): Map<string, number> {
  const months = new Map<string, number>()
  for (const { login, logout } of sessions) {
    const key = monthKey(login, utc)
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
export function heatmap(sessions: Session[], utc = false): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const { login, logout } of sessions) {
    for (let t = login; t < logout;) {
      const { day, hour } = fields(t, utc)
      const end = Math.min(logout, hourStart(t, utc) + HOUR)
      grid[day][hour] += (end - t) / 60_000
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
export function logOnChance(sessions: Session[], utc = false): { grid: number[][]; weeks: number } {
  const byWeek = new Map<number, Session[]>()
  for (const s of sessions) {
    const week = localWeekStart(s.login, false, utc)
    byWeek.set(week, [...(byWeek.get(week) ?? []), s])
  }
  const qualifying = [...byWeek.values()].filter(
    (list) => list.reduce((ms, s) => ms + s.logout - s.login, 0) >= 5 * HOUR,
  )

  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const list of qualifying) {
    const seen = new Set<number>()
    for (const { login, logout } of list) {
      for (let t = hourStart(login, utc); t < logout; t += HOUR) {
        const { day, hour } = fields(t, utc)
        seen.add(day * 24 + hour)
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
export function addLocalDays(t: number, days: number, utc = false) {
  const { year, month, date } = fields(t, utc)
  return midnight(year, month, date + days, utc)
}

export function localWeekStart(t: number, sundayStart: boolean, utc = false) {
  const { day } = fields(t, utc)
  return addLocalDays(t, -(sundayStart ? day : (day + 6) % 7), utc)
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
  utc = false,
): ActivityWeek[] {
  const weeks = new Map<number, ActivityWeek>()
  const add = (from: number, to: number, session?: Session) => {
    for (let start = localWeekStart(from, sundayStart, utc); start < to;) {
      const end = addLocalDays(start, 7, utc)
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
export function monthTicks(from: number, to: number, utc = false): number[] {
  const months = (to - from) / (30.44 * DAY)
  const step = months <= 6 ? 1 : months <= 12 ? 2 : months <= 24 ? 4 : 6
  let cursor = monthStart(from, 0, utc)
  if (cursor < from) cursor = monthStart(from, step, utc)
  const ticks: number[] = []
  while (cursor <= to) {
    ticks.push(cursor)
    cursor = monthStart(cursor, step, utc)
  }
  return ticks
}

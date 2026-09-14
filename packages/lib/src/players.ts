import { parseCsv } from './csv.ts'

/**
 * CivMC player activity, from api.civinfo.net, and the daily playtime
 * leaderboard in `data/leaderboard.csv`.
 *
 * Both civinfo endpoints return parallel arrays.
 */

export type Player = {
  username: string
  isOnline: boolean
  /** ms epoch. For an online player, when this session began. */
  loginTime: number
  /** ms epoch. The last logout, or the login when there has not been one. */
  logoutTime: number
}

export type SessionsResponse = {
  loginTimestamps: number[]
  logoutTimestamps: (number | null)[]
  mcNames: (string | null)[]
}

export type AccountsResponse = {
  mcNames: (string | null)[]
  lastLoginTimestamps: (number | null)[]
  lastLogoutTimestamps: (number | null)[]
}

const DAY = 86_400_000

/**
 * A session with no logout is still open — but civinfo misses some logouts,
 * so anything open for a day or more is treated as offline.
 */
export const stillOnline = (login: number, now: number) => now - login < DAY

/** Recent sessions: each player's latest login wins. */
export function playersFromSessions(data: SessionsResponse, now: number): Map<string, Player> {
  const players = new Map<string, Player>()
  data.loginTimestamps.forEach((login, i) => {
    const username = data.mcNames[i] || 'Unknown'
    if ((players.get(username)?.loginTime ?? -1) >= login) return
    const logout = data.logoutTimestamps[i]
    players.set(username, {
      username,
      isOnline: logout === null && stillOnline(login, now),
      loginTime: login,
      logoutTime: logout ?? login,
    })
  })
  return players
}

/**
 * Every known account, folded into the session map. The account wins whenever
 * it is newer: the sessions window can hold a player's stale, never-closed
 * session from months ago while their account shows yesterday's logout.
 */
export function mergeAccounts(players: Map<string, Player>, data: AccountsResponse, now: number) {
  data.mcNames.forEach((username, i) => {
    if (!username) return
    const login = data.lastLoginTimestamps[i] || 0
    const logout = data.lastLogoutTimestamps[i] || 0
    const existing = players.get(username)
    if (existing && login <= existing.loginTime && logout <= existing.logoutTime) return
    players.set(username, {
      username,
      isOnline: login > logout && stillOnline(login, now),
      loginTime: login,
      logoutTime: logout || login,
    })
  })
  return players
}

/** Online first, longest-connected first; then offline, most recently seen first. */
export const sortPlayers = (players: Iterable<Player>) =>
  [...players].sort((a, b) =>
    a.isOnline !== b.isOnline
      ? a.isOnline
        ? -1
        : 1
      : a.isOnline
        ? a.loginTime - b.loginTime
        : b.logoutTime - a.logoutTime,
  )

/** "3h 12m" */
export function duration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/* ── Leaderboard ───────────────────────────────────────── */

export type LeaderboardRow = { username: string; weekly: number; monthly: number; allTime: number }
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'allTime'

/** Username,Weekly,Monthly,AllTime — hours, one decimal. */
export function parseLeaderboard(csv: string): LeaderboardRow[] {
  return parseCsv(csv)
    .slice(1)
    .filter((row) => row[0])
    .map(([username, weekly, monthly, allTime]) => ({
      username,
      weekly: Number(weekly) || 0,
      monthly: Number(monthly) || 0,
      allTime: Number(allTime) || 0,
    }))
}

export const topPlayers = (rows: LeaderboardRow[], period: LeaderboardPeriod, n = 10) =>
  [...rows].sort((a, b) => b[period] - a[period]).slice(0, n)

/** Player avatars: mc-heads first, minotar when that fails. */
export const avatarUrls = (username: string, size = 32) => [
  `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`,
  `https://minotar.net/avatar/${encodeURIComponent(username)}/${size}`,
]

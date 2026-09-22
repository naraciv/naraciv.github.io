import {
  mergeAccounts,
  playersFromSessions,
  sortPlayers,
  type AccountsResponse,
  type SessionsResponse,
} from '@nara/lib'

const CIVINFO = 'https://api.civinfo.net'
/* civinfo grants access by Origin/Referer being nara.rocks and rejects Node's default
   User-Agent as a bot; a server-side fetch sets none of this on its own, unlike the
   browser calls this replaced. */
const HEADERS = {
  Origin: 'https://nara.rocks',
  Referer: 'https://nara.rocks/',
  'User-Agent': 'Mozilla/5.0 (nara.rocks online-players cache)',
}

/**
 * Every known player, online first, merged from civinfo's sessions and accounts.
 *
 * Cached for 5 minutes: the first request after that window hits civinfo (both
 * calls, including the ~4 MB account list) and every other visitor in between
 * gets this same cached response, so a quiet page never costs more than one
 * civinfo hit per 5 minutes.
 */
export const revalidate = 300

export async function GET() {
  const now = Date.now()
  const [sessions, accounts] = await Promise.all([
    fetch(`${CIVINFO}/mc-sessions/all?after=${now - 3_600_000}`, { headers: HEADERS }).then(
      (r) => r.json() as Promise<SessionsResponse>,
    ),
    fetch(`${CIVINFO}/mc-accounts/all?limit=1000000`, { headers: HEADERS }).then(
      (r) => r.json() as Promise<AccountsResponse>,
    ),
  ])

  const players = playersFromSessions(sessions, now)
  return Response.json(sortPlayers(mergeAccounts(players, accounts, now).values()))
}

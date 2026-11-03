import type { AccountsResponse } from '@nara/lib'
import { civinfo, FIVE_MINUTES } from '@/lib/civinfo'

/**
 * Every account civinfo knows, with its last login and logout, for /stats to list
 * and search offline players. Cached for 5 minutes, like /api/online-players.
 *
 * Only the three fields the merge reads: the full response is ~4.6 MB, over a
 * Vercel Function's 4.5 MB response limit.
 */
// ponytail: ~2.5 MB at 60K accounts; past ~110K it nears the 4.5 MB limit, then stream it.
export async function GET() {
  const { mcNames, lastLoginTimestamps, lastLogoutTimestamps } = await civinfo<AccountsResponse>(
    `/mc-accounts/all?limit=1000000`,
  )
  return Response.json(
    { mcNames, lastLoginTimestamps, lastLogoutTimestamps },
    { headers: FIVE_MINUTES },
  )
}

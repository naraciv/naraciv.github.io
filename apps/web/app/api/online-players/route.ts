import type { SessionsResponse } from '@nara/lib'
import { civinfo, FIVE_MINUTES } from '@/lib/civinfo'

/**
 * civinfo's sessions from the last hour: every open session, so everyone online.
 * The client merges this with /api/accounts.
 *
 * Cached for 5 minutes, so a quiet page never costs more than one civinfo hit per
 * 5 minutes.
 */
export async function GET() {
  const { mcNames, loginTimestamps, logoutTimestamps } = await civinfo<SessionsResponse>(
    `/mc-sessions/all?after=${Date.now() - 3_600_000}`,
  )
  return Response.json({ mcNames, loginTimestamps, logoutTimestamps }, { headers: FIVE_MINUTES })
}

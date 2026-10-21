import { type NextRequest } from 'next/server'

/**
 * Whether a player has played on one other server (`?server=hcfr|loka|hypixel`):
 * `{ played }`, false if not, null when that server's API could not say; HCFR's and
 * Hypixel's yes is the date they first joined when it gives one. Server-side because
 * the APIs send no CORS headers, and Hypixel's needs a secret key. Looked up by UUID
 * when one is given, else by exact name. One server per request so each caches on its
 * own: a yes never changes, a no can.
 */

const DAY = 86_400
const YEAR = 365 * DAY

type Played = string | boolean | null

const lookups: Record<string, (id: { name: string; uuid: string | null }) => Promise<Played>> = {
  /* The player's first join on HCFR (ISO date) or true, false if never. */
  hcfr: ({ name, uuid }) =>
    get(`https://api.hcfr.gg/players/${uuid ?? name}`)
      .then((r) => (r.ok ? r.json() : r.status === 404 ? false : null))
      .then((player: { firstSeen?: string } | false | null) =>
        player ? (player.firstSeen ?? true) : player,
      ),
  loka: ({ name, uuid }) =>
    get(
      uuid
        ? `https://api.lokamc.com/players/search/findByUuid?uuid=${uuid.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')}`
        : `https://api.lokamc.com/players/search/findByName?name=${name}`,
    ).then((r) => (r.ok ? true : r.status === 404 ? false : null)),
  /* The player's first login on Hypixel (ISO date) or true, false if never. Needs a key
     (HYPIXEL_API_KEY) and a UUID; Hypixel can't be asked by name. */
  hypixel: async ({ uuid }) => {
    const key = process.env.HYPIXEL_API_KEY
    if (!key || !uuid) throw new Unavailable()
    const r = await get(`https://api.hypixel.net/v2/player?uuid=${uuid}`, { 'API-Key': key })
    /* 403 is a missing, expired or revoked key, not this player. */
    if (r.status === 403) throw new Unavailable()
    if (!r.ok) return null
    const { player } = (await r.json()) as { player: { firstLogin?: number } | null }
    if (!player) return false
    return player.firstLogin ? new Date(player.firstLogin).toISOString() : true
  },
}

/* This site can't check that server at all (Hypixel without a working key or a UUID),
   so the profile leaves it out rather than showing "?". */
class Unavailable extends Error {}

/* Uncached: the response's Cache-Control decides how long each answer lives. */
const get = (url: string, headers?: HeadersInit) => fetch(url, { cache: 'no-store', headers })

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const server = params.get('server') ?? ''
  /* Own keys only, so `?server=constructor` is a 400 rather than a call to Object. */
  const lookup = Object.hasOwn(lookups, server) ? lookups[server] : undefined
  const name = params.get('name') ?? ''
  const uuid = params.get('uuid')?.replace(/-/g, '').toLowerCase() || null
  if (!lookup || !/^\w{1,16}$/.test(name) || (uuid && !/^[0-9a-f]{32}$/.test(uuid)))
    return Response.json({ error: 'Bad server, name or uuid' }, { status: 400 })

  let played: Played
  try {
    played = await lookup({ name, uuid })
  } catch (error) {
    if (error instanceof Unavailable)
      return Response.json(
        { error: 'Unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    played = null
  }
  /* A yes holds forever, a no until they join, and a failure should be retried. */
  const cache = played === null ? 'no-store' : `public, s-maxage=${played ? YEAR : DAY}`
  return Response.json({ played }, { headers: { 'Cache-Control': cache } })
}

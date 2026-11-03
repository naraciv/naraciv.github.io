const CIVINFO = 'https://api.civinfo.net'
/* civinfo grants access by Origin/Referer being nara.rocks and rejects Node's default
   User-Agent as a bot; a server-side fetch sets none of this on its own, unlike the
   browser calls this replaced. */
const HEADERS = {
  Origin: 'https://nara.rocks',
  Referer: 'https://nara.rocks/',
  'User-Agent': 'Mozilla/5.0 (nara.rocks online-players cache)',
}

/*
 * Cached on Vercel's CDN, not with ISR: CDN cache is free, while ISR bills every
 * changed write per 8 KB, and this data changes every refresh. Never served more
 * than 5 minutes old: fresh for 4, then one more minute stale while it refreshes.
 * Vercel strips s-maxage and stale-while-revalidate, so browsers see max-age=0.
 */
export const FIVE_MINUTES = {
  'Cache-Control': 'public, max-age=0, s-maxage=240, stale-while-revalidate=60',
}

/** One civinfo API call, for the routes that cache it. */
export const civinfo = <T>(path: string) =>
  fetch(`${CIVINFO}${path}`, { headers: HEADERS }).then((r) => {
    if (!r.ok) throw new Error(`civinfo ${r.status}`)
    return r.json() as Promise<T>
  })

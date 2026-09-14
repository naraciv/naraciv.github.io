/**
 * A route handler, not a next.config redirect: the CivInfo
 * datasource URL embeds a literal colon ("https:!.!.") which path-to-regexp
 * parses as a route parameter and rejects.
 */
const DATASOURCE =
  'https://map.civinfo.net/datasource/https:!.!.meenos1.github.io!.overland-rail.json'

export function GET() {
  return Response.redirect(DATASOURCE, 307)
}

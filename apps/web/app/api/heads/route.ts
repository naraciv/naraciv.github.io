import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseHeads } from '@nara/lib'

/**
 * Same data as /heads, as JSON for agents.
 *
 * Static for the same reason as the page: the CSV is committed to this repo
 * and read once at build (see app/heads/page.tsx).
 */
export const dynamic = 'force-static'

const heads = parseHeads(
  readFileSync(path.join(process.cwd(), '../../data/head_shop_data.csv'), 'utf8'),
)

export async function GET() {
  return Response.json(heads)
}

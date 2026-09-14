import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseLeaderboard, topPlayers } from '@nara/lib'

/**
 * Server-side player lookups for /stats/[player]. Reads the filesystem, so it
 * must only be imported from server components.
 *
 * The 1.2 MB `player_names.json` is read once per server instance, and the page
 * redirects to the canonical casing.
 *
 * Both data files live outside apps/web, so next.config.ts lists them in
 * `outputFileTracingIncludes` for this route — without that a serverless
 * deployment would not ship them.
 */

const DATA = path.join(process.cwd(), '../../data')

let names: Map<string, { name: string; uuid: string | null }> | null = null
function knownNames() {
  if (!names) {
    const raw: Record<string, string | null> = JSON.parse(
      readFileSync(path.join(DATA, 'player_names.json'), 'utf8'),
    )
    names = new Map(Object.entries(raw).map(([name, uuid]) => [name.toLowerCase(), { name, uuid }]))
  }
  return names
}

export type ResolvedPlayer = { name: string; uuid: string | null }

/**
 * The player's name as CivMC knows it, matched case-insensitively against the
 * civinfo account list — never a different name. CivMC keeps the name an account
 * had when it joined (often 2022's), so Mojang's current name for a UUID, or the
 * current owner of a name, can be someone else entirely, so a Mojang lookup
 * could redirect to the wrong player. Null when civinfo has not seen the
 * name: the page keeps the name as typed.
 */
export function resolvePlayer(input: string): ResolvedPlayer | null {
  const known = knownNames().get(input.toLowerCase())
  return known && known.name.toLowerCase() === input.toLowerCase() ? known : null
}

let top: string[] | null = null
/** 1-based all-time rank if the player is in the top ten, else null. */
export function allTimeRank(name: string): number | null {
  top ??= topPlayers(
    parseLeaderboard(readFileSync(path.join(DATA, 'leaderboard.csv'), 'utf8')),
    'allTime',
  ).map((row) => row.username.toLowerCase())
  const index = top.indexOf(name.toLowerCase())
  return index < 0 ? null : index + 1
}

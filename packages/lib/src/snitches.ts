/**
 * Snitches from a SnitchMod database, and whether each is active, about to go
 * dormant, dormant, or culled.
 *
 * A snitch is dormant from its `dormant_ts`, and culled two calendar months
 * after that.
 */

export type Snitch = {
  world: string
  x: number
  y: number
  z: number
  group_name: string | null
  name: string | null
  type: string | null
  /** ms epoch; 0 or null when SnitchMod has not recorded one. */
  dormant_ts: number | null
}

export type SnitchStatus = 'active' | 'will-dormant' | 'dormant' | 'culled'

export const STATUS_COLOR: Record<SnitchStatus, string> = {
  active: '#10b981',
  'will-dormant': '#eab308',
  dormant: '#ef4444',
  culled: '#6b7280',
}

const DAY = 86_400_000

/** Dormant plus two calendar months, or null without a dormant time. */
export function cullTs(snitch: Pick<Snitch, 'dormant_ts'>): number | null {
  if (!snitch.dormant_ts || snitch.dormant_ts <= 0) return null
  const d = new Date(snitch.dormant_ts)
  d.setMonth(d.getMonth() + 2)
  return d.getTime()
}

export function snitchStatus(
  snitch: Pick<Snitch, 'dormant_ts'>,
  now: number,
  warningDays: number,
): SnitchStatus {
  const cull = cullTs(snitch)
  const dormant = snitch.dormant_ts ?? 0
  if (cull && cull < now) return 'culled'
  if (dormant > 0 && dormant < now) return 'dormant'
  if (dormant > 0 && dormant < now + warningDays * DAY) return 'will-dormant'
  return 'active'
}

/** Whole days until `ts`, rounded up; null once it has passed. */
export const daysUntil = (ts: number | null, now: number) =>
  ts && ts > now ? Math.ceil((ts - now) / DAY) : null

export const groupOf = (snitch: Pick<Snitch, 'group_name'>) => snitch.group_name || 'Unknown'

/** Groups by snitch count, most first. */
export function groupCounts(snitches: Snitch[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const s of snitches) counts.set(groupOf(s), (counts.get(groupOf(s)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

/** Anything beyond ±10,000 blocks is ignored. */
const BOUND = 10_000

export function filterSnitches(
  snitches: Snitch[],
  {
    world,
    yMin,
    yMax,
    hiddenGroups,
  }: { world: string; yMin: number; yMax: number; hiddenGroups: Set<string> },
): Snitch[] {
  return snitches.filter(
    (s) =>
      (s.world || 'world') === world &&
      !hiddenGroups.has(groupOf(s)) &&
      Math.abs(s.x) <= BOUND &&
      Math.abs(s.z) <= BOUND &&
      s.y >= yMin &&
      s.y <= yMax,
  )
}

/**
 * The centre and zoom that show every snitch with 500 blocks to spare, for a
 * viewport `size` pixels across its shorter side. Zoom z shows 2^z px/block.
 */
export function fitSnitches(
  snitches: Snitch[],
  size: number,
): { x: number; z: number; zoom: number } {
  if (!snitches.length) return { x: 0, z: 0, zoom: fitRange(2 * BOUND, size) }
  const xs = snitches.map((s) => s.x)
  const zs = snitches.map((s) => s.z)
  const [minX, maxX, minZ, maxZ] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...zs),
    Math.max(...zs),
  ]
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    zoom: fitRange(Math.max(maxX - minX, maxZ - minZ) + 1000, size),
  }
}

/** The closest zoom from 0 down to -6 at which `blocks` fit in `size` pixels. */
const fitRange = (blocks: number, size: number) => {
  for (let zoom = 0; zoom > -6; zoom--) if (blocks * 2 ** zoom <= size) return zoom
  return -6
}

/** Marker radius in px: 1 at zoom -6, growing 0.8 per level, capped at 6. */
export const markerRadius = (zoom: number) => Math.max(1, Math.min(6, 1 + (zoom + 6) * 0.8))

/** The first snitch whose marker is under a world point, allowing 5 px of slop. */
export function snitchAt(snitches: Snitch[], x: number, z: number, zoom: number): Snitch | null {
  const reach = (markerRadius(zoom) + 5) / 2 ** zoom
  return snitches.find((s) => Math.hypot(s.x - x, s.z - z) <= reach) ?? null
}

export const snitchKey = (s: Pick<Snitch, 'x' | 'y' | 'z'>) => `${s.x},${s.y},${s.z}`

export const describeSnitch = (s: Snitch) => `${s.name || groupOf(s)} (${s.x}, ${s.y}, ${s.z})`

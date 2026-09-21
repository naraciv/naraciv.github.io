/**
 * Grid geometry for the planner.
 *
 * Pure functions over plain world coordinates — no Leaflet, no DOM, no shared
 * mutable config — so all of it is testable.
 */

export type Point = { x: number; z: number }
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export type PresetKey = 'city' | 'vault' | 'snitch' | 'repellator'

export type Preset = {
  label: string
  /** Shown under the label on the preset buttons. */
  size: string
  /** Distance between grid points, for rectangular presets. */
  spacing: number
  radius: number
  shape: 'rect' | 'circle'
  stroke: string
  fill: string
  /** Coverage areas are only drawn at this zoom or closer. */
  rangeMinZoom: number
}

/**
 * The repellator's `spacing` is never read — circular presets derive their
 * packing from `radius` instead.
 */
export const PRESETS: Record<PresetKey, Preset> = {
  city: {
    label: 'City Bastion',
    size: '101 x 101',
    spacing: 101,
    radius: 50,
    shape: 'rect',
    stroke: 'rgba(168, 85, 247, 0.85)',
    fill: 'rgba(168, 85, 247, 0.12)',
    rangeMinZoom: -1,
  },
  vault: {
    label: 'Vault Bastion',
    size: '21 x 21',
    spacing: 21,
    radius: 10,
    shape: 'rect',
    stroke: 'rgba(239, 68, 68, 0.85)',
    fill: 'rgba(239, 68, 68, 0.13)',
    rangeMinZoom: 0,
  },
  snitch: {
    label: 'Snitch',
    size: '23 x 23',
    spacing: 23,
    radius: 11,
    shape: 'rect',
    stroke: 'rgba(34, 197, 94, 0.85)',
    fill: 'rgba(34, 197, 94, 0.12)',
    rangeMinZoom: 0,
  },
  repellator: {
    label: 'Mob Repellator',
    size: '96 Radius',
    spacing: 166,
    radius: 96,
    shape: 'circle',
    stroke: 'rgba(6, 182, 212, 0.9)',
    fill: 'rgba(6, 182, 212, 0.13)',
    rangeMinZoom: -1,
  },
}

export const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[]

/** Above this many points the overlay shows a "zoom in" notice instead. */
export const MAX_GRID_POINTS = 1200

export type BorderMode = 'strict' | 'center'

/**
 * Grid points covering `bounds`, anchored on `center`.
 *
 * Rectangular presets step by `spacing`. Circular ones hex-pack: rows sit
 * 1.5r apart, columns sqrt(3)·r apart, and odd rows shift half a column —
 * the tightest packing that leaves no gap between circles of radius r.
 */
export function generateGridPoints({
  center,
  preset,
  bounds,
}: {
  center: Point
  preset: Preset
  bounds: Bounds
}): Point[] {
  const points: Point[] = []

  if (preset.shape === 'circle') {
    const r = preset.radius
    const dx = Math.floor(Math.sqrt(3) * r)
    const dz = Math.floor(1.5 * r)
    const rowShift = Math.floor(dx / 2)
    const rowMin = Math.floor((bounds.minZ - center.z) / dz) - 1
    const rowMax = Math.ceil((bounds.maxZ - center.z) / dz) + 1

    for (let row = rowMin; row <= rowMax; row++) {
      const z = center.z + row * dz
      const shift = Math.abs(row % 2) === 1 ? rowShift : 0
      const colMin = Math.floor((bounds.minX - center.x - shift) / dx) - 1
      const colMax = Math.ceil((bounds.maxX - center.x - shift) / dx) + 1

      for (let col = colMin; col <= colMax; col++) {
        points.push({ x: center.x + col * dx + shift, z })
      }
    }
    return points
  }

  const step = preset.spacing
  const iMin = Math.floor((bounds.minX - center.x) / step) - 1
  const iMax = Math.ceil((bounds.maxX - center.x) / step) + 1
  const jMin = Math.floor((bounds.minZ - center.z) / step) - 1
  const jMax = Math.ceil((bounds.maxZ - center.z) / step) + 1

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      points.push({ x: center.x + i * step, z: center.z + j * step })
    }
  }
  return points
}

/** Index of the border vertex closest to a world point, if one is within `reach` blocks; otherwise -1. */
export function nearestVertex(border: Point[], point: Point, reach: number): number {
  let best = -1
  let bestDistance = reach
  border.forEach((vertex, i) => {
    const distance = Math.hypot(vertex.x - point.x, vertex.z - point.z)
    if (distance <= bestDistance) [best, bestDistance] = [i, distance]
  })
  return best
}

/** Ray casting. A polygon of fewer than three vertices contains nothing. */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const zi = polygon[i].z
    const xj = polygon[j].x
    const zj = polygon[j].z
    const intersects =
      zi > point.z !== zj > point.z && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function getExpandedBounds(points: Point[], padding: number): Bounds {
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minZ: Math.min(...zs) - padding,
    maxZ: Math.max(...zs) + padding,
  }
}

/**
 * The points probed to decide whether a zone lies wholly inside the border:
 * the four corners for a square, eight compass points for a circle.
 */
export function getZoneSamplePoints(
  center: Point,
  radius: number,
  shape: Preset['shape'],
): Point[] {
  if (shape !== 'circle') {
    return [
      center,
      { x: center.x - radius, z: center.z - radius },
      { x: center.x + radius, z: center.z - radius },
      { x: center.x - radius, z: center.z + radius },
      { x: center.x + radius, z: center.z + radius },
    ]
  }

  const diagonal = Math.floor(radius / Math.SQRT2)
  return [
    center,
    { x: center.x - radius + 1, z: center.z },
    { x: center.x + radius - 1, z: center.z },
    { x: center.x, z: center.z - radius + 1 },
    { x: center.x, z: center.z + radius - 1 },
    { x: center.x - diagonal, z: center.z - diagonal },
    { x: center.x + diagonal, z: center.z - diagonal },
    { x: center.x - diagonal, z: center.z + diagonal },
    { x: center.x + diagonal, z: center.z + diagonal },
  ]
}

/**
 * Grid points inside the border polygon.
 *
 * `strict` keeps a zone only if its whole coverage area fits inside;
 * `center` keeps it whenever the point itself is inside, however much the
 * coverage spills over the edge.
 */
export function selectWithinBorder({
  center,
  preset,
  polygon,
  mode,
}: {
  center: Point
  preset: Preset
  polygon: Point[]
  mode: BorderMode
}): Point[] {
  if (polygon.length < 3) return []

  const radius = preset.radius
  const bounds = getExpandedBounds(polygon, radius)
  return generateGridPoints({ center, preset, bounds }).filter((point) =>
    mode === 'center'
      ? isPointInPolygon(point, polygon)
      : getZoneSamplePoints(point, radius, preset.shape).every((sample) =>
          isPointInPolygon(sample, polygon),
        ),
  )
}

/** "x, z" per line — the format the copy buttons put on the clipboard. */
export function formatCoordinateList(points: Point[]): string {
  return points.map((p) => `${Math.round(p.x)}, ${Math.round(p.z)}`).join('\n')
}

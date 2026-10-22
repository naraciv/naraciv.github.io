import { fromBase64Url, pipe, toBase64Url } from './rocketShare.ts'

/**
 * Ice road layers. A layer is one network: an unordered pile of polylines in overworld
 * block coords that join, branch and overlap however the roads do. The mapper keeps
 * appending paths to the same network, so merging is a union.
 *
 * Shared as JSON files or link codes (`/iceroads#d=...`). Both are untrusted, so
 * everything goes through `parseIceFile`.
 */

export type IcePath = [number, number][]
export type IceLayer = {
  id: string
  name: string
  updated: number
  color?: string
  paths: IcePath[]
  /** Points of interest on this group's roads. Optional: files from before markers have none. */
  markers?: IceMarker[]
}

const TEXT_MAX = 80
const MAX_PATHS = 20000
const MAX_POINTS = 20000
const COORD_MAX = 30000

const text = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, TEXT_MAX) : '')
const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

const clamp = (n: number) => Math.max(-COORD_MAX, Math.min(COORD_MAX, n))

function coord(value: unknown): number | null {
  const n = typeof value === 'number' || (typeof value === 'string' && value) ? Number(value) : NaN
  return Number.isFinite(n) ? clamp(Math.round(n)) : null
}

/* [x, z] or { x, z } */
const isPoint = (p: unknown) =>
  Array.isArray(p)
    ? !Array.isArray(p[0]) && typeof p[0] !== 'object'
    : !!p && typeof p === 'object' && 'x' in p

function sanitizePath(value: unknown): IcePath | null {
  const path: IcePath = []
  for (const p of Array.isArray(value) ? value : []) {
    if (path.length >= MAX_POINTS) break
    const x = coord(Array.isArray(p) ? p[0] : p?.x)
    const z = coord(Array.isArray(p) ? p[1] : p?.z)
    if (x !== null && z !== null) path.push([x, z])
  }
  return path.length >= 2 ? path : null
}

function sanitizeLayer(value: unknown): IceLayer | null {
  const l = (value ?? {}) as Record<string, unknown>
  if (!Array.isArray(l.paths)) return null
  const paths = l.paths
    .slice(0, MAX_PATHS)
    .map(sanitizePath)
    .filter((p): p is IcePath => !!p)
  const markers = sanitizeMarkers(l.markers)
  if (!paths.length && !markers.length) return null
  /* No id or name: identify it by its paths, so re-importing the same file is "already loaded". */
  const id = text(l.id) || text(l.name) || `imported-${hash(JSON.stringify(paths))}`
  const date = typeof l.updated === 'string' ? Date.parse(l.updated) : Number(l.updated ?? NaN)
  const color =
    typeof l.color === 'string' && /^#[0-9a-f]{6}$/i.test(l.color)
      ? l.color.toLowerCase()
      : undefined
  return {
    id,
    /* '' = unnamed; mergeLayers names it "Imported Group N". */
    name: text(l.name) || text(l.id),
    /* No timestamp: treat it as mapped now. */
    updated: Number.isFinite(date) && date > 0 ? Math.round(date) : Date.now(),
    ...(color && { color }),
    paths: tidy(paths),
    ...(markers.length && { markers }),
  }
}

/**
 * Any parsed JSON in; valid layers out (possibly empty). Accepts the full file, a bare
 * layer, an array of layers, an array of paths (one layer), or a single path. Road that
 * groups share is kept by one of them only (`dedupeGroups`).
 */
export function parseIceFile(value: unknown): IceLayer[] {
  const v = (value ?? {}) as Record<string, unknown>
  const raw = Array.isArray(value)
    ? isPoint(value[0])
      ? [{ paths: [value] }]
      : value.some((item) => Array.isArray(item?.paths))
        ? value
        : [{ paths: value }]
    : Array.isArray(v.layers)
      ? v.layers
      : v.paths !== undefined
        ? [value]
        : []
  return dedupeGroups(raw.map(sanitizeLayer).filter((l): l is IceLayer => !!l))
}

/** The current file version. Paths stay `[[x, z], ...]` and the layer keys stay as they
    are, so the JsMacros mapper (which writes "version": 2 back) reads and keeps it. */
export const FILE_VERSION = 4

/**
 * Layers as a file to save or share: markers as `[type, x, z, name?, mk?]`, the type being
 * its index in MARKER_TYPES and mk its symbol (left out for the first). Stringify it
 * without indentation; that is most of the saving.
 */
export const toIceFile = (layers: IceLayer[]) => ({
  version: FILE_VERSION,
  layers: layers.map(({ markers, ...l }) => ({
    ...l,
    ...(markers?.length && {
      markers: markers.map((m) => [
        MARKER_TYPES.indexOf(m.type),
        m.x,
        m.z,
        ...(m.name ? [m.name] : []),
        ...(m.mk ? [m.mk] : []),
      ]),
    }),
  })),
})

const pathLength = (p: IcePath) =>
  p.slice(1).reduce((s, [x, z], i) => s + Math.hypot(x - p[i][0], z - p[i][1]), 0)
/** Total length of a layer's paths, in blocks. */
export const layerLength = (layer: IceLayer) =>
  layer.paths.reduce((sum, p) => sum + pathLength(p), 0)

/* ── Markers ──────────────────────────────────────────── */

/* Files and links store a marker's type as its index here: only ever append. */
export const MARKER_TYPES = ['portal', 'bunker', 'vault', 'exit', 'potbunk', 'trap'] as const
export type IceMarkerType = (typeof MARKER_TYPES)[number]
/** mk: which of its type's symbols it shows (0 or none: the first). */
export type IceMarker = { type: IceMarkerType; x: number; z: number; name?: string; mk?: number }

const MAX_MARKERS = 5000
/* Link codes pack the type and symbol into one number: type + mk * 64. */
const MAX_TYPES = 64
const symbol = (v: unknown) =>
  Number.isInteger(v) && (v as number) > 0 && (v as number) < 1000 ? (v as number) : 0
const isMarkerType = (t: unknown): t is IceMarkerType => MARKER_TYPES.includes(t as IceMarkerType)
const markerKey = (m: IceMarker) => `${m.type},${m.x},${m.z}`

/* A group's "markers": the valid ones, duplicates dropped. Anything else is none. Each is
   `[type index, x, z, name?, mk?]` (a string after z is the name, a number the symbol), or a
   `{ type, x, z, name, mk }` object as version 2 files and LLM-made JSON have. TODO: drop
   the object form by December 2026 (and switch LLM_PROMPT in IceRoadViewer to the array
   form first). */
function sanitizeMarkers(value: unknown): IceMarker[] {
  const markers = (Array.isArray(value) ? value : []).slice(0, MAX_MARKERS).flatMap((m) => {
    const [type, rx, rz, rname, rmk] = Array.isArray(m)
      ? [
          MARKER_TYPES[m[0]],
          m[1],
          m[2],
          m.slice(3).find((v) => typeof v === 'string'),
          m.slice(3).find((v) => typeof v === 'number'),
        ]
      : [m?.type, m?.x, m?.z, m?.name, m?.mk]
    const x = coord(rx)
    const z = coord(rz)
    const name = text(rname)
    const mk = symbol(rmk)
    return isMarkerType(type) && x !== null && z !== null
      ? [{ type, x, z, ...(name && { name }), ...(mk && { mk }) }]
      : []
  })
  return mergeMarkers([], markers)
}

/** Union, existing order kept: the same type at the same block is the same marker. */
export function mergeMarkers(existing: IceMarker[] = [], incoming: IceMarker[] = []): IceMarker[] {
  const seen = new Set(existing.map(markerKey))
  return [
    ...existing,
    ...incoming.filter((m) => !seen.has(markerKey(m)) && !!seen.add(markerKey(m))),
  ]
}
/* Only set when there are some, so groups without markers keep their old JSON shape. */
const withMarkers = (markers: IceMarker[]) => (markers.length ? { markers } : {})

/* ── Smoothing, gaps and overlap ──────────────────────── */

/** Wobble smaller than this many blocks (inside the road) is smoothed out. */
const SIMPLIFY = 4
/** Segments within ~6° of straight or a 45° diagonal are snapped exactly onto it. */
const SNAP = 0.1
/** Odd-angle segments shorter than this become a straight bend; longer ones are kept. */
const ELBOW = 48

/* Ramer-Douglas-Peucker: keep only the corners. */
function simplify(path: IcePath): IcePath {
  if (path.length < 3) return path
  const [ax, az] = path[0]
  const [bx, bz] = path[path.length - 1]
  const len = Math.hypot(bx - ax, bz - az) || 1
  let far = 0
  let at = 0
  for (let i = 1; i < path.length - 1; i++) {
    const [px, pz] = path[i]
    const d = Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / len
    if (d > far) [far, at] = [d, i]
  }
  if (far <= SIMPLIFY) return [path[0], path[path.length - 1]]
  return simplify(path.slice(0, at + 1)).concat(simplify(path.slice(at)).slice(1))
}

/**
 * Smooth a recorded path the way the mapper does: drop wobble, snap nearly straight or
 * nearly 45° segments onto exactly that, and merge segments that then line up. Running it
 * twice changes nothing.
 */
export function smoothPath(path: IcePath): IcePath {
  const corners = simplify(path)
  const out: IcePath = [corners[0]]
  corners.slice(1).forEach(([x0, z0], i) => {
    const [px, pz] = out[out.length - 1]
    let [x, z] = [x0, z0]
    const dx = Math.abs(x - px)
    const dz = Math.abs(z - pz)
    if (dz <= dx * SNAP) z = pz
    else if (dx <= dz * SNAP) x = px
    else if (Math.abs(dx - dz) <= Math.max(dx, dz) * SNAP) {
      const d = Math.round((dx + dz) / 2)
      x = px + Math.sign(x - px) * d
      z = pz + Math.sign(z - pz) * d
    } else if (Math.hypot(dx, dz) < ELBOW) {
      /* Short and at an odd angle: a corner smoothed into a slant. Ice roads run straight
         or at 45°, so make it a bend that carries on the way the road was going, or
         failing that, leads into the way it goes next. */
      const before = out[out.length - 2]
      const after = corners[i + 2]
      const alongZ = before ? before[0] === px : !!after && after[1] === z
      out.push(alongZ ? [px, z] : [x, pz])
    }
    /* A diagonal snap can nudge a point a block or two; stay inside the world. */
    out.push([clamp(x), clamp(z)])
  })
  return mergeStraight(out)
}

/* Drop points that sit exactly on a straight line between their neighbours (snapping
   makes those exact), short out-and-back stubs (at most SIMPLIFY * 2 blocks), and
   repeated points. Real corners, bends and dead ends stay. */
function mergeStraight(path: IcePath): IcePath {
  const out: IcePath = []
  for (const p of path) {
    for (;;) {
      const [a, b] = [out[out.length - 2], out[out.length - 1]]
      if (b && b[0] === p[0] && b[1] === p[1]) break
      const inLine = a && (b[0] - a[0]) * (p[1] - b[1]) === (b[1] - a[1]) * (p[0] - b[0])
      const back = inLine && (b[0] - a[0]) * (p[0] - b[0]) + (b[1] - a[1]) * (p[1] - b[1]) < 0
      if (!inLine || (back && Math.hypot(p[0] - b[0], p[1] - b[1]) > SIMPLIFY * 2)) {
        out.push(p)
        break
      }
      out.pop()
    }
  }
  return out
}

/** Path ends this close to another path are joined onto it. */
export const HEAL_GAP = 8
/** A path whose every block is this close to existing road is already mapped. */
const SAME_ROAD = 2

/* Nearest whole-block point to (x, z) on the segment a-b. */
function nearestOn(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0
  return [Math.round(a[0] + t * dx), Math.round(a[1] + t * dz)] as [number, number]
}

/**
 * Join path ends that stop a few blocks short of another path (the mapper starts a new
 * stretch only once it is clear of mapped road). The end moves onto the nearest point of
 * the other path; if that would tilt a straight segment, a corner is added instead so the
 * road stays straight.
 */
export function healGaps(paths: IcePath[], maxGap = HEAL_GAP): IcePath[] {
  const out = paths.map((p) => p.map(([x, z]) => [x, z] as [number, number]))
  out.forEach((path, i) => {
    for (const atStart of [true, false]) {
      const end = atStart ? 0 : path.length - 1
      const [ex, ez] = path[end]
      let best: [number, number] | null = null
      let bestD = Infinity
      out.forEach((other, j) => {
        if (j === i) return
        for (let k = 1; k < other.length; k++) {
          const q = nearestOn(ex, ez, other[k - 1], other[k])
          const d = Math.hypot(q[0] - ex, q[1] - ez)
          if (d < bestD) [best, bestD] = [q, d]
        }
      })
      if (!best || bestD === 0 || bestD > maxGap) continue
      const to: [number, number] = best
      const n = path[atStart ? 1 : path.length - 2]
      const straight = n[0] === ex || n[1] === ez
      const moved: [number, number][] =
        straight && n[0] !== to[0] && n[1] !== to[1]
          ? [n[1] === ez ? [to[0], n[1]] : [n[0], to[1]], to]
          : [to]
      if (atStart) path.splice(0, 1, ...moved.reverse())
      else path.splice(end, 1, ...moved)
    }
  })
  return out.map(dropRepeatedPoints).filter((p) => p.length >= 2)
}

const dropRepeatedPoints = (path: IcePath) =>
  path.filter((p, i) => !i || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1])

/**
 * Join paths that meet end to end into one, then re-smooth so the meeting point goes if it
 * sits on a straight line. Same roads, fewer paths and points: smaller files and links.
 */
export function joinPaths(paths: IcePath[]): IcePath[] {
  let out = paths
  for (let joined = true; joined;) {
    joined = false
    const ends = new Map<string, number[]>()
    out.forEach((p, i) => {
      for (const [x, z] of [p[0], p[p.length - 1]])
        ends.set(`${x},${z}`, [...(ends.get(`${x},${z}`) ?? []), i])
    })
    const used = new Set<number>()
    const next: IcePath[] = []
    for (const [key, at] of ends) {
      const [i, j] = at.filter((k, n) => !used.has(k) && at.indexOf(k) === n)
      if (j === undefined) continue
      const meet = (p: IcePath) => `${p[0][0]},${p[0][1]}` === key
      const a = meet(out[i]) ? [...out[i]].reverse() : out[i] // ends at the meeting point
      const b = meet(out[j]) ? out[j] : [...out[j]].reverse() // starts at it
      next.push(smoothPath([...a, ...b.slice(1)]))
      used.add(i).add(j)
      joined = true
    }
    out = [...next, ...out.filter((_, i) => !used.has(i))]
  }
  return out
}

/* Visit every block a path passes through, in order; return false to stop. */
const blockKey = (x: number, z: number) => (x + 32768) * 65536 + (z + 32768)
export function eachBlock(path: IcePath, visit: (x: number, z: number) => boolean | void) {
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]
    const [bx, bz] = path[i]
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az), 1)
    for (let s = 0; s <= steps; s++)
      if (
        visit(
          Math.round(ax + ((bx - ax) * s) / steps),
          Math.round(az + ((bz - az) * s) / steps),
        ) === false
      )
        return false
  }
  return true
}
function roadBlocks(paths: IcePath[]) {
  const set = new Set<number>()
  for (const p of paths) eachBlock(p, (x, z) => void set.add(blockKey(x, z)))
  return set
}
/* Already mapped: every block of the path is within `radius` of existing road. */
const nearRoad = (road: Set<number>, x: number, z: number, radius = SAME_ROAD) => {
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++) if (road.has(blockKey(x + dx, z + dz))) return true
  return false
}
const isMapped = (road: Set<number>, path: IcePath, radius = SAME_ROAD) =>
  eachBlock(path, (x, z) => nearRoad(road, x, z, radius) || false)

/* Points closer to straight back than this (cos < -0.85, about 150°) are a turnaround. */
const TURNAROUND = -0.85

/**
 * Cut a path wherever it doubles back (someone ran down a dead end and came back), so
 * the way out and the way back are separate legs and the repeat can be trimmed off.
 */
export function splitTurnarounds(path: IcePath): IcePath[] {
  const legs: IcePath[] = []
  let leg: IcePath = [path[0]]
  for (let i = 1; i < path.length; i++) {
    leg.push(path[i])
    const next = path[i + 1]
    if (!next) break
    const u = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]]
    const v = [next[0] - path[i][0], next[1] - path[i][1]]
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1)
    if (cos < TURNAROUND) {
      legs.push(leg)
      leg = [path[i]]
    }
  }
  legs.push(leg)
  return legs.filter((l) => l.length >= 2)
}

/* A run of at least this many blocks over existing road is a repeat, not a junction. */
const REPEAT_RUN = 6

/*
 * The path minus any repeat at either end: a run of REPEAT_RUN or more blocks lying on
 * `road`. Shorter runs are where a road meets another and are kept. Null if the whole
 * path is road already there.
 */
function trimRepeats(path: IcePath, road: Set<number>, radius = SAME_ROAD): IcePath | null {
  const blocks: [number, number, number][] = [] // x, z, segment
  for (let i = 1; i < path.length; i++)
    eachBlock([path[i - 1], path[i]], (x, z) => void blocks.push([x, z, i - 1]))
  const near = blocks.map(([x, z]) => nearRoad(road, x, z, radius))
  if (near.every(Boolean)) return null
  let a = near.indexOf(false)
  let b = near.lastIndexOf(false)
  /* A wider radius makes a junction look longer (a 45° branch runs close for a while). */
  const run = (REPEAT_RUN * radius) / SAME_ROAD
  if (a < run) a = 0
  if (blocks.length - 1 - b < run) b = blocks.length - 1
  const [ax, az, ai] = blocks[a]
  const [bx, bz, bi] = blocks[b]
  const out = dropRepeatedPoints([[ax, az], ...path.slice(ai + 1, bi + 1), [bx, bz]])
  return out.length >= 2 ? out : null
}

/**
 * Drop road a group already has: each path, in order, loses any repeat at its ends of
 * the paths before it, and a path that is entirely repeat goes. Put the paths to keep
 * whole first.
 */
export function removeRepeats(paths: IcePath[]): IcePath[] {
  const road = new Set<number>()
  const out: IcePath[] = []
  for (const path of paths) {
    const kept = trimRepeats(path, road)
    if (!kept) continue
    out.push(kept)
    eachBlock(kept, (x, z) => void road.add(blockKey(x, z)))
  }
  return out
}

/** Another group's road this close is the same road: two mappers drift a few blocks apart. */
const OTHER_GROUP_ROAD = 4

/**
 * Road that several groups have stays only in the group with the most road; the others
 * lose it (the same end-trimming as `removeRepeats`). A group left with no road and no
 * markers goes. Groups that lose nothing come back as they were.
 */
export function dedupeGroups(groups: IceLayer[]): IceLayer[] {
  const road = new Set<number>()
  const lengths = new Map(groups.map((g) => [g, layerLength(g)]))
  const trimmed = new Map<IceLayer, IceLayer>()
  for (const g of [...groups].sort((a, b) => lengths.get(b)! - lengths.get(a)!)) {
    const kept = g.paths
      .map((p) => trimRepeats(p, road, OTHER_GROUP_ROAD))
      .filter((p): p is IcePath => !!p)
    const same = JSON.stringify(kept) === JSON.stringify(g.paths)
    /* Only after the whole group: its own overlaps are removeRepeats' business. */
    for (const p of kept) eachBlock(p, (x, z) => void road.add(blockKey(x, z)))
    trimmed.set(g, same ? g : { ...g, paths: joinPaths(healGaps(kept)) })
  }
  return groups.map((g) => trimmed.get(g)!).filter((g) => g.paths.length || g.markers?.length)
}

/* A group's paths, cleaned: split where they double back, smoothed, repeats removed
   (longest roads kept whole), gaps closed and end-to-end pieces joined. */
const tidy = (paths: IcePath[]) => {
  const legs = paths.flatMap((p) => splitTurnarounds(simplify(p)))
  const lengths = new Map(legs.map((p) => [p, pathLength(p)]))
  legs.sort((a, b) => lengths.get(b)! - lengths.get(a)!)
  /* Twice: trimming a repeat can leave a smoothed slant at the cut, and straightening
     that can expose a little more repeat. */
  const pass = (ps: IcePath[]) => removeRepeats(ps.map(smoothPath))
  return joinPaths(healGaps(pass(pass(legs))))
}

/* ── Import / merge ───────────────────────────────────── */

export type ImportPlan = { layer: IceLayer; status: 'new' | 'update' | 'same' | 'older' }[]

/** What importing `incoming` into `existing` would do, matched by layer id. */
export function planImport(existing: IceLayer[], incoming: IceLayer[]): ImportPlan {
  /* Against what is loaded plus the file's earlier layers, so a second copy of a layer
     in one file reads as older/newer, not new. */
  let seen = existing
  return incoming.map((layer) => {
    const before = seen
    const old = seen.find((e) => e.id === layer.id)
    seen = mergeLayers(seen, [layer])
    if (!old) return { layer, status: 'new' }
    const road = roadBlocks(old.paths)
    /* Road another group has is dropped on merge, so it changes nothing either. */
    const others = roadBlocks(before.filter((e) => e !== old).flatMap((e) => e.paths))
    const known = new Set((old.markers ?? []).map(markerKey))
    if (
      layer.paths.every((p) => isMapped(road, p) || isMapped(others, p, OTHER_GROUP_ROAD)) &&
      (layer.markers ?? []).every((m) => known.has(markerKey(m)))
    )
      return { layer, status: 'same' }
    return { layer, status: layer.updated > old.updated ? 'update' : 'older' }
  })
}

/**
 * Merge incoming layers into existing: a new array, existing order kept, new layers
 * appended. Same id: incoming paths that run over road already mapped are dropped, the
 * rest added and their gaps healed, and the newer copy's name, colour and timestamp win.
 * Then road shared between groups is left to one of them (`dedupeGroups`).
 */
export function mergeLayers(existing: IceLayer[], incoming: IceLayer[]): IceLayer[] {
  const out = [...existing]
  for (const layer of incoming) {
    const i = out.findIndex((e) => e.id === layer.id)
    if (i < 0) {
      let n = 1
      while (!layer.name && out.some((l) => l.name === `Imported Group ${n}`)) n++
      out.push(layer.name ? layer : { ...layer, name: `Imported Group ${n}` })
      continue
    }
    const old = out[i]
    const newer = layer.updated > old.updated
    const color = newer ? (layer.color ?? old.color) : (old.color ?? layer.color)
    out[i] = {
      id: old.id,
      name: (newer && layer.name) || old.name,
      updated: Math.max(old.updated, layer.updated),
      ...(color && { color }),
      /* Existing road first, so it stays whole and the incoming copy loses the repeats. */
      paths: joinPaths(healGaps(removeRepeats([...old.paths, ...layer.paths]))),
      ...withMarkers(mergeMarkers(old.markers, layer.markers)),
    }
  }
  return dedupeGroups(out)
}

/* ── Editing groups ───────────────────────────────────── */

/** Merge group `fromId` into group `intoId`: one network, gaps between them closed. */
export function mergeGroups(groups: IceLayer[], fromId: string, intoId: string): IceLayer[] {
  const from = groups.find((g) => g.id === fromId)
  const into = groups.find((g) => g.id === intoId)
  if (!from || !into || from === into) return groups
  const merged: IceLayer = {
    ...into,
    updated: Math.max(from.updated, into.updated),
    paths: joinPaths(healGaps(removeRepeats([...into.paths, ...from.paths]))),
    ...withMarkers(mergeMarkers(into.markers, from.markers)),
  }
  return groups.filter((g) => g !== from).map((g) => (g === into ? merged : g))
}

/** A straight or diagonal section: segment `segment` (points segment..segment+1) of a path. */
export type IceSection = { id: string; path: number; segment: number }

/**
 * Cut one section out of its road and add it to another group, or to a new group when
 * `to` is `{ name }`. The source road is split around it; the section joins the target's
 * network. A group left with no road and no markers is removed.
 */
export function moveSection(
  groups: IceLayer[],
  section: IceSection,
  to: string | { name: string },
): IceLayer[] {
  const source = groups.find((g) => g.id === section.id)
  const path = source?.paths[section.path]
  if (!source || !path?.[section.segment + 1] || to === source.id) return groups
  const piece: IcePath = [path[section.segment], path[section.segment + 1]]
  const rest = [path.slice(0, section.segment + 1), path.slice(section.segment + 1)].filter(
    (p) => p.length >= 2,
  )
  const now = Date.now()
  let out = groups.map((g) =>
    g === source
      ? { ...g, updated: now, paths: g.paths.flatMap((p, i) => (i === section.path ? rest : [p])) }
      : g,
  )
  let targetId = to as string
  if (typeof to !== 'string') {
    const name = text(to.name) || 'New Group'
    targetId = name
    for (let n = 2; out.some((g) => g.id === targetId); n++) targetId = `${name} ${n}`
    out.push({ id: targetId, name, updated: now, paths: [] })
  }
  out = out.map((g) =>
    g.id === targetId ? { ...g, updated: now, paths: joinPaths(healGaps([...g.paths, piece])) } : g,
  )
  return out.filter((g) => g.paths.length || g.markers?.length)
}

/* ── Link codes ───────────────────────────────────────── */

/*
 * Version 3: "~" (never in base64url, so no version 2 code starts with it), then base64url
 * of one flag byte and the bytes below, deflated when the flag is 1 (only when that is
 * shorter: small groups don't deflate well). All numbers are varints; signed ones zigzag.
 *
 *   layer count, then per layer:
 *     id ('' when it equals the name), name, updated (ms), color (0xrrggbb + 1, 0 = none),
 *     path count, then per path: point count, points
 *     marker count, then per marker: type index + 64 * symbol, dx, dz (from the previous
 *     marker), name
 *   strings: UTF-8 byte length, then the bytes
 *   points: the step from the previous point (across paths and layers, from 0,0), packed
 *     with its direction, since ice roads run straight or at 45°:
 *     4·|dx| + 0 along x, 4·|dz| + 1 along z, 4·(2·|dx| + same sign? 0 : 1) + 2 diagonal,
 *     4·|dx| + 3 then dz for anything else (|n| meaning zigzag n).
 */
const V3 = '~'
const zig = (n: number) => (n < 0 ? -2 * n - 1 : 2 * n)
const unzig = (n: number) => (n % 2 ? -(n + 1) / 2 : n / 2)

function packV3(layers: IceLayer[]): Uint8Array {
  const out: number[] = []
  const uint = (n: number) => {
    for (; n >= 128; n = Math.floor(n / 128)) out.push((n % 128) + 128)
    out.push(n)
  }
  const str = (s = '') => {
    const bytes = new TextEncoder().encode(s)
    uint(bytes.length)
    out.push(...bytes)
  }
  let [px, pz] = [0, 0]
  uint(layers.length)
  for (const l of layers) {
    str(l.id === l.name ? '' : l.id)
    str(l.name)
    uint(l.updated)
    uint(l.color ? parseInt(l.color.slice(1), 16) + 1 : 0)
    uint(l.paths.length)
    for (const path of l.paths) {
      uint(path.length)
      for (const [x, z] of path) {
        const [dx, dz] = [x - px, z - pz]
        ;[px, pz] = [x, z]
        if (dz === 0) uint(4 * zig(dx))
        else if (dx === 0) uint(4 * zig(dz) + 1)
        else if (Math.abs(dx) === Math.abs(dz)) uint(4 * (2 * zig(dx) + (dx === dz ? 0 : 1)) + 2)
        else {
          uint(4 * zig(dx) + 3)
          uint(zig(dz))
        }
      }
    }
    const markers = l.markers ?? []
    let [mx, mz] = [0, 0]
    uint(markers.length)
    for (const m of markers) {
      uint(MARKER_TYPES.indexOf(m.type) + MAX_TYPES * (m.mk ?? 0))
      uint(zig(m.x - mx))
      uint(zig(m.z - mz))
      ;[mx, mz] = [m.x, m.z]
      str(m.name)
    }
  }
  return new Uint8Array(out)
}

/* Raw layers (parseIceFile sanitizes them); throws on bytes that run out. */
function unpackV3(bytes: Uint8Array): unknown[] {
  let at = 0
  const uint = () => {
    let n = 0
    for (let scale = 1; ; scale *= 128) {
      if (at >= bytes.length || scale > 2 ** 56) throw new Error('bad link code')
      const b = bytes[at++]
      n += (b % 128) * scale
      if (b < 128) return n
    }
  }
  const str = () => {
    const n = uint()
    if (at + n > bytes.length) throw new Error('bad link code')
    return new TextDecoder().decode(bytes.subarray(at, (at += n)))
  }
  const count = (max: number) => Math.min(uint(), max)
  let [px, pz] = [0, 0]
  return Array.from({ length: count(1000) }, () => {
    const id = str()
    const name = str()
    const updated = uint()
    const color = uint()
    const paths = Array.from({ length: count(MAX_PATHS) }, () =>
      Array.from({ length: count(MAX_POINTS) }, () => {
        const v = uint()
        const n = Math.floor(v / 4)
        const tag = v % 4
        if (tag === 0) px += unzig(n)
        else if (tag === 1) pz += unzig(n)
        else if (tag === 2) {
          const d = unzig(Math.floor(n / 2))
          px += d
          pz += n % 2 ? -d : d
        } else {
          px += unzig(n)
          pz += unzig(uint())
        }
        return [px, pz]
      }),
    )
    let [mx, mz] = [0, 0]
    const markers = Array.from({ length: count(MAX_MARKERS) }, () => {
      const v = uint()
      mx += unzig(uint())
      mz += unzig(uint())
      return {
        type: MARKER_TYPES[v % MAX_TYPES],
        mk: Math.floor(v / MAX_TYPES),
        x: mx,
        z: mz,
        name: str(),
      }
    })
    return {
      id: id || name,
      name,
      updated,
      color: color ? `#${(color - 1).toString(16).padStart(6, '0')}` : undefined,
      paths,
      markers,
    }
  })
}

export async function encodeLayers(layers: IceLayer[]): Promise<string> {
  const raw = packV3(layers)
  const deflated = await pipe(raw, new CompressionStream('deflate-raw'))
  const [flag, body] = deflated.length < raw.length ? [1, deflated] : [0, raw]
  return V3 + toBase64Url(new Uint8Array([flag, ...body]))
}

/** Layers from a link code, or null if it is not one. */
export async function decodeLayers(code: string): Promise<IceLayer[] | null> {
  if (!code.startsWith(V3)) return decodeV2(code)
  try {
    const bytes = fromBase64Url(code.slice(V3.length))
    const body = bytes.subarray(1)
    if (bytes[0] > 1) return null
    const raw = bytes[0] ? await pipe(body, new DecompressionStream('deflate-raw')) : body
    const out = parseIceFile({ layers: unpackV3(raw) })
    return out.length ? out : null
  } catch {
    return null
  }
}

/* ── Version 2 link codes ──────────────────────────────
   TODO: remove by December 2026. Links made before version 3 still open until then. */

const VERSION = 2

// layer = [id, name, updated, color without '#', [[dx0, dz0, dx1, dz1, ...], ...], markers?]
// markers = [[type, x, z, name?], ...]: appended later, so codes from before have none.
// Points are delta-encoded from the previous point (the first from 0,0).
const unpackPath = (flat: unknown[]) => {
  const path: IcePath = []
  let x = 0
  let z = 0
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i] as number
    z += flat[i + 1] as number
    path.push([x, z])
  }
  return path
}

async function decodeV2(code: string): Promise<IceLayer[] | null> {
  try {
    const json = new TextDecoder().decode(
      await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw')),
    )
    const [v, ...layers] = JSON.parse(json)
    if (v !== VERSION) return null
    const out = parseIceFile({
      layers: layers.map(([id, name, updated, color, paths, markers]: unknown[]) => ({
        id,
        name,
        updated,
        color: color ? `#${color}` : undefined,
        paths: (paths as unknown[][]).map(unpackPath),
        markers: ((markers ?? []) as unknown[][]).map(([type, x, z, name]) => ({
          type,
          x,
          z,
          name,
        })),
      })),
    })
    return out.length ? out : null
  } catch {
    return null
  }
}

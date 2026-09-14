import { DELTA_V, ITEM_KINDS, type ItemKind } from './rocket.ts'

/**
 * A rocket calculator setup as something people can share: readable JSON to
 * paste, or a short code for a link (`/rocket#t=...`).
 *
 * Both are untrusted input, so everything goes through `sanitizeTrip`: unknown
 * kinds and units fall back, numbers are clamped, text is trimmed to length.
 *
 * The link code is a positional array (no key names), deflated with the
 * browser's own CompressionStream and base64url-encoded — about 70 characters
 * for a plain trip, 150–300 with labels on every row.
 */

export const UNITS = ['items', 'stacks', 'cs', 'chests'] as const
export type Unit = (typeof UNITS)[number]
export const RETURN_MODES = ['carry', 'split', 'refuel'] as const
export type ReturnMode = (typeof RETURN_MODES)[number]

export type TripRow = { kind: ItemKind; amount: number; unit: Unit; note: string }
export type TripLoad = { players: number; rows: TripRow[] }
export type TripConfig = {
  start: 'main' | 'Zorweth'
  roundTrip: boolean
  returnMode: ReturnMode
  split: { anchor: 'bring' | 'have'; items: number }
  outbound: TripLoad
  inbound: TripLoad
  fuelInComputer: number
  deltaToZorweth: number
  deltaToMain: number
  marginPct: number
  title: string
}

export const DEFAULT_TRIP: TripConfig = {
  start: 'main',
  roundTrip: true,
  returnMode: 'carry',
  split: { anchor: 'bring', items: 0 },
  outbound: { players: 1, rows: [] },
  inbound: { players: 1, rows: [] },
  fuelInComputer: 0,
  deltaToZorweth: DELTA_V.toZorweth,
  deltaToMain: DELTA_V.toMain,
  /** 1% by default: the server's floating-point fuel check can land a hair above ours. */
  marginPct: 1,
  title: '',
}

const KINDS = Object.keys(ITEM_KINDS) as ItemKind[]
export const MAX_ROWS = 50
export const TITLE_MAX = 60
export const NOTE_MAX = 40

const num = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const pick = <T>(value: unknown, options: readonly T[], fallback: T) =>
  options.includes(value as T) ? (value as T) : fallback
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

function sanitizeLoad(value: unknown): TripLoad {
  const load = (value ?? {}) as Partial<TripLoad>
  return {
    players: Math.round(num(load.players, 1, 1, 100)),
    rows: (Array.isArray(load.rows) ? load.rows : []).slice(0, MAX_ROWS).map((row) => ({
      kind: pick(row?.kind, KINDS, 'stack64'),
      amount: num(row?.amount, 0, 0, 1_000_000),
      unit: pick(row?.unit, UNITS, 'items'),
      note: text(row?.note, NOTE_MAX),
    })),
  }
}

/** Any parsed JSON in, a valid config out. */
export function sanitizeTrip(value: unknown): TripConfig {
  const c = (value ?? {}) as Partial<Record<keyof TripConfig, unknown>>
  const split = (c.split ?? {}) as Partial<TripConfig['split']>
  return {
    start: pick(c.start, ['main', 'Zorweth'] as const, 'main'),
    roundTrip: typeof c.roundTrip === 'boolean' ? c.roundTrip : true,
    returnMode: pick(c.returnMode, RETURN_MODES, 'carry'),
    split: {
      anchor: pick(split.anchor, ['bring', 'have'] as const, 'bring'),
      items: Math.round(num(split.items, 0, 0, 100_000)),
    },
    outbound: sanitizeLoad(c.outbound),
    inbound: sanitizeLoad(c.inbound),
    fuelInComputer: num(c.fuelInComputer, 0, 0, 100_000),
    deltaToZorweth: num(c.deltaToZorweth, DELTA_V.toZorweth, 0, 100_000),
    deltaToMain: num(c.deltaToMain, DELTA_V.toMain, 0, 100_000),
    marginPct: num(c.marginPct, DEFAULT_TRIP.marginPct, 0, 1000),
    title: text(c.title, TITLE_MAX),
  }
}

/* ── Link codes ───────────────────────────────────────── */

/** Bump when the positional layout changes; old codes then fail to decode, not misread. */
const VERSION = 1

const packLoad = ({ players, rows }: TripLoad) => [
  players,
  ...rows.flatMap((r) => [KINDS.indexOf(r.kind), r.amount, UNITS.indexOf(r.unit), r.note]),
]
function unpackLoad([players, ...flat]: unknown[]): TripLoad {
  const rows = []
  for (let i = 0; i + 3 < flat.length; i += 4)
    rows.push({
      kind: KINDS[flat[i] as number],
      amount: flat[i + 1],
      unit: UNITS[flat[i + 2] as number],
      note: flat[i + 3],
    })
  return { players, rows } as TripLoad
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}
const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const fromBase64Url = (code: string) =>
  Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function encodeTrip(config: TripConfig): Promise<string> {
  const c = sanitizeTrip(config)
  const packed = [
    VERSION,
    c.start === 'main' ? 0 : 1,
    c.roundTrip ? 1 : 0,
    RETURN_MODES.indexOf(c.returnMode),
    c.split.anchor === 'bring' ? 0 : 1,
    c.split.items,
    c.fuelInComputer,
    c.deltaToZorweth,
    c.deltaToMain,
    c.marginPct,
    c.title,
    packLoad(c.outbound),
    packLoad(c.inbound),
  ]
  const json = new TextEncoder().encode(JSON.stringify(packed))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

/** A config from a link code, or null if it is not one. */
export async function decodeTrip(code: string): Promise<TripConfig | null> {
  try {
    const json = new TextDecoder().decode(
      await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw')),
    )
    const [v, start, round, mode, anchor, items, fuel, dz, dm, margin, title, out, back] =
      JSON.parse(json)
    if (v !== VERSION) return null
    return sanitizeTrip({
      start: start ? 'Zorweth' : 'main',
      roundTrip: !!round,
      returnMode: RETURN_MODES[mode],
      split: { anchor: anchor ? 'have' : 'bring', items },
      fuelInComputer: fuel,
      deltaToZorweth: dz,
      deltaToMain: dm,
      marginPct: margin,
      title,
      outbound: unpackLoad(out),
      inbound: unpackLoad(back),
    })
  } catch {
    return null
  }
}

/**
 * Whatever someone pasted: a share link, a bare link code, or JSON. Null when
 * it is none of them.
 */
export async function parseTripInput(input: string): Promise<TripConfig | null> {
  const trimmed = input.trim()
  if (trimmed.startsWith('{')) {
    try {
      return sanitizeTrip(JSON.parse(trimmed))
    } catch {
      return null
    }
  }
  const code = trimmed.match(/[#&?]t=([\w-]+)/)?.[1] ?? (/^[\w-]+$/.test(trimmed) ? trimmed : null)
  return code ? decodeTrip(code) : null
}

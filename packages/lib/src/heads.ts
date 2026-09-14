import { parseCsv } from './csv.ts'
import { parseCoordinates, type Coords } from './coords.ts'

/**
 * MitsuHeadCorp's head shop, from `data/head_shop_data.csv`.
 *
 * A private business, not the Naran government — the page says so. The CSV is
 * committed to this repo and read at render time; moving it into Sanity as a
 * `headShopEntry` is not done.
 */

export type Head = {
  /** Row number; the data has no id, and one texture appears on two rows. */
  id: string
  name: string
  /** What it costs, as written: "1 Diamond", "3 Iron Ingot". */
  price: string
  coordinates: string
  position: Coords | null
  inStock: boolean
  category: string
  /** The skin texture, decoded from the head's base64 profile blob; for the 3D preview. */
  skinUrl: string | null
  /** The hash at the end of that URL, which the head render service keys on. */
  textureId: string | null
}

/* Column order in the CSV: Timestamp, Input, Output, Coordinates,
   Exchanges_Available, Category, Tags, Texture, Name. Output is always a player
   head and Tags is empty on every row, so neither is read. */
const PRICE = 1
const COORDINATES = 3
const IN_STOCK = 4
const CATEGORY = 5
const TEXTURE = 7
const NAME = 8

export function parseHeads(csv: string): Head[] {
  return parseCsv(csv)
    .slice(1)
    .filter((row) => row.length > NAME && row[TEXTURE])
    .map((row, index) => ({
      id: String(index),
      name: row[NAME].trim() || 'Unknown',
      price: row[PRICE],
      coordinates: row[COORDINATES],
      position: parseCoordinates(row[COORDINATES]),
      /* Unlike the shop CSV's TRUE/FALSE, this one uses T and F. */
      inStock: row[IN_STOCK].trim() !== 'F',
      category: row[CATEGORY].trim() || 'Uncategorized',
      skinUrl: skinUrl(row[TEXTURE]),
      textureId: skinUrl(row[TEXTURE])?.match(/\/texture\/([a-f0-9]+)/i)?.[1] ?? null,
    }))
}

/** The skin URL inside a head's texture blob, or null if it will not decode. */
export function skinUrl(texture: string): string | null {
  try {
    /* Stored as http://; fetched over https so a secure page is not mixed content. */
    return JSON.parse(atob(texture)).textures?.SKIN?.url?.replace(/^http:/, 'https:') ?? null
  } catch {
    return null
  }
}

/**
 * A rendered head from vzge.me; Steve when the texture is unreadable. 256 is
 * plenty for a 90px card on a 2x screen, and half the bytes of 512.
 */
export const headRenderUrl = (textureId: string | null, size: 64 | 256 | 512) =>
  `https://vzge.me/head/${size}/${textureId ?? 'steve'}.png${size === 64 ? '?no=shadow' : ''}`

/**
 * Floor names, as the shop has always shown them. They do not match the data: every head sits
 * at Y 50–65, so Y 50–59 (260 heads, four different levels) all read
 * "Basement", and Y 62 is "Top Floor" while the higher Y 65 is "Middle Floor".
 * Needs the actual floor plan.
 */
export function floorName(y: number): string {
  if (y < 62) return 'Basement'
  if (y <= 64) return 'Top Floor'
  if (y <= 67) return 'Middle Floor'
  if (y <= 70) return 'Bottom Floor'
  if (y <= 73) return 'Top Floor'
  return `Y${y}`
}

/** Player and nation heads first, seasonal last; alphabetical within a tier. */
const CATEGORY_PRIORITY: Record<string, number> = {
  player: 1,
  nation: 2,
  decoration: 4,
  indoor: 5,
  halloween: 20,
}

export const byCategoryPriority = (a: string, b: string) =>
  (CATEGORY_PRIORITY[a.toLowerCase()] ?? 10) - (CATEGORY_PRIORITY[b.toLowerCase()] ?? 10) ||
  a.localeCompare(b)

/** Every price in the data is diamonds or iron; anything else counts as neither. */
export function headCost(price: string): { diamonds: number; iron: number } {
  const amount = (item: string) =>
    Number(price.match(new RegExp(`(\\d+)\\s*${item}`, 'i'))?.[1] ?? 0)
  return { diamonds: amount('Diamond'), iron: amount('Iron') }
}

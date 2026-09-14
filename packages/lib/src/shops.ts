import { parseCsv } from './csv.ts'
import { parseCoordinates, type Coords } from './coords.ts'
import { itemIconUrl } from './minecraft.ts'

/**
 * The shop database, as rows: a CSV uploaded to Sanity as a `shopEntry`.
 * `getShops()` in queries.ts fetches it; everything here is pure so it can be
 * tested without a network.
 *
 * Everything the page needs — display name, cleaned lore, icon URL — is
 * derived here, once, on the server, and shared by the table cell, map pin,
 * popup and sidebar row.
 */

export type Shop = {
  /** Stable within one CSV: its row number. The data carries no id. */
  id: string
  input: ShopItem
  output: ShopItem
  /** As written, e.g. "3183,70,4854". */
  coordinates: string
  /** Null when the coordinates are unreadable — the row still lists, it just
   *  cannot be mapped. */
  position: Coords | null
  /** `Exchanges_Available`. */
  inStock: boolean
  city: string
  tags: string[]
  contact: string
}

export type ShopItem = {
  /** What to show: the item text plus any "(CI)" / "(Crate)" marker. */
  label: string
  /** Lore with its markers removed and its formatting codes stripped, or ''. */
  lore: string
  /** null when there is no icon to look up. */
  icon: string | null
}

/* Column order in the CSV. */
const TIMESTAMP = 0
const INPUT = 1
const INPUT_LORE = 2
const OUTPUT = 3
const OUTPUT_LORE = 4
const COORDINATES = 5
const IN_STOCK = 6
const CITY = 7
const TAGS = 8
const CONTACT = 9

/**
 * Two lore keywords are really flags on the item, so they move into the name
 * and out of the lore text: a compacted item and a crate.
 */
function readItem(text: string, lore: string, icon: string | null): ShopItem {
  let label = text
  let rest = lore

  for (const [keyword, marker] of [
    ['Compacted Item', 'CI'],
    ['Crate', 'Crate'],
  ] as const) {
    if (!rest.includes(keyword)) continue
    label += ` (${marker})`
    rest = rest.replace(new RegExp(`${keyword},?\s*`, 'gi'), '').trim()
  }

  return {
    label,
    icon,
    lore: rest
      /* Lore is one field with pipe-separated lines, and a leading pipe is a
         separator rather than an empty first line. */
      .replace(/^\s*\|/, '')
      .replace(/\|/g, '\n')
      /* Minecraft colour codes, which would otherwise render as §a literals. */
      .replace(/§[a-zA-Z]/g, '')
      .trim(),
  }
}

export function parseShops(csv: string): Shop[] {
  return parseCsv(csv)
    .slice(1)
    .filter((row) => row.length > CONTACT && row[TIMESTAMP])
    .map((row, index) => ({
      id: String(index),
      input: readItem(row[INPUT], row[INPUT_LORE], itemIconUrl(row[INPUT], row[INPUT_LORE])),
      output: readItem(row[OUTPUT], row[OUTPUT_LORE], itemIconUrl(row[OUTPUT], row[OUTPUT_LORE])),
      coordinates: row[COORDINATES],
      position: parseCoordinates(row[COORDINATES]),
      /* The column holds 'TRUE' and 'FALSE'. */
      inStock: row[IN_STOCK].trim().toUpperCase() === 'TRUE',
      city: row[CITY],
      tags: row[TAGS].split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      contact: row[CONTACT],
    }))
}

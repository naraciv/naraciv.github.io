/** CivMC world coordinates. Minecraft X/Z — not latitude and longitude. */
export type Coords = { x: number; z: number; y?: number }

/**
 * Parse a free-text coordinate string as written by hand in Sanity or in game.
 *
 * Handles "X: 120, Y: 64, Z: -450", "120 64 -450", "3227/4792", "x=-100y=200".
 * Two numbers are read as X/Z; three or more as X/Y/Z, extras ignored.
 *
 * Matches `-?\d+` rather than splitting on whitespace, so any separator
 * ("3227/4792") works. A stray number in prose still throws it off.
 */
export function parseCoordinates(input: string | null | undefined): Coords | null {
  const matches = input?.match(/-?\d+/g)
  if (!matches || matches.length < 2) return null
  const n = matches.map((m) => parseInt(m, 10))
  return matches.length === 2 ? { x: n[0], z: n[1] } : { x: n[0], y: n[1], z: n[2] }
}

/** Format for display and for the copy-to-clipboard chip. */
export function formatCoordinates({ x, y, z }: Coords): string {
  return y === undefined ? `${x}, ${z}` : `${x}, ${y}, ${z}`
}

/**
 * World XZ to the Leaflet CRS.Simple lat/lng pair the tile pyramid is laid out
 * in. Z grows south, latitude grows north, so Z is negated.
 */
export function worldToLatLng(x: number, z: number): [number, number] {
  return [-z, x]
}

export function latLngToWorld(lat: number, lng: number): Coords {
  return { x: lng, z: -lat }
}

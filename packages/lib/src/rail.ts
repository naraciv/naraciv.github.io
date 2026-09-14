/**
 * Rail route finding.
 *
 * BFS over a directed graph of rail legs, so a route is the one with the fewest
 * changes.
 *
 * The legs live here rather than in a data file: there are three of them,
 * hand-edited. A Sanity `railPath` type keyed to `city`
 * documents so the graph stops matching on lowercased strings — when that
 * lands, this array is what it replaces.
 */
import { parseCoordinates } from './coords.ts'

export type RailLeg = {
  departure_city: string
  departure_country: string
  departure_coordinates: string
  line_name: string
  arrival_city: string
  arrival_country: string
  arrival_coordinates: string
  dest_command: string
}

export const RAIL_PATHS: RailLeg[] = [
  {
    departure_city: 'Pavia City',
    departure_country: 'Pavia',
    departure_coordinates: '',
    line_name: 'Nara Direct Line',
    arrival_city: 'Shiroyama',
    arrival_country: 'Nara',
    arrival_coordinates: '',
    dest_command: '',
  },
  {
    departure_city: 'Shiroyama',
    departure_country: 'Nara',
    departure_coordinates: 'x:3456, y:73, z:4822',
    line_name: 'Nara Overland Rail',
    arrival_city: 'Orakuru',
    arrival_country: 'Nara',
    arrival_coordinates: 'x:3826, y:133, z:6984',
    dest_command: '/dest Orakuru',
  },
  {
    departure_city: 'Shiroyama',
    departure_country: 'Nara',
    departure_coordinates: 'x:3456, y:73, z:4822',
    line_name: 'Nara Overland Rail',
    arrival_city: 'Karasu',
    arrival_country: 'Nara',
    arrival_coordinates: 'x:3320, y:86, z:5800',
    dest_command: '/dest Karasu',
  },
]

const key = (city: string) => city.toLowerCase().trim()

/** Fewest-changes route, or null when the destination is unreachable. */
export function findRoute(
  from: string,
  to: string,
  legs: RailLeg[] = RAIL_PATHS,
): RailLeg[] | null {
  const origin = key(from)
  const destination = key(to)
  if (origin === destination) return []

  const graph = new Map<string, RailLeg[]>()
  for (const leg of legs) {
    const at = key(leg.departure_city)
    graph.set(at, [...(graph.get(at) ?? []), leg])
  }

  const queue: { city: string; path: RailLeg[] }[] = [{ city: origin, path: [] }]
  const seen = new Set([origin])

  while (queue.length > 0) {
    const { city, path } = queue.shift()!
    for (const leg of graph.get(city) ?? []) {
      const arrival = key(leg.arrival_city)
      if (seen.has(arrival)) continue
      seen.add(arrival)
      const next = [...path, leg]
      if (arrival === destination) return next
      queue.push({ city: arrival, path: next })
    }
  }

  return null
}

/** Every city with a route to `destination`, for the "navigate from" list. */
export function getReachableDepartures(
  destination: string,
  legs: RailLeg[] = RAIL_PATHS,
): string[] {
  const cities = [...new Set(legs.flatMap((leg) => [leg.departure_city, leg.arrival_city]))]
  return cities.filter((city) => {
    if (key(city) === key(destination)) return false
    const route = findRoute(city, destination, legs)
    return route !== null && route.length > 0
  })
}

/** "(x, z)" — only X and Z; Y is never useful for finding a station. */
export function formatLegCoordinates(coordinates: string): string {
  const parsed = parseCoordinates(coordinates)
  return parsed ? `(${parsed.x}, ${parsed.z})` : ''
}

export type DirectionStep = {
  prefix: string
  lineName: string
  departureCity: string
  departureCoordinates: string
  arrivalCity: string
  arrivalCoordinates: string
  destCommand: string
}

/**
 * One step per leg, as data rather than an HTML string —
 * so the page can emphasise the coordinates and the `/dest` command without
 * anything being injected into markup.
 */
export function routeToDirections(legs: RailLeg[]): DirectionStep[] {
  return legs.map((leg, i) => ({
    prefix: legs.length === 1 ? 'Take' : i === 0 ? 'First, take' : 'Next, take',
    lineName: leg.line_name,
    departureCity: leg.departure_city,
    departureCoordinates: formatLegCoordinates(leg.departure_coordinates),
    arrivalCity: leg.arrival_city,
    arrivalCoordinates: formatLegCoordinates(leg.arrival_coordinates),
    destCommand: leg.dest_command?.trim() ?? '',
  }))
}

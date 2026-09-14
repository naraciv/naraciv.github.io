import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RAIL_PATHS,
  findRoute,
  formatLegCoordinates,
  getReachableDepartures,
  routeToDirections,
} from './rail.ts'

test('a direct leg is a one-step route', () => {
  const route = findRoute('Pavia City', 'Shiroyama')
  assert.equal(route?.length, 1)
  assert.equal(route?.[0].line_name, 'Nara Direct Line')
})

test('BFS finds a two-leg route through Shiroyama', () => {
  const route = findRoute('Pavia City', 'Orakuru')
  assert.equal(route?.length, 2)
  assert.deepEqual(
    route?.map((l) => l.arrival_city),
    ['Shiroyama', 'Orakuru'],
  )
})

test('city matching ignores case and surrounding space', () => {
  assert.equal(findRoute('  pAvIa cItY ', 'SHIROYAMA')?.length, 1)
})

test('the same city is an empty route, not null', () => {
  assert.deepEqual(findRoute('Shiroyama', 'Shiroyama'), [])
})

test('unreachable destinations are null, and the graph is directed', () => {
  assert.equal(findRoute('Shiroyama', 'Pavia City'), null)
  assert.equal(findRoute('Karasu', 'Orakuru'), null)
  assert.equal(findRoute('Shiroyama', 'Atlantis'), null)
})

test('reachable departures exclude the destination itself', () => {
  const departures = getReachableDepartures('Orakuru')
  assert.ok(departures.includes('Shiroyama'))
  assert.ok(departures.includes('Pavia City'))
  assert.ok(!departures.includes('Orakuru'))
})

test('coordinates render as X and Z only, dropping Y', () => {
  assert.equal(formatLegCoordinates('x:3456, y:73, z:4822'), '(3456, 4822)')
  assert.equal(formatLegCoordinates(''), '')
})

test('directions read as prose across multiple legs', () => {
  const steps = routeToDirections(findRoute('Pavia City', 'Karasu')!)
  assert.deepEqual(
    steps.map((s) => s.prefix),
    ['First, take', 'Next, take'],
  )
  assert.equal(steps[1].destCommand, '/dest Karasu')
  assert.equal(steps[1].arrivalCoordinates, '(3320, 5800)')
  assert.equal(routeToDirections(findRoute('Pavia City', 'Shiroyama')!)[0].prefix, 'Take')
})

test('every leg in the shipped data parses', () => {
  for (const leg of RAIL_PATHS) {
    assert.ok(leg.departure_city && leg.arrival_city && leg.line_name)
  }
})

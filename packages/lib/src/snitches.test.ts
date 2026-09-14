process.env.TZ = 'UTC'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cullTs,
  daysUntil,
  filterSnitches,
  fitSnitches,
  groupCounts,
  snitchAt,
  snitchStatus,
  type Snitch,
} from './snitches.ts'

const DAY = 86_400_000
const now = Date.parse('2026-09-13T00:00Z')
const snitch = (patch: Partial<Snitch>): Snitch => ({
  world: 'world',
  x: 0,
  y: 64,
  z: 0,
  group_name: 'Nara',
  name: null,
  type: 'jukebox',
  dormant_ts: null,
  ...patch,
})

test('status follows the dormant time and the two-month cull', () => {
  assert.equal(snitchStatus(snitch({}), now, 5), 'active')
  assert.equal(snitchStatus(snitch({ dormant_ts: now + 3 * DAY }), now, 5), 'will-dormant')
  assert.equal(snitchStatus(snitch({ dormant_ts: now + 9 * DAY }), now, 5), 'active')
  assert.equal(snitchStatus(snitch({ dormant_ts: now - DAY }), now, 5), 'dormant')
  /* Dormant since 1 July: culled on 1 September, which has passed. */
  assert.equal(
    snitchStatus(snitch({ dormant_ts: Date.parse('2026-07-01T00:00Z') }), now, 5),
    'culled',
  )
  assert.equal(
    cullTs(snitch({ dormant_ts: Date.parse('2026-07-01T00:00Z') })),
    Date.parse('2026-09-01T00:00Z'),
  )
  assert.equal(daysUntil(now + 2.5 * DAY, now), 3)
  assert.equal(daysUntil(now - 1, now), null)
})

test('filters apply world, group, Y and the ±10,000 bound; groups sort by size', () => {
  const all = [
    snitch({ x: 1 }),
    snitch({ x: 2, world: 'world_nether' }),
    snitch({ x: 3, group_name: 'Hidden' }),
    snitch({ x: 4, y: 10 }),
    snitch({ x: 20_000 }),
    snitch({ x: 5, group_name: null }),
  ]
  const shown = filterSnitches(all, {
    world: 'world',
    yMin: 50,
    yMax: 100,
    hiddenGroups: new Set(['Hidden']),
  })
  assert.deepEqual(
    shown.map((s) => s.x),
    [1, 5],
  )
  assert.deepEqual(groupCounts(all), [
    ['Nara', 4],
    ['Hidden', 1],
    ['Unknown', 1],
  ])
})

test('fit centres on the snitches and picks the closest zoom that fits', () => {
  const view = fitSnitches([snitch({ x: -500, z: 0 }), snitch({ x: 500, z: 200 })], 800)
  assert.deepEqual(view, { x: 0, z: 100, zoom: -2 })
  assert.equal(fitSnitches([], 700).zoom, -5)
})

test('hit testing reaches further in blocks as you zoom out', () => {
  const s = [snitch({ x: 100, z: 100 })]
  assert.equal(snitchAt(s, 108, 100, 0), s[0])
  assert.equal(snitchAt(s, 115, 100, 0), null)
  assert.equal(snitchAt(s, 400, 100, -6), s[0])
})

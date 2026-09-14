import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCoordinates, worldToLatLng, latLngToWorld } from './coords.ts'

test('parseCoordinates reads the shapes people actually write', () => {
  assert.deepEqual(parseCoordinates('X: 120, Y: 64, Z: -450'), { x: 120, y: 64, z: -450 })
  assert.deepEqual(parseCoordinates('120 -450'), { x: 120, z: -450 })
  assert.deepEqual(parseCoordinates('3227/4792'), { x: 3227, z: 4792 })
  assert.deepEqual(parseCoordinates('x=-100y=200'), { x: -100, z: 200 })
})

test('parseCoordinates rejects what it cannot read', () => {
  for (const bad of [null, undefined, '', 'Shiroyama', '3227'])
    assert.equal(parseCoordinates(bad), null)
})

test('latLng round-trips', () => {
  const [lat, lng] = worldToLatLng(3227, 4792)
  assert.deepEqual(latLngToWorld(lat, lng), { x: 3227, z: 4792 })
})

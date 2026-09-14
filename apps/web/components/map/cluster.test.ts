import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clusterByRadius, zoomScaledRadius } from './cluster.ts'

const at = (x: number, z: number) => ({ x, z })
const pos = (p: { x: number; z: number }) => p

test('points within the radius merge, points beyond it do not', () => {
  const clusters = clusterByRadius([at(0, 0), at(3, 0), at(100, 100)], 5, pos)
  assert.equal(clusters.length, 2)
  assert.equal(clusters[0].items.length, 2)
  assert.equal(clusters[1].items.length, 1)
})

test('a cluster keeps its seed position rather than recentring', () => {
  const [cluster] = clusterByRadius([at(0, 0), at(4, 0), at(4, 3)], 5, pos)
  assert.deepEqual({ x: cluster.x, z: cluster.z }, { x: 0, z: 0 })
  assert.equal(cluster.items.length, 3)
})

test('distance is Euclidean, not Chebyshev', () => {
  // (4,4) is 5.66 away, outside a radius of 5, though both axes are within it.
  assert.equal(clusterByRadius([at(0, 0), at(4, 4)], 5, pos).length, 2)
  assert.equal(clusterByRadius([at(0, 0), at(3, 4)], 5, pos).length, 1)
})

test('items with no position are skipped, not clustered at the origin', () => {
  const items = [at(0, 0), at(1, 1), at(0, 0)]
  const clusters = clusterByRadius(items, 5, (p) => (p.x === 1 ? null : p))
  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].items.length, 2)
})

test('an empty input yields no clusters', () => {
  assert.deepEqual(clusterByRadius([], 5, pos), [])
})

test('the shops radius widens as you zoom out', () => {
  assert.equal(zoomScaledRadius(2), 13)
  assert.ok(zoomScaledRadius(0) > zoomScaledRadius(2))
  assert.ok(zoomScaledRadius(-6) > 20000)
})

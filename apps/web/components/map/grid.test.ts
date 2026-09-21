import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESETS,
  formatCoordinateList,
  generateGridPoints,
  getZoneSamplePoints,
  isPointInPolygon,
  nearestVertex,
  selectWithinBorder,
} from './grid.ts'

const square = [
  { x: 0, z: 0 },
  { x: 1000, z: 0 },
  { x: 1000, z: 1000 },
  { x: 0, z: 1000 },
]

test('rectangular grids step by the preset spacing and hit the centre exactly', () => {
  const points = generateGridPoints({
    center: { x: 0, z: 0 },
    preset: PRESETS.city,
    bounds: { minX: 0, maxX: 202, minZ: 0, maxZ: 202 },
  })
  assert.ok(
    points.some((p) => p.x === 0 && p.z === 0),
    'centre is on the grid',
  )
  assert.ok(
    points.some((p) => p.x === 101 && p.z === 101),
    'one spacing away',
  )
  assert.ok(!points.some((p) => p.x === 50 && p.z === 50), 'nothing off-lattice')
})

test('circular grids hex-pack with odd rows shifted half a column', () => {
  const r = PRESETS.repellator.radius
  const dx = Math.floor(Math.sqrt(3) * r) // 166
  const dz = Math.floor(1.5 * r) // 144
  const points = generateGridPoints({
    center: { x: 0, z: 0 },
    preset: PRESETS.repellator,
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: dz + 10 },
  })
  assert.ok(
    points.some((p) => p.x === 0 && p.z === 0),
    'even row unshifted',
  )
  assert.ok(
    points.some((p) => p.x === Math.floor(dx / 2) && p.z === dz),
    'odd row shifted half a column',
  )
})

test('point-in-polygon needs three vertices and respects the boundary', () => {
  assert.equal(isPointInPolygon({ x: 5, z: 5 }, []), false)
  assert.equal(isPointInPolygon({ x: 5, z: 5 }, square.slice(0, 2)), false)
  assert.equal(isPointInPolygon({ x: 500, z: 500 }, square), true)
  assert.equal(isPointInPolygon({ x: 1500, z: 500 }, square), false)
})

test('strict selection is a subset of centre selection', () => {
  const args = { center: { x: 500, z: 500 }, preset: PRESETS.vault, polygon: square }
  const strict = selectWithinBorder({ ...args, mode: 'strict' as const })
  const centre = selectWithinBorder({ ...args, mode: 'center' as const })

  assert.ok(strict.length > 0, 'strict finds something')
  assert.ok(centre.length >= strict.length, 'centre is at least as permissive')
  const centreKeys = new Set(centre.map((p) => `${p.x},${p.z}`))
  for (const p of strict) {
    assert.ok(centreKeys.has(`${p.x},${p.z}`), `${p.x},${p.z} also selected by centre`)
  }
})

test('strict selection excludes a zone whose coverage crosses the border', () => {
  // A vault has radius 10, so a point 5 blocks inside the edge overlaps it.
  const edge = [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 100, z: 100 },
    { x: 0, z: 100 },
  ]
  const onEdge = { x: 5, z: 50 }
  assert.equal(isPointInPolygon(onEdge, edge), true, 'the point itself is inside')
  assert.equal(
    getZoneSamplePoints(onEdge, PRESETS.vault.radius, 'rect').every((s) =>
      isPointInPolygon(s, edge),
    ),
    false,
    'but its coverage is not',
  )
})

test('a border with fewer than three vertices selects nothing', () => {
  for (const polygon of [[], [{ x: 0, z: 0 }], square.slice(0, 2)]) {
    assert.deepEqual(
      selectWithinBorder({
        center: { x: 0, z: 0 },
        preset: PRESETS.city,
        polygon,
        mode: 'strict',
      }),
      [],
    )
  }
})

test('coordinates are formatted one per line, rounded', () => {
  assert.equal(
    formatCoordinateList([
      { x: 1.4, z: -2.6 },
      { x: 10, z: 20 },
    ]),
    '1, -3\n10, 20',
  )
})

test('right click picks the closest vertex in reach, and nothing outside it', () => {
  assert.equal(nearestVertex(square, { x: 990, z: 5 }, 20), 1)
  assert.equal(nearestVertex(square, { x: 500, z: 500 }, 20), -1)
  assert.equal(
    nearestVertex(
      [
        { x: 0, z: 0 },
        { x: 8, z: 0 },
      ],
      { x: 5, z: 0 },
      20,
    ),
    1,
  )
  assert.equal(nearestVertex([], { x: 0, z: 0 }, 20), -1)
})

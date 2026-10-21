import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeLayers,
  eachBlock,
  encodeLayers,
  HEAL_GAP,
  layerLength,
  mergeGroups,
  mergeLayers,
  mergeMarkers,
  moveSection,
  parseIceFile,
  planImport,
  type IceLayer,
  type IceMarker,
  type IcePath,
} from './iceroads.ts'

const A: IcePath = [
  [0, 0],
  [100, 0],
  [100, -50],
]
const B: IcePath = [
  [100, 0],
  [100, 200],
]
/* The same roads in a comparable form: path order and direction do not matter. */
const roads = (paths: IcePath[]) =>
  paths
    .map((p) => (JSON.stringify(p[0]) > JSON.stringify(p.at(-1)) ? [...p].reverse() : p))
    .map((p) => JSON.stringify(p))
    .sort()

const layer = (over: Partial<IceLayer> = {}): IceLayer => ({
  id: 'nara',
  name: 'Nara',
  updated: 1000,
  color: '#38bdf8',
  paths: [A],
  ...over,
})

test('junk input gives no layers and values are sanitized', () => {
  for (const junk of [null, 5, 'x', [], [1, 2], {}, { layers: 'no' }, { layers: [null, 3, {}] }])
    assert.deepEqual(parseIceFile(junk), [])
  const [l] = parseIceFile({
    layers: [
      {
        name: '  My Layer  ',
        color: 'red',
        updated: 'nope',
        paths: [
          [[1.6, 'x'], [1.4, 2.5], [NaN, 1], 'bad', [99999, 3]],
          [
            ['5', '600'],
            ['5', '660'],
          ],
          [[0, 0]],
        ],
      },
    ],
  })
  assert.equal(l.id, 'My Layer')
  assert.equal(l.name, 'My Layer')
  assert.equal(l.color, undefined)
  assert.ok(Math.abs(l.updated - Date.now()) < 5000)
  assert.deepEqual(l.paths, [
    [
      [1, 3],
      [30000, 3],
    ],
    [
      [5, 600],
      [5, 660],
    ],
  ])
})

test('every loose shape is accepted: bare layer, path list, single path, {x,z}', () => {
  const [bare] = parseIceFile({
    id: 'x'.repeat(200),
    updated: '2025-10-15T00:00:00Z',
    color: '#ABCDEF',
    paths: [A],
  })
  assert.equal(bare.id.length, 80)
  assert.equal(bare.updated, Date.UTC(2025, 9, 15))
  assert.equal(bare.color, '#abcdef')

  assert.deepEqual(roads(parseIceFile([A, B])[0].paths), roads([A, B]))
  assert.deepEqual(parseIceFile(A)[0].paths, [A])
  assert.deepEqual(
    parseIceFile([
      [
        { x: 0, z: 0 },
        { x: 5, z: 5 },
      ],
    ])[0].paths,
    [
      [
        [0, 0],
        [5, 5],
      ],
    ],
  )
  assert.equal(layerLength(layer({ paths: [A, B] })), 350)
})

test('planImport statuses', () => {
  const have = [layer()]
  const plan = (l: IceLayer) => planImport(have, [l])[0].status
  assert.equal(plan(layer({ id: 'other' })), 'new')
  assert.equal(plan(layer()), 'same')
  assert.equal(plan(layer({ updated: 9999 })), 'same')
  assert.equal(plan(layer({ updated: 2000, paths: [B] })), 'update')
  assert.equal(plan(layer({ updated: 500, paths: [B] })), 'older')
  assert.deepEqual(
    planImport([], [layer(), layer({ updated: 500, paths: [B] })]).map((p) => p.status),
    ['new', 'older'],
  )
})

test('unnamed files import as numbered layers and re-import as already loaded', () => {
  const a = parseIceFile([A])
  const b = parseIceFile([B])
  assert.equal(a[0].name, '')
  assert.equal(parseIceFile({ paths: [A] })[0].id, a[0].id)
  const merged = mergeLayers(mergeLayers([], a), b)
  assert.deepEqual(
    merged.map((l) => l.name),
    ['Imported Group 1', 'Imported Group 2'],
  )
  assert.equal(planImport(merged, parseIceFile([A]))[0].status, 'same')
})

test('mergeLayers unions paths and the newer copy wins name, colour and time', () => {
  const old = layer()
  const [m] = mergeLayers(
    [old],
    [layer({ name: 'Nara 2', updated: 3000, color: undefined, paths: [A, B] })],
  )
  assert.deepEqual(m.paths, [A, B])
  assert.equal(m.name, 'Nara 2')
  assert.equal(m.color, '#38bdf8')
  assert.equal(m.updated, 3000)

  const [o] = mergeLayers([old], [layer({ name: 'Stale', updated: 10, paths: [B] })])
  assert.deepEqual(o.paths, [A, B])
  assert.equal(o.name, 'Nara')
  assert.equal(o.updated, 1000)

  assert.deepEqual(
    mergeLayers([old], [layer({ id: 'new' })]).map((l) => l.id),
    ['nara', 'new'],
  )
})

test('link code round trip', async () => {
  const layers = [
    layer({ markers: [{ type: 'portal', x: 5, z: -7, name: 'Hub' }] }),
    layer({ id: 'w', name: 'Whiskia', paths: [B, A] }),
  ]
  const code = await encodeLayers(layers)
  assert.match(code, /^[\w-]+$/)
  assert.deepEqual(await decodeLayers(code), layers)
  assert.equal(await decodeLayers('garbage!'), null)
  assert.equal(await decodeLayers(''), null)
  assert.deepEqual(parseIceFile({ version: 2, layers }), layers)
})

test('markers: per group, optional, cleaned, merged as a union', () => {
  const [plain] = parseIceFile({ layers: [{ id: 'a', paths: [A] }] })
  assert.equal(plain.markers, undefined)
  const [g] = parseIceFile({
    layers: [
      {
        id: 'a',
        paths: [A],
        markers: [
          { type: 'trap', x: '12', z: 40.6, name: ' Pit ' },
          { type: 'trap', x: 12, z: 41 },
          { type: 'nope', x: 1, z: 1 },
          { type: 'vault', x: 1 },
          { type: 'exit', x: 99999, z: 0 },
        ],
      },
    ],
  })
  const markers: IceMarker[] = [
    { type: 'trap', x: 12, z: 41, name: 'Pit' },
    { type: 'exit', x: 30000, z: 0 },
  ]
  assert.deepEqual(g.markers, markers)
  /* A group with markers but no road is kept. */
  assert.equal(parseIceFile({ id: 'm', paths: [], markers }).length, 1)
  const extra = layer({ id: 'a', paths: [A], markers: [{ type: 'bunker', x: 0, z: 0 }] })
  assert.equal(planImport([g], [extra])[0].status, 'older')
  assert.equal(planImport([g], [layer({ id: 'a', paths: [A] })])[0].status, 'same')
  assert.deepEqual(mergeLayers([g], [extra])[0].markers, [
    ...markers,
    { type: 'bunker', x: 0, z: 0 },
  ])
  assert.deepEqual(mergeMarkers(markers, [markers[1]]), markers)
})

/* Recorded in-game: each long run was saved in pieces that stop 4-5 blocks short of the next. */
const RECORDED = {
  version: 2,
  layers: [
    {
      id: 'nara-shared',
      name: 'Naraiskia',
      updated: 1792095828878,
      paths: [
        [
          [3395, 4905],
          [3701, 4905],
          [3701, 5194],
        ],
        [
          [3701, 5198],
          [3701, 5771],
        ],
        [
          [3701, 5771],
          [3701, 6359],
        ],
        [
          [3701, 6362],
          [3701, 6958],
        ],
        [
          [3701, 6962],
          [3701, 7554],
        ],
        [
          [3701, 7558],
          [3701, 8163],
        ],
        [
          [3701, 8168],
          [3701, 8377],
          [3296, 8377],
        ],
        [
          [3292, 8377],
          [2677, 8377],
        ],
        [
          [2769, 8373],
          [2769, 8019],
          [2503, 8019],
        ],
        [
          [2499, 8020],
          [2080, 8020],
          [2080, 7804],
        ],
        [
          [2080, 7800],
          [2080, 7561],
        ],
      ],
    },
  ],
}

test('gaps between recorded pieces are joined, and roads stay straight', () => {
  const [layer] = parseIceFile(RECORDED)
  const gap = (end: [number, number], self: IcePath) =>
    Math.min(
      ...layer.paths
        .filter((p) => p !== self)
        .flatMap((p) =>
          p.slice(1).map((b, k) => {
            const a = p[k]
            const t = Math.max(
              0,
              Math.min(
                1,
                ((end[0] - a[0]) * (b[0] - a[0]) + (end[1] - a[1]) * (b[1] - a[1])) /
                  ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1),
              ),
            )
            return Math.hypot(
              end[0] - (a[0] + t * (b[0] - a[0])),
              end[1] - (a[1] + t * (b[1] - a[1])),
            )
          }),
        ),
    )
  for (const path of layer.paths) {
    for (const end of [path[0], path.at(-1)!]) {
      const d = gap(end, path)
      assert.ok(d === 0 || d > HEAL_GAP, `end ${end} left ${d.toFixed(1)} blocks from the road`)
    }
    path
      .slice(1)
      .forEach(([x, z], k) =>
        assert.ok(x === path[k][0] || z === path[k][1], 'straight: ' + JSON.stringify(path)),
      )
  }
  assert.equal(planImport([layer], parseIceFile(RECORDED))[0].status, 'same')
  // 11 pieces of one run and its branch join into 2 paths.
  // The branch's 8019/8020 step is straightened onto one line.
  assert.deepEqual(
    roads(layer.paths),
    roads([
      [
        [3395, 4905],
        [3701, 4905],
        [3701, 8377],
        [2677, 8377],
      ],
      [
        [2769, 8377],
        [2769, 8020],
        [2080, 8020],
        [2080, 7561],
      ],
    ]),
  )
})

test('gaps are only joined within a layer, never across groups', () => {
  const near = {
    id: 'b',
    paths: [
      [
        [0, 5],
        [0, 300],
      ],
    ],
  } // 5 blocks from layer a's road
  const layers = parseIceFile({
    layers: [
      {
        id: 'a',
        paths: [
          [
            [-200, 0],
            [200, 0],
          ],
        ],
      },
      near,
    ],
  })
  assert.deepEqual(layers[1].paths, [
    [
      [0, 5],
      [0, 300],
    ],
  ])
})

test('wobbly paths are smoothed on import, and export then import gives the same data', () => {
  const wobble = Array.from({ length: 60 }, (_, i) => [i * 5, i % 3 === 0 ? 2 : -1])
  const [layer] = parseIceFile({ id: 'w', paths: [wobble] })
  assert.deepEqual(layer.paths, [
    [
      [0, 2],
      [295, 2],
    ],
  ])
  const all = [...parseIceFile(RECORDED), layer]
  const exported = JSON.parse(JSON.stringify({ version: 2, layers: all }))
  assert.deepEqual(parseIceFile(exported), all)
})

test('merging two groups makes one network, joined where they meet', () => {
  const groups = parseIceFile({
    layers: [
      {
        id: 'a',
        name: 'A',
        updated: 5,
        paths: [
          [
            [0, 0],
            [100, 0],
          ],
        ],
      },
      {
        id: 'b',
        name: 'B',
        updated: 9,
        paths: [
          [
            [104, 0],
            [300, 0],
          ],
        ],
      }, // 4 blocks short
      {
        id: 'c',
        name: 'C',
        paths: [
          [
            [0, 900],
            [0, 1000],
          ],
        ],
      },
    ],
  })
  const merged = mergeGroups(groups, 'b', 'a')
  assert.deepEqual(
    merged.map((g) => g.id),
    ['a', 'c'],
  )
  assert.deepEqual(merged[0].paths, [
    [
      [0, 0],
      [300, 0],
    ],
  ])
  assert.equal(merged[0].updated, 9)
  assert.equal(mergeGroups(groups, 'a', 'a'), groups)
})

test('a section moves out of its road into another group or a new one', () => {
  const groups = parseIceFile({
    layers: [
      {
        id: 'a',
        name: 'A',
        paths: [
          [
            [0, 0],
            [100, 0],
            [100, 100],
            [200, 200],
          ],
        ],
      },
      {
        id: 'b',
        name: 'B',
        paths: [
          [
            [100, 100],
            [100, 400],
          ],
        ],
      },
    ],
  })
  // The middle section, [100,0]-[100,100], into B: A splits around it, B gains it.
  const moved = moveSection(groups, { id: 'a', path: 0, segment: 1 }, 'b')
  assert.deepEqual(moved[0].paths, [
    [
      [0, 0],
      [100, 0],
    ],
    [
      [100, 100],
      [200, 200],
    ],
  ])
  assert.deepEqual(
    moved[1].paths.map((p) => [...p].sort((a, b) => a[1] - b[1])),
    [
      [
        [100, 0],
        [100, 400],
      ],
    ],
    'joined onto B as one straight road (either direction)',
  )

  // The diagonal into a new group, twice: names stay unique.
  const once = moveSection(groups, { id: 'a', path: 0, segment: 2 }, { name: 'Spur' })
  const twice = moveSection(once, { id: 'a', path: 0, segment: 0 }, { name: 'Spur' })
  assert.deepEqual(
    twice.map((g) => [g.id, g.name]),
    [
      ['a', 'A'],
      ['b', 'B'],
      ['Spur', 'Spur'],
      ['Spur 2', 'Spur'],
    ],
  )
  assert.deepEqual(once.at(-1)!.paths, [
    [
      [100, 100],
      [200, 200],
    ],
  ])

  // Moving a group's only section empties it, so the group goes.
  const lone = parseIceFile({
    layers: [
      {
        id: 'x',
        paths: [
          [
            [0, 0],
            [50, 0],
          ],
        ],
      },
      groups[1],
    ],
  })
  assert.deepEqual(
    moveSection(lone, { id: 'x', path: 0, segment: 0 }, 'b').map((g) => g.id),
    ['b'],
  )
})

test('runs out to a dead end and back leave no doubled or slanted lines', () => {
  // From a real recording: dead ends at 2395, 8997, 7868 and 8037 were run out and back.
  const [group] = parseIceFile([
    [3395, 4905],
    [3701, 4905],
    [3701, 8377],
    [2395, 8377],
    [3701, 8377],
    [3701, 8997],
    [3701, 7827],
    [4154, 7827],
    [4154, 7868],
    [4163, 7828],
    [4726, 7828],
    [4726, 8037],
    [4726, 7833],
    [4735, 7828],
    [5409, 7828],
  ])
  const blocks = new Set<string>()
  let drawn = 0
  for (const path of group.paths) {
    path.slice(1).forEach(([x, z], k) => {
      const [dx, dz] = [Math.abs(x - path[k][0]), Math.abs(z - path[k][1])]
      assert.ok(!dx || !dz || dx === dz, 'straight or 45°: ' + JSON.stringify(path))
      if (k) {
        const [px, pz] = [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]]
        assert.ok(
          px * (x - path[k][0]) + pz * (z - path[k][1]) >= 0,
          'no doubling back: ' + JSON.stringify(path),
        )
      }
    })
    eachBlock(path, (x, z) => {
      drawn++
      blocks.add(`${x},${z}`)
    })
  }
  // Only the blocks where roads meet are shared.
  assert.ok(
    drawn - blocks.size <= 3 * group.paths.length,
    `${drawn - blocks.size} blocks drawn twice`,
  )
})

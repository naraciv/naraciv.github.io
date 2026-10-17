// Runs the JsMacros ice road mapper (public/iceroads/iceroadMapper.js) against a fake
// world with no World at all, so any block or dimension read throws. The runner only
// has X, Y and Z; the site's own parser reads the result.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parseIceFile } from '../../../../packages/lib/src/iceroads.ts'

const src = fs.readFileSync(
  new URL('../../public/iceroads/iceroadMapper.js', import.meta.url),
  'utf8',
)

const disk = {}
/* peek(tick): called every tick with the file as it is on disk at that moment. */
function run(trajectory, peek) {
  let i = 0
  const pos = () => trajectory[Math.min(i, trajectory.length - 1)]
  /* [x, z] or [x, z, y]; y defaults to ice road depth. */
  const runner = {
    getX: () => pos()[0] + 0.5,
    getY: () => pos()[2] ?? -60,
    getZ: () => pos()[1] + 0.5,
  }
  const logs = []
  const ctx = {
    Player: {
      getPlayer: () => runner,
    },
    FS: {
      exists: (p) => p in disk,
      createFile: (dir, name) => ((disk[dir + name] = ''), true),
      open: (p) => ({ read: () => disk[p], write: (s) => ((disk[p] = s), null) }),
    },
    KeyBind: { getPressedKeys: () => ({ contains: () => i >= trajectory.length }) },
    Client: { waitTick: () => (peek?.(i, disk['./iceroads.json']), i++) },
    Chat: { log: (m) => logs.push(String(m)) },
    JSON,
    Math,
    Date,
  }
  vm.runInNewContext(src, ctx)
  return { file: JSON.parse(disk['./iceroads.json']), logs }
}

// Wobbly run along a polyline, ~3 blocks per tick (faster than real, to stress sampling).
function drive(...corners) {
  const out = []
  for (let c = 1; c < corners.length; c++) {
    const [ax, az] = corners[c - 1]
    const [bx, bz] = corners[c]
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3)
    for (let s = 0; s < n; s++) {
      const t = s / n
      const wobble = Math.round(Math.sin(out.length * 1.7) * 2) // swerve ±2 blocks
      const x = Math.round(ax + (bx - ax) * t) + (ax === bx ? wobble : 0)
      const z = Math.round(az + (bz - az) * t) + (az === bz ? wobble : 0)
      out.push([x, z])
    }
  }
  out.push(corners[corners.length - 1])
  return out
}
/* Stepping off somewhere far away: the jump ends the stretch, like stopping the script. */
const away = (n) => Array.from({ length: n }, () => [5000, 5000])

test('maps new road once, joins branches to it, and the site reads the file', () => {
  // Session 1: drive road A end to end.
  let { file } = run([...drive([0, 0], [300, 0]), ...away(30)])
  let paths = file.layers[0].paths
  assert.equal(paths.length, 1, 'one path for road A')
  assert.ok(paths[0].length <= 3, 'simplified to its ends: ' + JSON.stringify(paths[0]))

  // Session 2: back along A (already mapped), then down branch B.
  ;({ file } = run([...drive([300, 0], [150, 0], [150, 200]), ...away(30)]))
  paths = file.layers[0].paths
  assert.equal(paths.length, 2, 'only the branch is new: ' + JSON.stringify(paths))
  const [bStart, bEnd] = [paths[1][0], paths[1][paths[1].length - 1]]
  assert.ok(
    Math.abs(bStart[0] - 150) <= 4 && Math.abs(bStart[1]) <= 4,
    'branch starts on road A: ' + bStart,
  )
  assert.ok(Math.abs(bEnd[1] - 200) <= 3, 'branch reaches its end: ' + bEnd)
  assert.equal(paths[1].length, 2, 'branch simplified to its ends: ' + JSON.stringify(paths[1]))
  for (const path of paths)
    assert.ok(
      path[0][0] === path[1][0] || path[0][1] === path[1][1],
      'straight: ' + JSON.stringify(path),
    )

  // Session 3: everything again, plus a teleport. Nothing new.
  ;({ file } = run([
    ...drive([0, 0], [150, 0], [150, 200]),
    [5000, 5000],
    ...drive([150, 200], [150, 0]),
  ]))
  assert.equal(file.layers[0].paths.length, 2, 'retracing adds nothing')
  assert.equal(file.layers[0].id, 'my-iceroads')
  assert.equal(file.version, 2)
  assert.deepEqual(parseIceFile(file)[0].paths, file.layers[0].paths)
})

test('a diagonal road is one exact 45° segment until it turns straight again', () => {
  for (const k of Object.keys(disk)) delete disk[k]
  run([...drive([0, 0], [300, 0]), ...away(30)]) // map road A first
  // Staircase diagonal: the runner zig-zags a block at a time, as on a real stepped road.
  const stairs = []
  for (let t = 0; t <= 150; t++) stairs.push([300 + t + (t % 2), t])
  const { file } = run([...stairs, ...drive([450, 150], [600, 150]), ...away(30)])
  // It starts where road A ends, so the two join: road A, diagonal, straight east.
  const [path] = file.layers[0].paths
  assert.equal(path.length, 4, 'start, corner, corner, end: ' + JSON.stringify(path))
  const [, a, b, c] = path
  assert.equal(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 'exact 45°: ' + JSON.stringify(path))
  assert.equal(b[1], c[1], 'then straight east')
})

test('nothing is recorded above Y -55, and climbing out ends the stretch', () => {
  for (const k of Object.keys(disk)) delete disk[k]
  const surface = drive([0, 500], [300, 500]).map(([x, z]) => [x, z, 64])
  const tunnel = drive([300, 500], [300, 800])
  const back = drive([300, 800], [600, 800]).map(([x, z]) => [x, z, -40])
  const { file } = run([...surface, ...tunnel, ...back])
  assert.deepEqual(
    file.layers[0].paths.map((p) => [p[0], p.at(-1)]),
    [
      [
        [300, 500],
        [300, 800],
      ],
    ],
    'only the stretch below -55',
  )
})

test('jagged paths from an older file are straightened, corners kept', () => {
  const zigzag = Array.from({ length: 41 }, (_, i) => [i * 5, i % 2 ? 2 : -1]) // east, swerving
  const down = Array.from({ length: 21 }, (_, i) => [200 + (i % 2 ? 1 : -2), i * 5]) // then south
  disk['./iceroads.json'] = JSON.stringify({
    version: 2,
    layers: [{ id: 'my-iceroads', name: 'Old', updated: 1, paths: [[...zigzag, ...down]] }],
  })
  const { file } = run(away(1))
  const [path] = file.layers[0].paths
  assert.equal(path.length, 3, 'start, corner, end: ' + JSON.stringify(path))
  assert.equal(path[0][1], path[1][1], 'east leg is straight')
  assert.equal(path[1][0], path[2][0], 'south leg is straight')
})

test('pieces that stop short of each other are joined into single paths', () => {
  // From a real recording: each piece starts 4-5 blocks past the end of the last.
  disk['./iceroads.json'] = JSON.stringify({
    version: 2,
    layers: [
      {
        id: 'my-iceroads',
        name: 'Real',
        updated: 1,
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
            [2769, 8373],
            [2769, 8019],
            [2503, 8019],
          ],
          [
            [2499, 8020],
            [2080, 8020],
            [2080, 7804],
          ],
        ],
      },
    ],
  })
  const { file } = run(away(1))
  assert.deepEqual(file.layers[0].paths.sort(), [
    [
      [2769, 8373],
      [2769, 8019],
      [2080, 8019],
      [2080, 7804],
    ],
    [
      [3395, 4905],
      [3701, 4905],
      [3701, 5771],
    ],
  ])
})

test('a long run is on disk as one path while still running', () => {
  for (const k of Object.keys(disk)) delete disk[k]
  let midway = null
  run([...drive([0, 1000], [900, 1000]), ...away(1)], (tick, onDisk) => {
    if (tick === 250) midway = JSON.parse(onDisk).layers[0].paths
  })
  // ~300 points in, the file already has the road so far, unbroken, from its start.
  assert.equal(midway.length, 1, JSON.stringify(midway))
  assert.deepEqual(midway[0][0], [0, 1000])
  // At tick 250 the runner is near x 750; 100 points at 3 blocks each is 300 blocks behind.
  assert.ok(midway[0].at(-1)[0] >= 450, 'saved within the last 100 points: ' + midway[0].at(-1))
})

test('a dead end run out and back is saved once, not drawn twice', () => {
  for (const k of Object.keys(disk)) delete disk[k]
  // East to a dead end at 300, back to 150, then down a side branch: all in one go.
  const { file } = run([...drive([0, 0], [300, 0], [150, 0], [150, 200]), ...away(1)])
  const paths = file.layers[0].paths
  for (const path of paths)
    path.slice(2).forEach(([x, z], k) => {
      const [a, b] = [path[k], path[k + 1]]
      const turn = (b[0] - a[0]) * (x - b[0]) + (b[1] - a[1]) * (z - b[1])
      assert.ok(turn >= 0, 'no path doubles back: ' + JSON.stringify(paths))
    })
  const covered = paths.flatMap((p) => p).map(([x]) => x)
  assert.ok(Math.max(...covered) >= 297, 'the dead end is kept: ' + JSON.stringify(paths))
  assert.ok(
    paths.some((p) => p.some(([, z]) => z >= 197)),
    'the branch is recorded: ' + JSON.stringify(paths),
  )
})

test('an unreadable iceroads.json is backed up, not overwritten', () => {
  disk['./iceroads.json'] = '{"layers": [broken'
  run(away(1))
  const backup = Object.keys(disk).find((k) => k.includes('iceroads.backup-'))
  assert.equal(disk[backup], '{"layers": [broken')
})

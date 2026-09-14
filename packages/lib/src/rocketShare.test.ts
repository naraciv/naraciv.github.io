import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TRIP,
  decodeTrip,
  encodeTrip,
  parseTripInput,
  sanitizeTrip,
  type TripConfig,
} from './rocketShare.ts'

const trip: TripConfig = {
  ...DEFAULT_TRIP,
  start: 'Zorweth',
  returnMode: 'split',
  split: { anchor: 'have', items: 120 },
  marginPct: 5,
  title: 'Base supply run',
  outbound: {
    players: 3,
    rows: [
      { kind: 'compacted64', amount: 12, unit: 'cs', note: 'Iron blocks' },
      { kind: 'unstackable', amount: 9, unit: 'items', note: 'Netherite tools' },
      { kind: 'rocketFuel', amount: 2, unit: 'stacks', note: '' },
    ],
  },
  inbound: { players: 2, rows: [{ kind: 'stack16', amount: 1, unit: 'chests', note: 'Pearls' }] },
}

test('a link code round-trips everything, labels included, in a few hundred characters', async () => {
  const code = await encodeTrip(trip)
  assert.match(code, /^[\w-]+$/)
  assert.ok(code.length < 300, `code is ${code.length} chars`)
  assert.deepEqual(await decodeTrip(code), trip)
  assert.deepEqual(await parseTripInput(`https://nara.rocks/rocket#t=${code}`), trip)
  assert.deepEqual(await parseTripInput(JSON.stringify(trip)), trip)
})

test('untrusted input is cleaned, not trusted', async () => {
  const dirty = sanitizeTrip({
    start: 'moon',
    marginPct: -5,
    title: 'x'.repeat(500),
    outbound: { players: 0, rows: [{ kind: 'bomb', amount: 'lots', unit: 'tons', note: 7 }] },
  })
  assert.equal(dirty.start, 'main')
  assert.equal(dirty.marginPct, 0)
  assert.equal(dirty.title.length, 60)
  assert.deepEqual(dirty.outbound, {
    players: 1,
    rows: [{ kind: 'stack64', amount: 0, unit: 'items', note: '' }],
  })
  assert.equal(await parseTripInput('not a trip!'), null)
  assert.equal(await decodeTrip('AAAA'), null)
})

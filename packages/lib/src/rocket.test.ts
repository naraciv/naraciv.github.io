import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemMassKg, leg, planTrip, remainingFuelKg, type TripInput } from './rocket.ts'

const near = (actual: number, expected: number, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ≉ ${expected}`)

const empty = { players: 1, items: [] }
const trip = (patch: Partial<TripInput>): TripInput => ({
  outbound: empty,
  returnFuel: { atDestinationKg: 0 },
  fuelInComputerKg: 0,
  deltaV: { out: 10_000, back: 6_000 },
  margin: 0,
  ...patch,
})

test('item masses follow LaunchHandler.calculateItemMass', () => {
  assert.equal(itemMassKg({ kind: 'stack64', count: 64 }), 1)
  assert.equal(itemMassKg({ kind: 'stack16', count: 16 }), 1)
  assert.equal(itemMassKg({ kind: 'unstackable', count: 3 }), 3)
  assert.equal(itemMassKg({ kind: 'compacted64', count: 64 }), 64)
  assert.equal(itemMassKg({ kind: 'compacted16', count: 1 }), 1)
  assert.equal(itemMassKg({ kind: 'compactedUnstackable', count: 2 }), 16)
  assert.equal(itemMassKg({ kind: 'rocketFuel', count: 10 }), 40)
  assert.equal(itemMassKg({ kind: 'crudeOil', count: 10 }), 5)
  /* Partial stacks are fractional, not rounded: 32 of a 64-stack is half a kilo. */
  assert.equal(itemMassKg({ kind: 'stack64', count: 32 }), 0.5)
})

test('an empty rocket with only the pilot, by hand: 160 kg × (e² − 1)', () => {
  const l = leg(empty, 10_000)
  near(l.nonFuelKg, 160)
  near(l.burnKg, 160 * (Math.exp(2) - 1))
  /* Zero passengers still counts the pilot. */
  near(leg({ players: 0, items: [] }, 10_000).nonFuelKg, 160)
})

test('burning exactly the requirement lands with nothing left', () => {
  const l = leg(empty, 10_000)
  near(remainingFuelKg(l.burnKg, l), 0)
})

test('one way loads ceil(1022.25 / 4) items', () => {
  const plan = planTrip(trip({}))
  assert.equal(plan.loadAtStartItems, 256)
  assert.equal(plan.loadAtDestinationItems, 0)
  assert.equal(plan.arriveHomeKg, null)
})

test('carried return fuel is enough for the way home, and costs e² per kg', () => {
  const plan = planTrip(trip({ inbound: empty }))
  const back = 160 * (Math.exp(1.2) - 1)
  assert.equal(plan.loadAtStartItems, Math.ceil((160 * (Math.exp(2) - 1) + back * Math.exp(2)) / 4))
  assert.ok(plan.arriveDestinationKg >= back)
  assert.equal(plan.loadAtDestinationItems, 0)
  assert.ok(plan.arriveHomeKg! >= 0)
})

test('carrying return fuel in the computer matches packing it in chests', () => {
  const carried = planTrip(trip({ inbound: empty })).loadAtStartItems
  const backItems = Math.ceil((160 * (Math.exp(1.2) - 1)) / 4)
  const packed = planTrip(
    trip({ outbound: { players: 1, items: [{ kind: 'rocketFuel', count: backItems }] } }),
  ).loadAtStartItems
  /* Equal up to rounding of the two separate item counts. */
  assert.ok(Math.abs(packed + backItems - carried) <= 2)
})

test('filling up at the destination splits the load, and fuel already aboard is used first', () => {
  const plan = planTrip(trip({ inbound: empty, returnFuel: { bringKg: 0 } }))
  assert.equal(plan.loadAtStartItems, 256)
  assert.ok(plan.loadAtDestinationItems > 0)
  assert.equal(planTrip(trip({ fuelInComputerKg: 2000 })).loadAtStartItems, 0)
})

test('a split brings part of the return fuel and fills the rest at the destination', () => {
  const need = 160 * (Math.exp(1.2) - 1)
  const bring = planTrip(trip({ inbound: empty, returnFuel: { bringKg: 200 } }))
  assert.ok(bring.arriveDestinationKg >= 200)
  assert.equal(bring.loadAtDestinationItems, Math.ceil((need - bring.arriveDestinationKg) / 4))

  /* 300 kg waiting at the destination: bring only the ~71 kg shortfall. */
  const have = planTrip(trip({ inbound: empty, returnFuel: { atDestinationKg: 300 } }))
  near(have.carriedKg, need - 300)
  assert.ok(have.loadAtDestinationItems * 4 <= 300)
  assert.ok(have.arriveDestinationKg + have.loadAtDestinationItems * 4 >= need)
})

test('starting on Zorweth swaps the legs: the cheap 6,000 m/s burn goes first', () => {
  const fromZorweth = planTrip(trip({ inbound: empty, deltaV: { out: 6_000, back: 10_000 } }))
  const back = 160 * (Math.exp(2) - 1)
  assert.equal(
    fromZorweth.loadAtStartItems,
    Math.ceil((160 * (Math.exp(1.2) - 1) + back * Math.exp(1.2)) / 4),
  )
})

test('rounds up a requirement a hair over a whole item, as the server does', () => {
  /* Found by sweeping 41M cargo masses against LaunchHandler's Java: needs 15,056.0000000027 kg. */
  const load = { players: 1, items: [{ kind: 'stack64' as const, count: 6329.328125 * 64 }] }
  assert.ok(leg(load, 6000).burnKg > 15056)
  const plan = planTrip({
    outbound: load,
    returnFuel: { bringKg: 0 },
    fuelInComputerKg: 0,
    deltaV: { out: 6000, back: 6000 },
    margin: 0,
  })
  assert.equal(plan.loadAtStartItems, 3765)
})

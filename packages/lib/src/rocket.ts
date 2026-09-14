/**
 * Zorweth rocket fuel, as the server computes it.
 *
 * Mirrors LaunchHandler.java in CivMC/Civ (plugins/zorweth-paper, commit
 * 8e275dd). The wiki predates two balance changes, so where they disagree the
 * code wins: the rocket's dry mass is 150 kg (wiki: 200) and a seated player
 * 10 kg (wiki: 50).
 *
 * The launch check is the Tsiolkovsky rocket equation solved for fuel:
 *
 *   fuel ≥ (dry + cargo + players × 10) × (e^(Δv / vₑ) − 1)
 *
 * Only fuel already inside the flight computer is excluded from that mass.
 * Fuel items packed in chests are cargo, 4 kg each, like anything else.
 */

export const ROCKET = {
  dryMassKg: 150,
  playerMassKg: 10,
  fuelItemKg: 4,
  exhaustVelocity: 5_000,
  maxUses: 6,
  /** 22 single chests. */
  chestSlots: 22 * 27,
} as const

/** A passenger's main inventory. Armour and off-hand slots are left out. */
export const PLAYER_SLOTS = 36

/** Per the wiki. The server reads one configured value per side. */
export const DELTA_V = { toZorweth: 10_000, toMain: 6_000 } as const

/**
 * The server weighs an item stack as `amount / maxStackSize` kg — a full stack
 * is 1 kg whatever it holds — except compacted items, which count as
 * `compactSize` items each (64, 16, or 8 for unstackables), and the two fuels,
 * which have fixed masses.
 */
export const ITEM_KINDS = {
  stack64: { label: 'Items that stack to 64', maxStack: 64, compactSize: 1, kg: null },
  stack16: { label: 'Items that stack to 16', maxStack: 16, compactSize: 1, kg: null },
  unstackable: { label: 'Unstackable items', maxStack: 1, compactSize: 1, kg: null },
  compacted64: { label: 'Compacted items (64)', maxStack: 64, compactSize: 64, kg: null },
  compacted16: { label: 'Compacted items (16)', maxStack: 16, compactSize: 16, kg: null },
  compactedUnstackable: {
    label: 'Compacted unstackables',
    maxStack: 1,
    compactSize: 8,
    kg: null,
  },
  rocketFuel: { label: 'Rocket Fuel', maxStack: 64, compactSize: 1, kg: 4 },
  crudeOil: { label: 'Crude oil', maxStack: 64, compactSize: 1, kg: 0.5 },
} as const

export type ItemKind = keyof typeof ITEM_KINDS
export type ItemLine = { kind: ItemKind; count: number }
export type Load = { players: number; items: ItemLine[] }

export function itemMassKg({ kind, count }: ItemLine): number {
  const spec = ITEM_KINDS[kind]
  if (spec.kg !== null) return count * spec.kg
  return (count * spec.compactSize) / spec.maxStack
}

export type Leg = {
  cargoKg: number
  /** The pilot always counts: the server uses max(1, passengers). */
  playerKg: number
  /** Rocket + cargo + players: everything except the fuel being burned. */
  nonFuelKg: number
  massRatio: number
  /** Fuel this leg burns. */
  burnKg: number
  slots: number
  slotCapacity: number
}

export function leg(load: Load, deltaV: number): Leg {
  const cargoKg = load.items.reduce((kg, line) => kg + itemMassKg(line), 0)
  const players = Math.max(1, load.players)
  const playerKg = players * ROCKET.playerMassKg
  const nonFuelKg = ROCKET.dryMassKg + cargoKg + playerKg
  const massRatio = Math.exp(deltaV / ROCKET.exhaustVelocity)
  return {
    cargoKg,
    playerKg,
    nonFuelKg,
    massRatio,
    burnKg: nonFuelKg * (massRatio - 1),
    slots: load.items.reduce((n, l) => n + Math.ceil(l.count / ITEM_KINDS[l.kind].maxStack), 0),
    slotCapacity: ROCKET.chestSlots + players * PLAYER_SLOTS,
  }
}

/** What is left in the flight computer on landing — LaunchHandler.getRemainingFuel. */
export function remainingFuelKg(fuelKg: number, l: Leg): number {
  return (fuelKg + l.nonFuelKg) / l.massRatio - l.nonFuelKg
}

export type ReturnFuel = { bringKg: number } | { atDestinationKg: number }

export type TripInput = {
  outbound: Load
  /** Absent for a one-way trip. */
  inbound?: Load
  /**
   * Where the fuel for the way home comes from.
   *
   * `{ bringKg }`: bring this much extra, top up the rest at the destination.
   * `{ atDestinationKg }`: this much is waiting there; bring the shortfall.
   * `{ atDestinationKg: 0 }` brings it all; `{ bringKg: 0 }` fills it all there.
   *
   * Direction-free: a trip can start on main or on Zorweth, and the caller
   * passes the Δv for each leg in order.
   *
   * Brought fuel rides in the flight computer. Unburnt fuel lands with the
   * rocket, and costs exactly what packing fuel items in chests would — the
   * extra mass is multiplied by the same ratio either way — but takes no
   * slots and is rounded once.
   */
  returnFuel: ReturnFuel
  /** Fuel already in the flight computer before loading. */
  fuelInComputerKg: number
  deltaV: { out: number; back: number }
  /** Extra fuel on every burn, as a fraction: 0.05 is 5%. */
  margin: number
}

export type TripPlan = {
  legs: Leg[]
  /** Rocket fuel items to put in the flight computer where the trip starts. */
  loadAtStartItems: number
  /** Rocket fuel items to put in the flight computer at the destination; 0 when carried. */
  loadAtDestinationItems: number
  /** Fuel meant for the way home that is lifted from the start, before rounding. */
  carriedKg: number
  /** In the computer after landing at the destination, with the rounded load. */
  arriveDestinationKg: number
  /** In the computer after landing back where it started; null for one-way. */
  arriveHomeKg: number | null
}

const carriedFor = (returnFuel: ReturnFuel, needKg: number) =>
  Math.max(0, 'bringKg' in returnFuel ? returnFuel.bringKg : needKg - returnFuel.atDestinationKg)

/*
 * A plain ceil, as LaunchHandler's requiredFuelItems. The launch check is an exact
 * `fuelKg < requiredFuelKg` on doubles, so rounding a hair-over value down (an earlier
 * `- 1e-9` did) left the rocket one item short: e.g. 6,329.328125 kg of cargo, one
 * player, Δv 6,000 needs 15,056.0000000027 kg — 3,765 items, not 3,764.
 */
const items = (kg: number) => Math.max(0, Math.ceil(kg / ROCKET.fuelItemKg))

export function planTrip(input: TripInput): TripPlan {
  const out = leg(input.outbound, input.deltaV.out)
  const back = input.inbound ? leg(input.inbound, input.deltaV.back) : null
  const burn = (l: Leg) => l.burnKg * (1 + input.margin)

  const carried = back ? carriedFor(input.returnFuel, burn(back)) : 0
  /* Fuel that must still be in the computer on landing costs massRatio times
     its own mass to lift. */
  const neededAtStartKg = burn(out) + carried * out.massRatio

  const loadAtStartItems = items(neededAtStartKg - input.fuelInComputerKg)
  const launchKg = input.fuelInComputerKg + loadAtStartItems * ROCKET.fuelItemKg
  const arriveDestinationKg = Math.max(0, remainingFuelKg(launchKg, out))

  let loadAtDestinationItems = 0
  let arriveHomeKg: number | null = null
  if (back) {
    loadAtDestinationItems = items(burn(back) - arriveDestinationKg)
    const returnLaunchKg = arriveDestinationKg + loadAtDestinationItems * ROCKET.fuelItemKg
    arriveHomeKg = Math.max(0, remainingFuelKg(returnLaunchKg, back))
  }

  return {
    legs: back ? [out, back] : [out],
    loadAtStartItems,
    loadAtDestinationItems,
    carriedKg: carried,
    arriveDestinationKg,
    arriveHomeKg,
  }
}

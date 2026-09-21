import { DELTA_V, ITEM_KINDS, PLAYER_SLOTS, ROCKET, planTrip, type TripInput } from '@nara/lib'

/** The rocket equation's constants, and /planner's known delta-v values. */
export async function GET() {
  return Response.json({ ...ROCKET, playerSlots: PLAYER_SLOTS, deltaV: DELTA_V, itemKinds: ITEM_KINDS })
}

function isLoad(v: unknown): v is TripInput['outbound'] {
  const load = v as { players?: unknown; items?: unknown[] } | null
  return (
    typeof load?.players === 'number' &&
    Array.isArray(load.items) &&
    load.items.every((item) => {
      const { count, kind } = item as { count?: unknown; kind?: unknown }
      return typeof count === 'number' && typeof kind === 'string' && kind in ITEM_KINDS
    })
  )
}

/** Same rocket-equation math as /rocket's calculator, as an API for agents to call directly. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<TripInput> | null
  if (
    !body ||
    !isLoad(body.outbound) ||
    (body.inbound !== undefined && !isLoad(body.inbound)) ||
    typeof body.fuelInComputerKg !== 'number' ||
    typeof body.margin !== 'number' ||
    typeof body.deltaV?.out !== 'number' ||
    typeof body.deltaV?.back !== 'number' ||
    typeof body.returnFuel !== 'object' ||
    body.returnFuel === null ||
    (!('bringKg' in body.returnFuel) && !('atDestinationKg' in body.returnFuel))
  ) {
    return Response.json(
      {
        error:
          'Expected { outbound: {players, items}, inbound?, returnFuel: {bringKg} | {atDestinationKg}, fuelInComputerKg, deltaV: {out, back}, margin }',
      },
      { status: 400 },
    )
  }

  return Response.json(planTrip(body as TripInput))
}

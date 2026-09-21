import { getShops } from '@nara/lib'

/** Same data as /shops, as JSON for agents. */
export const revalidate = 300

export async function GET() {
  return Response.json(await getShops())
}

import { getGovernmentRoles, getOrganizations } from '@nara/lib'

/** Same data as /government, as JSON for agents. */
export const revalidate = 300

export async function GET() {
  const [roles, organizations] = await Promise.all([getGovernmentRoles(), getOrganizations()])
  return Response.json({ roles, organizations })
}

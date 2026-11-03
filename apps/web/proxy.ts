import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { roleHolder, type GovernmentRole, type Head, type Organization, type Shop } from '@nara/lib'
import { GET as governmentGET } from '@/app/api/government/route'
import { GET as headsGET } from '@/app/api/heads/route'
import { GET as rocketGET } from '@/app/api/rocket/route'
import { GET as shopsGET } from '@/app/api/shops/route'
import { site } from '@/lib/site'

const llmsTxt = readFileSync(path.join(process.cwd(), 'public/llms.txt'), 'utf8')

const GROUP_TITLES: Record<GovernmentRole['group'], string> = {
  leadership: 'Leadership',
  daimyo: 'Daimyo',
  komuin: 'Komuin',
  other: 'Other Roles',
  populace: "Nara's Populace",
}

function governmentMarkdown(roles: GovernmentRole[], organizations: Organization[]): string {
  const groups = (Object.keys(GROUP_TITLES) as GovernmentRole['group'][])
    .map((group) => [GROUP_TITLES[group], roles.filter((r) => r.group === group)] as const)
    .filter(([, list]) => list.length > 0)

  const roleLines = groups.map(
    ([title, list]) =>
      `## ${title}\n\n` +
      list
        .map((r) => `- **${r.title}**${roleHolder(r) ? ` — ${roleHolder(r)}` : ''}: ${r.description}`)
        .join('\n'),
  )

  const orgLines = organizations.map((o) => `- **${o.title}**: ${o.description}`)

  return [
    `# Government of Nara`,
    `Source: ${site.url}/government`,
    ...roleLines,
    `## Organizations\n\n${orgLines.join('\n')}`,
  ].join('\n\n')
}

function shopsMarkdown(shops: Shop[]): string {
  const rows = shops.map(
    (s) =>
      `- **${s.input.label}** → **${s.output.label}** — ${s.city} (${s.coordinates})${s.inStock ? '' : ' — out of stock'} — contact: ${s.contact}`,
  )
  return [`# Nara Shops`, `Source: ${site.url}/shops`, rows.join('\n')].join('\n\n')
}

function headsMarkdown(heads: Head[]): string {
  const rows = heads.map(
    (h) =>
      `- **${h.name}** — ${h.price} — ${h.category} — ${h.coordinates}${h.inStock ? '' : ' — out of stock'}`,
  )
  return [
    `# MitsuHeadCorp Head Shop`,
    `Source: ${site.url}/heads`,
    `A private business, not the Naran government.`,
    rows.join('\n'),
  ].join('\n\n')
}

function rocketMarkdown(constants: Record<string, unknown>): string {
  return [
    `# Zorweth Rocket Fuel Calculator`,
    `Source: ${site.url}/rocket`,
    `The rocket equation's constants, as this server runs it:\n\n\`\`\`json\n${JSON.stringify(constants, null, 2)}\n\`\`\``,
    `To calculate a trip's fuel requirements, POST a trip plan to ${site.url}/api/rocket — see ${site.url}/openapi.json.`,
  ].join('\n\n')
}

const RENDERERS: Record<string, () => Promise<string>> = {
  '/': async () => llmsTxt,
  '/government': async () => {
    const { roles, organizations } = await (await governmentGET()).json()
    return governmentMarkdown(roles, organizations)
  },
  '/shops': async () => shopsMarkdown(await (await shopsGET()).json()),
  '/heads': async () => headsMarkdown(await (await headsGET()).json()),
  '/rocket': async () => rocketMarkdown(await (await rocketGET()).json()),
}

/** Markdown for agents on the pages we already have structured data for; everyone else gets the normal page. */
export async function proxy(request: NextRequest) {
  const render = RENDERERS[request.nextUrl.pathname]
  if (!render) return NextResponse.next()

  return new Response(await render(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' },
  })
}

/*
 * Only markdown requests reach the proxy. It runs as a Vercel Function, so
 * matching every visit and nav-link prefetch of these pages cost an invocation
 * each just to pass the request through. Literals, because Next reads the
 * matcher statically at build time.
 */
export const config = {
  matcher: [
    { source: '/', has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }] },
    { source: '/government', has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }] },
    { source: '/shops', has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }] },
    { source: '/heads', has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }] },
    { source: '/rocket', has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }] },
  ],
}

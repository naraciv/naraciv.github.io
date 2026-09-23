import type { Metadata } from 'next'
import { BookOpen, Book, Coffee, Crosshair, Mail, Star, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  fallbackRelations as relations,
  getGovernmentRoles,
  getOrganizations,
  roleHolder,
  type GovernmentRole,
  type Organization,
} from '@nara/lib'
import { Card, PageTitle, SectionHeading } from '@/components/ui'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Government',
  description:
    'Overview on the big gobernment and how Nara functions. Plus info on our citizens, national orgs and provinces.',
  alternates: { canonical: '/government' },
}

/** Role holders change with in-game politics; five minutes is plenty. */
export const revalidate = 300

const icons: Record<string, LucideIcon> = {
  star: Star,
  users: Users,
  crosshair: Crosshair,
  book: Book,
  coffee: Coffee,
  bookOpen: BookOpen,
  mail: Mail,
}

const intros: Record<string, string> = {
  leadership:
    'Nara is a meritocratic and feudalistic society with many different roles representing the responsibilities, position, and power of a person within Nara. The government is split into hierarchical groups, with positions granted on merit, trust, and activity.',
  daimyo: 'Regional lords who manage a Naran province and the day-to-day needs of their region.',
  komuin:
    "Highly regarded civil servants that help to manage a specific field relevant to Nara's interests.",
}

export default async function GovernmentPage() {
  const [roles, organizations] = await Promise.all([getGovernmentRoles(), getOrganizations()])
  const group = (g: GovernmentRole['group']) => roles.filter((r) => r.group === g)
  const named = roles.filter((r) => roleHolder(r) !== null)

  return (
    <div className="px-4 pt-[100px] pb-20">
      <div className="mx-auto max-w-6xl py-20">
        {named.length > 0 && (
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'Government of Nara',
              url: `${site.url}/government`,
              itemListElement: named.map((role, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'Role',
                  roleName: role.title,
                  description: role.description,
                  /* an open post has no person to name */
                  ...(roleHolder(role) === 'Vacant'
                    ? {}
                    : { holder: { '@type': 'Person', name: roleHolder(role) } }),
                },
              })),
            }}
          />
        )}

        <PageTitle className="mb-16">Naran Government</PageTitle>

        <section className="mb-20">
          <SectionHeading>Feudal Shogunate</SectionHeading>
          <p className="mb-8 text-xl">{intros.leadership}</p>
          <div className="mb-12 grid gap-8 md:grid-cols-3">
            {group('leadership').map((role) => {
              const Icon = role.icon ? icons[role.icon] : null
              return (
                <Card key={role._id} border="full">
                  <div className="mb-4 flex items-center">
                    {Icon && (
                      /* Dark glyph: 10:1 on #4FC3F7, where white is 2:1. */
                      <div className="mr-4 rounded-full bg-primary p-3">
                        <Icon aria-hidden className="size-6 text-ground" />
                      </div>
                    )}
                    <h3 className="text-2xl font-bold">{roleHolder(role)}</h3>
                  </div>
                  <p className="mb-1 font-semibold text-primary">{role.title}</p>
                  <p className="text-ink-2">{role.description}</p>
                </Card>
              )
            })}
          </div>
        </section>

        {(['daimyo', 'komuin'] as const).map((g) => (
          <section key={g} className="mb-20">
            <SectionHeading>{g === 'daimyo' ? 'Daimyo' : 'Komuin'}</SectionHeading>
            <p className="mb-8 text-xl">{intros[g]}</p>
            <div className="grid gap-6 md:grid-cols-2">
              {group(g).map((role) => (
                <Card key={role._id} border="left">
                  <h3 className="mb-1 text-xl font-bold text-primary">{roleHolder(role)}</h3>
                  <p className="mb-1 font-semibold text-primary">{role.title}</p>
                  <p className="text-ink-2">{role.description}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {(['other', 'populace'] as const).map((g) => (
          <section key={g} className="mb-20">
            <SectionHeading>{g === 'other' ? 'Other Roles' : "Nara's Populace"}</SectionHeading>
            <div className="grid gap-8 md:grid-cols-2">
              {group(g).map((role) => (
                <Card key={role._id}>
                  <h3 className="mb-4 text-2xl font-bold text-primary">{role.title}</h3>
                  <p className="text-ink-2">{role.description}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <section className="mb-20">
          <SectionHeading>International Relations</SectionHeading>
          <Card className="p-8">
            <p className="mb-6 text-lg">{relations.summary}</p>
            <h3 className="mt-8 mb-4 text-xl font-bold text-primary">Current Relations</h3>
            <p className="text-ink-2">{relations.current}</p>
          </Card>
        </section>

        {organizations.length > 0 && (
          <section>
            <SectionHeading>National Organizations</SectionHeading>
            <div className="grid gap-8 md:grid-cols-2">
              {organizations.map((org: Organization) => {
                const Icon = org.icon ? icons[org.icon] : null
                return (
                  <Card key={org._id}>
                    <div className="mb-4 flex items-center">
                      {Icon && <Icon aria-hidden className="mr-3 size-6 shrink-0 text-primary" />}
                      <h3 className="text-2xl font-bold">{org.title}</h3>
                    </div>
                    <p className="text-ink-2">{org.description}</p>
                  </Card>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

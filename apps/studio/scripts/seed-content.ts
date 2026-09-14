/**
 * Seeds Sanity with the site's starting content so it becomes editable.
 *
 *   pnpm seed:sanity
 *
 * Auth, whichever is easier:
 *  - your Studio login, via `sanity exec --with-user-token` (what pnpm
 *    seed:sanity does). The logged-in account must be a member of the project.
 *  - or a write token: set SANITY_WRITE_TOKEN and it takes precedence. Create
 *    one at sanity.io/manage -> API -> Tokens with Editor rights.
 *
 * Two safety properties, because this runs against production:
 *  - the `leadership` roles are NOT seeded. They were entered by hand and the
 *    holders have already changed (Rensho and Taishō both differ from the old
 *    site). Seeding them would duplicate the group.
 *  - it refuses to touch a type that already has documents. createIfNotExists
 *    cannot tell "never existed" from "deleted on purpose", so re-running an
 *    unguarded seeder resurrects content someone removed — which is exactly
 *    what happened to "Lord of Overseas Territories".
 */
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {getCliClient} from 'sanity/cli'

const base = getCliClient({apiVersion: '2021-10-21'})
/* An explicit token wins, so this works even when the CLI is logged in as an
   account that is not a member of the project. */
const client = process.env.SANITY_WRITE_TOKEN
  ? base.withConfig({token: process.env.SANITY_WRITE_TOKEN})
  : base

const IMAGE_DIR = join(process.cwd(), '..', 'web', 'public', 'images')

type Role = {
  group: string
  order: number
  title: string
  /* Other Roles and Populace describe a kind of person, not a post someone
     holds, so they omit this. An empty holder renders as "Vacant". */
  holder?: string
  description: string
  icon?: string
}

/* NOTE: `leadership` is deliberately absent — see the header. */
const roles: Role[] = [
  {
    group: 'daimyo',
    order: 0,
    title: 'Lord of the North',
    holder: 'HPLaptop, Dragran',
    description: 'Manages Northern Nara including Shiroyama, Ichinokawa and Karasu.',
  },
  {
    group: 'daimyo',
    order: 1,
    title: 'Lord of the Center',
    holder: 'OreStraya',
    description: 'Manages Central Nara including Orakuru.',
  },
  {
    group: 'daimyo',
    order: 2,
    title: 'Lord of Overseas Territories',
    holder: 'Earyx',
    description: "Manages Q'Barra and all other overseas territories.",
  },
  {
    group: 'daimyo',
    order: 3,
    title: 'Lord of the South',
    holder: 'ArkenX',
    description: 'Manages the Nether region and southern territories.',
  },

  {
    group: 'komuin',
    order: 0,
    title: 'Komuin of Interior',
    holder: 'SQOpenSpellBook',
    description: 'Manages natural resource gathering, farming, and business interests.',
  },
  {
    group: 'komuin',
    order: 1,
    title: 'Komuin of Infrastructure',
    holder: 'Griff_inator',
    description: 'Oversees rails, roads, excavation, and construction projects.',
  },
  {
    group: 'komuin',
    order: 2,
    title: 'Komuin of Logistics',
    holder: 'Vacant',
    description: 'Manages economy, industry, resource production, and XP systems.',
  },
  {
    group: 'komuin',
    order: 3,
    title: 'Komuin of Culture',
    holder: 'Vacant',
    description: 'Organizes sports events and maintains cultural identity.',
  },

  {
    group: 'other',
    order: 0,
    title: 'Samurai',
    description:
      "The state-sponsored soldiers of Nara, their combat kits subsidized by the government. They serve as the main fighting force of Nara and are the pvp leads in situations where the Taishō isn't present.",
  },
  {
    group: 'other',
    order: 1,
    title: 'Kazoku',
    description:
      'A trusted citizen of Nara. They are the backbone of Nara and are the most trusted citizens of the nation.',
  },
  {
    group: 'other',
    order: 2,
    title: 'Shuryo',
    description: "Masters of Nara's guilds, democratically elected by the wider guild membership.",
  },
  {
    group: 'other',
    order: 3,
    title: 'Shrine Maiden',
    description:
      'God I fucking love Xcios. Everyday I wake up and pray that I will be blessed by the presence of Xcios. The most important single role in Nara.',
  },

  {
    group: 'populace',
    order: 0,
    title: 'Citizens',
    description:
      "Those who have lived in Nara for more than one week, with Nara as their primary nation or as their second nation if their first is a close ally. They've passed the citizenship test.",
  },
  {
    group: 'populace',
    order: 1,
    title: 'Residents',
    description:
      "People who live in Nara but don't meet the requirements to become full citizens yet.",
  },
]

const organizations = [
  {
    order: 0,
    title: 'Nara Newfriend Society',
    icon: 'book',
    description:
      'A society for new players to learn the ropes of CivMC and adjust to the VIBE culture of Nara.',
  },
  {
    order: 1,
    title: "Brewer's Guild",
    icon: 'coffee',
    description:
      'Founded on July 24, 2022, the guild discovered and perfected nearly 40 different brewing recipes in the first 4 days. Nara has two national brews: Nara Puffer Fish Wine and Nara no Uiskui. Alcholism is greatly encouraged.',
  },
  {
    order: 2,
    title: 'Libraries',
    icon: 'bookOpen',
    description:
      "Nara is home to three libraries: Atlas Palace Library in Shiroyama, Ichinokawa Library, and Q'Barra Library. They operate using a library card system.",
  },
  {
    order: 3,
    title: 'Naran Postal Service (NPS)',
    icon: 'mail',
    description:
      'A government-provided service that ships items to valid NPS mailboxes and PO boxes. Current branches include Shiroyama and Ichinokawa. Carrier pigeons being implemented shortly.',
  },
]

const cities = [
  {
    order: 0,
    slug: 'shiroyama',
    name: 'Shiroyama',
    coordinates: '3200, 4800',
    file: 'shiro.webp',
    description:
      'The capital and largest city of Nara. A world-class city featuring feudal and modern Japanese architecture with high density and environmental integration.',
  },
  {
    order: 1,
    slug: 'ichinokawa',
    name: 'Ichinokawa',
    coordinates: '3750, 5400',
    file: 'ichino.webp',
    description:
      'A serene rural village featuring feudal Japanese architecture. An escape from the hustle and bustle of the big city.',
  },
  {
    order: 2,
    slug: 'qbarra',
    name: "Q'Barra",
    coordinates: '7000, 700',
    file: 'qbarra.webp',
    description:
      'An overseas exclave blending Aztec and Argonian fantasy themes. A magical place lost in the jungle.',
  },
  {
    order: 3,
    slug: 'tronjheim',
    name: 'Tronjheim',
    coordinates: '3300, 5300',
    file: 'tronjheim.webp',
    description:
      'A breathtaking dwarven-themed underground city. A huge underground haven for all dwarves.',
  },
  {
    order: 4,
    slug: 'orakuru',
    name: 'Orakuru',
    coordinates: '3700, 7000',
    file: 'orakuru.webp',
    description:
      'A vibrant 1800s European industrial era city blending its origins with urban design and artistic expression.',
  },
  {
    order: 5,
    slug: 'karasu',
    name: 'Karasu',
    coordinates: '3400, 5800',
    file: 'karasu.webp',
    description:
      'A welcoming settlement founded west of Ichinokawa, grown with a significant number of newfriends.',
  },
]

/**
 * Deterministic ids, hyphen-separated.
 *
 * Never put a `.` in an `_id`. Sanity reads it as a path separator and
 * path-prefixed documents are invisible to anonymous clients — the same rule
 * that hides `drafts.*`. The first version of this script used dots, and the
 * documents it created were fine in the Studio and unreadable by the site.
 */
const idSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function main() {
  const counts: Record<string, number> = await client.fetch(`{
    "governmentRole": count(*[_type == "governmentRole" && group != "leadership"]),
    "organization": count(*[_type == "organization"]),
    "city": count(*[_type == "city"])
  }`)

  const populated = Object.entries(counts).filter(([, n]) => n > 0)
  if (populated.length > 0) {
    console.log('Already populated — refusing to seed, so nothing deleted gets recreated:')
    for (const [type, n] of populated) console.log(`  ${type}: ${n} documents`)
    console.log('')
    console.log('To re-seed a type, delete all of its documents in the Studio first.')
    return
  }

  const existing: string[] = await client.fetch(
    '*[_type in ["governmentRole","organization","city"]]._id',
  )
  const has = new Set(existing)
  const tx = client.transaction()
  let queued = 0

  for (const role of roles) {
    const _id = `governmentRole-${role.group}-${idSlug(role.title)}`
    if (has.has(_id)) continue
    tx.createIfNotExists({_id, _type: 'governmentRole', ...role})
    queued++
  }

  for (const org of organizations) {
    const _id = `organization-${idSlug(org.title)}`
    if (has.has(_id)) continue
    tx.createIfNotExists({_id, _type: 'organization', ...org})
    queued++
  }

  for (const {file, slug, ...city} of cities) {
    const _id = `city-${slug}`
    if (has.has(_id)) {
      console.log(`skip   city ${city.name} (already exists)`)
      continue
    }
    const asset = await client.assets.upload('image', readFileSync(join(IMAGE_DIR, file)), {
      filename: file,
    })
    console.log(`upload ${file} -> ${asset._id}`)
    tx.createIfNotExists({
      _id,
      _type: 'city',
      ...city,
      slug: {_type: 'slug', current: slug},
      image: {
        _type: 'image',
        alt: `${city.name}, Nara`,
        asset: {_type: 'reference', _ref: asset._id},
      },
    })
    queued++
  }

  if (queued === 0) {
    console.log('Nothing to do — every document already exists.')
    return
  }

  await tx.commit()
  console.log(`\nCreated ${queued} documents. Leadership roles were left untouched.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

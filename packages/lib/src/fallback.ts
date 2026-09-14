/**
 * The site's baseline content, as typed data.
 *
 * The queries in ./queries.ts serve Sanity when it has documents and fall back
 * to these when it does not — so the site renders before Sanity is seeded, and
 * keeps rendering if the Content Lake is unreachable. Once a
 * type is populated in Sanity its fallback here stops being read; delete the
 * block then rather than letting the two drift.
 *
 * City images point at apps/web/public/images.
 */
import type { City, GovernmentRole, Organization } from './queries'

export const fallbackGovernmentRoles: GovernmentRole[] = [
  {
    _id: 'fallback.shikken',
    group: 'leadership',
    title: 'Shikken',
    holder: 'SwordMaster7777',
    icon: 'star',
    description: 'Feudal leader of the whole nation.',
  },
  {
    _id: 'fallback.rensho',
    group: 'leadership',
    title: 'Rensho',
    holder: 'Vacant',
    icon: 'users',
    description: 'Second in command, leads when Shikken is unavailable.',
  },
  {
    _id: 'fallback.taisho',
    group: 'leadership',
    title: 'Taishō',
    holder: 'ArkenX',
    icon: 'crosshair',
    description: "Leads the army; in charge if Shikken and Rensho aren't around.",
  },

  {
    _id: 'fallback.daimyo.north',
    group: 'daimyo',
    title: 'Lord of the North',
    holder: 'HPLaptop, Dragran',
    description: 'Manages Northern Nara including Shiroyama, Ichinokawa and Karasu.',
  },
  {
    _id: 'fallback.daimyo.center',
    group: 'daimyo',
    title: 'Lord of the Center',
    holder: 'OreStraya',
    description: 'Manages Central Nara including Orakuru.',
  },
  {
    _id: 'fallback.daimyo.overseas',
    group: 'daimyo',
    title: 'Lord of Overseas Territories',
    holder: 'Earyx',
    description: "Manages Q'Barra and all other overseas territories.",
  },
  {
    _id: 'fallback.daimyo.south',
    group: 'daimyo',
    title: 'Lord of the South',
    holder: 'ArkenX',
    description: 'Manages the Nether region and southern territories.',
  },

  {
    _id: 'fallback.komuin.interior',
    group: 'komuin',
    title: 'Komuin of Interior',
    holder: 'SQOpenSpellBook',
    description: 'Manages natural resource gathering, farming, and business interests.',
  },
  {
    _id: 'fallback.komuin.infrastructure',
    group: 'komuin',
    title: 'Komuin of Infrastructure',
    holder: 'Griff_inator',
    description: 'Oversees rails, roads, excavation, and construction projects.',
  },
  {
    _id: 'fallback.komuin.logistics',
    group: 'komuin',
    title: 'Komuin of Logistics',
    holder: 'Vacant',
    description: 'Manages economy, industry, resource production, and XP systems.',
  },
  {
    _id: 'fallback.komuin.culture',
    group: 'komuin',
    title: 'Komuin of Culture',
    holder: 'Vacant',
    description: 'Organizes sports events and maintains cultural identity.',
  },

  {
    _id: 'fallback.other.samurai',
    group: 'other',
    title: 'Samurai',
    description:
      "The state-sponsored soldiers of Nara, their combat kits subsidized by the government. They serve as the main fighting force of Nara and are the pvp leads in situations where the Taishō isn't present.",
  },
  {
    _id: 'fallback.other.kazoku',
    group: 'other',
    title: 'Kazoku',
    description:
      'A trusted citizen of Nara. They are the backbone of Nara and are the most trusted citizens of the nation.',
  },
  {
    _id: 'fallback.other.shuryo',
    group: 'other',
    title: 'Shuryo',
    description: "Masters of Nara's guilds, democratically elected by the wider guild membership.",
  },
  {
    _id: 'fallback.other.shrine-maiden',
    group: 'other',
    title: 'Shrine Maiden',
    description:
      'God I fucking love Xcios. Everyday I wake up and pray that I will be blessed by the presence of Xcios. The most important single role in Nara.',
  },

  {
    _id: 'fallback.populace.citizens',
    group: 'populace',
    title: 'Citizens',
    description:
      "Those who have lived in Nara for more than one week, with Nara as their primary nation or as their second nation if their first is a close ally. They've passed the citizenship test.",
  },
  {
    _id: 'fallback.populace.residents',
    group: 'populace',
    title: 'Residents',
    description:
      "People who live in Nara but don't meet the requirements to become full citizens yet.",
  },
]

export const fallbackOrganizations: Organization[] = [
  {
    _id: 'fallback.org.newfriend',
    title: 'Nara Newfriend Society',
    icon: 'book',
    description:
      'A society for new players to learn the ropes of CivMC and adjust to the VIBE culture of Nara.',
  },
  {
    _id: 'fallback.org.brewers',
    title: "Brewer's Guild",
    icon: 'coffee',
    description:
      'Founded on July 24, 2022, the guild discovered and perfected nearly 40 different brewing recipes in the first 4 days. Nara has two national brews: Nara Puffer Fish Wine and Nara no Uiskui. Alcholism is greatly encouraged.',
  },
  {
    _id: 'fallback.org.libraries',
    title: 'Libraries',
    icon: 'bookOpen',
    description:
      "Nara is home to three libraries: Atlas Palace Library in Shiroyama, Ichinokawa Library, and Q'Barra Library. They operate using a library card system.",
  },
  {
    _id: 'fallback.org.postal',
    title: 'Naran Postal Service (NPS)',
    icon: 'mail',
    description:
      'A government-provided service that ships items to valid NPS mailboxes and PO boxes. Current branches include Shiroyama and Ichinokawa. Carrier pigeons being implemented shortly.',
  },
]

export const fallbackCities: City[] = [
  {
    _id: 'fallback.city.shiroyama',
    name: 'Shiroyama',
    slug: 'shiroyama',
    coordinates: '3200, 4800',
    description:
      'The capital and largest city of Nara. A world-class city featuring feudal and modern Japanese architecture with high density and environmental integration.',
    image: { url: '/images/shiro.webp', alt: 'Shiroyama, the capital of Nara' },
  },
  {
    _id: 'fallback.city.ichinokawa',
    name: 'Ichinokawa',
    slug: 'ichinokawa',
    coordinates: '3750, 5400',
    description:
      'A serene rural village featuring feudal Japanese architecture. An escape from the hustle and bustle of the big city.',
    image: { url: '/images/ichino.webp', alt: 'Ichinokawa, a rural village in Nara' },
  },
  {
    _id: 'fallback.city.qbarra',
    name: "Q'Barra",
    slug: 'qbarra',
    coordinates: '7000, 700',
    description:
      'An overseas exclave blending Aztec and Argonian fantasy themes. A magical place lost in the jungle.',
    image: { url: '/images/qbarra.webp', alt: "Q'Barra, an overseas exclave of Nara" },
  },
  {
    _id: 'fallback.city.tronjheim',
    name: 'Tronjheim',
    slug: 'tronjheim',
    coordinates: '3300, 5300',
    description:
      'A breathtaking dwarven-themed underground city. A huge underground haven for all dwarves.',
    image: { url: '/images/tronjheim.webp', alt: 'Tronjheim, an underground city in Nara' },
  },
  {
    _id: 'fallback.city.orakuru',
    name: 'Orakuru',
    slug: 'orakuru',
    coordinates: '3700, 7000',
    description:
      'A vibrant 1800s European industrial era city blending its origins with urban design and artistic expression.',
    image: { url: '/images/orakuru.webp', alt: 'Orakuru, an industrial-era city in Nara' },
  },
  {
    _id: 'fallback.city.karasu',
    name: 'Karasu',
    slug: 'karasu',
    coordinates: '3400, 5800',
    description:
      'A welcoming settlement founded west of Ichinokawa, grown with a significant number of newfriends.',
    image: { url: '/images/karasu.webp', alt: 'Karasu, a settlement in Nara' },
  },
]

/** Prose on /government that is not per-role. Moves to a `page` type later. */
export const fallbackRelations = {
  summary:
    'Nara maintains friendly relations with most of its neighbors, with an active presence in Alenarith politics, and generally remains positive on the world stage.',
  current:
    'Shiroyama hosts a number of foreign nationals and is connected by rail to all major nations via OneDest with direct lines to Pavia, Icenia, Volterra, Bloom, and the Commonwealth. Nara maintains a friendship treaty with Danzilona and Salerno formalized in December 2022 and March 2025 respectively.',
}

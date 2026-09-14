export const site = {
  name: 'Nara',
  url: 'https://nara.rocks',
  tagline: 'A Japanese-themed nation on CivMC',
  description:
    'Nara is a Japanese-themed nation on CivMC, located in the +,+ on the continent of Alenarith. Founded on vibes and environmentalism.',
  founded: '2022-06-02',
  discord: 'https://discord.gg/M8etHAEyBB',
  capital: { name: 'Shiroyama', x: 3200, z: 4800 },
} as const

export type NavItem = { href: string; label: string; children?: NavItem[]; accent?: boolean }

export const nav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/collect', label: '🎰 Collect', accent: true },
  { href: '/government', label: 'Government' },
  { href: '/homes', label: 'Homes' },
  {
    href: '/shops',
    label: 'Shops',
    children: [
      { href: '/shops', label: 'All Shops' },
      { href: '/heads', label: 'Head Shop' },
    ],
  },
  {
    href: '/tools',
    label: 'Tools',
    children: [
      { href: '/snitches', label: 'Snitches' },
      { href: '/stats', label: 'Player Stats' },
      { href: '/rocket', label: 'Rocket Calculator' },
    ],
  },
  { href: '/joining', label: 'Join Us' },
]

export const footerColumns: { title: string; links: NavItem[] }[] = [
  {
    title: 'Quick Links',
    links: [
      { href: '/government', label: 'Government' },
      { href: '/homes', label: 'Homes' },
      { href: '/shops', label: 'Shops' },
      { href: '/joining', label: 'Joining Nara' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/map', label: 'Map' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { href: '/stats', label: 'Playtime Statistics' },
      { href: '/snitches', label: 'Snitch Viewer' },
      { href: '/planner', label: 'Grid Planner' },
      { href: '/rocket', label: 'Rocket Calculator' },
    ],
  },
]

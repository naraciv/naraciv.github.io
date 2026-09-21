import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@nara/lib'],
  /*
   * Player profiles read data/ at request time (see lib/playerLookup.ts). It
   * sits outside this app, so trace from the monorepo root and name the files,
   * or a serverless deployment ships the page without them.
   */
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/stats/[player]': ['../../data/player_names.json', '../../data/leaderboard.csv'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      // The Minecraft item sprite hotlinked for diamond prices.
      { protocol: 'https', hostname: 'ccvaults.com' },
    ],
  },
  /*
   * The gacha backend, served same-origin. On nara.rocks a Cloudflare Worker route answered
   * /api/gacha/*; on Vercel URLs nothing did. A rewrite (not a client-side URL) keeps the
   * backend's `gid` cookie first-party, so browsers that block third-party cookies still
   * keep a visitor's collection.
   */
  rewrites: async () => [
    {
      source: '/api/gacha/:path*',
      destination: `${process.env.GACHA_BACKEND_URL ?? 'https://gacha.nara.rocks'}/:path*`,
    },
  ],
  headers: async () => [
    {
      // RFC 9727 agent discovery: point at the llms.txt summary and the API catalog.
      source: '/',
      headers: [
        {
          key: 'Link',
          value: '</llms.txt>; rel="describedby", </.well-known/api-catalog>; rel="api-catalog"',
        },
      ],
    },
  ],
  redirects: async () => [
    // /map is a route handler — see app/map/route.ts.
    {
      source: '/discord',
      destination: 'https://discord.gg/TKxC3qVuu4',
      permanent: false,
    },
    // Legacy .html and directory URLs still linked from elsewhere.
    { source: '/index.html', destination: '/', permanent: true },
    { source: '/:path+/index.html', destination: '/:path+', permanent: true },
    {
      source: '/:page(government|joining|privacy|shops|tools|properties).html',
      destination: '/:page',
      permanent: true,
    },
    // /homes/view without an id rendered an empty page.
    {
      source: '/homes/view',
      missing: [{ type: 'query', key: 'id' }],
      destination: '/homes',
      permanent: true,
    },
    { source: '/properties', destination: '/homes', permanent: true },
    // Legacy query-string profile URLs.
    {
      source: '/stats/user',
      has: [{ type: 'query', key: 'player', value: '(?<player>.+)' }],
      destination: '/stats/:player',
      permanent: true,
    },
    {
      source: '/stats',
      has: [{ type: 'query', key: 'player', value: '(?<player>.+)' }],
      destination: '/stats/:player',
      permanent: true,
    },
    // Legacy query-string listing URLs.
    {
      source: '/homes/view',
      has: [{ type: 'query', key: 'id' }],
      destination: '/homes/:id',
      permanent: true,
    },
  ],
}

export default nextConfig

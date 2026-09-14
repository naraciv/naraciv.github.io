# Nara — nara.rocks

The website of the Nation of Nara on CivMC: a Next.js monorepo.

```
apps/web               the site (Next.js App Router), with its map and UI components
apps/studio            Sanity Studio and schemas
packages/lib           data, parsing and maths, with tests
data/                  leaderboard, head shop and player-name data (updated by CI)
scripts/               the daily leaderboard job
```

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm check    # format, lint, types and tests
```

Deployed on Vercel.

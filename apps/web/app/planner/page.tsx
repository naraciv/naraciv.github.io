import type { Metadata } from 'next'
import Link from 'next/link'
import { Monitor } from 'lucide-react'
import { PlannerLoader } from '@/components/PlannerLoader'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Grid Planner',
  description:
    'Plan bastions, snitches and mob repellators grids on the CivMC world map. Import or draw borders to lay out exactly what you need.',
  alternates: { canonical: '/planner' },
}

export default function PlannerPage() {
  return (
    <div className="flex flex-grow flex-col pt-[80px] sm:pt-[100px]">
      {/* The visible title is drawn by the client-only planner, so crawlers get this one. */}
      <h1 className="sr-only">Bastion &amp; Snitch Grid Planner</h1>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Bastion & Snitch Grid Planner',
          url: `${site.url}/planner`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Any',
          description: metadata.description,
          isAccessibleForFree: true,
        }}
      />
      {/* Phones: not built for small screens yet. CSS decides the first paint (no flash);
          PlannerLoader only mounts the map from tablet width. */}
      <div className="flex flex-grow flex-col items-center justify-center gap-4 px-6 py-16 text-center md:hidden">
        <Monitor aria-hidden className="size-12 text-primary" />
        <h2 className="text-2xl font-bold text-white">Not yet available on mobile</h2>
        <p className="max-w-sm text-ink-2">
          The Bastion &amp; Snitch Grid Planner needs a bigger screen for now. Please try it on a
          desktop or tablet.
        </p>
        <Link
          href="/tools"
          className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:border-primary hover:text-white"
        >
          Back to tools
        </Link>
      </div>
      <div className="hidden flex-grow flex-col md:flex">
        <PlannerLoader />
      </div>
    </div>
  )
}

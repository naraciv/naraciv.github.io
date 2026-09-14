import type { Metadata } from 'next'
import { RocketCalculator } from '@/components/RocketCalculator'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Zorweth Rocket Calculator',
  description:
    'Work out how much rocket fuel a CivMC rocket needs to reach Zorweth and back, for any number of passengers and any cargo, using the same rocket equation the server does.',
  alternates: { canonical: '/rocket' },
}

export default function RocketPage() {
  return (
    <div className="px-4 pt-[100px]">
      <div className="mx-auto max-w-6xl py-10">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Zorweth Rocket Calculator',
            url: `${site.url}/rocket`,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            description: metadata.description,
            isAccessibleForFree: true,
          }}
        />

        <div className="mb-6 text-center">
          <h1 className="mb-2 text-4xl font-bold text-primary sm:text-5xl">
            Zorweth Rocket Calculator
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-ink-3">
            Fuel calculator for one-way and roundtrip rockets.
          </p>
        </div>

        <RocketCalculator />
      </div>
    </div>
  )
}

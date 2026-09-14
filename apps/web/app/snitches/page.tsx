import type { Metadata } from 'next'
import { SnitchViewer } from '@/components/SnitchViewer'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Snitch Viewer',
  description:
    'Open your SnitchMod database and see every snitch on the CivMC map — which are active, about to go dormant, dormant or culled — filtered by group, world and Y level.',
  alternates: { canonical: '/snitches' },
}

export default function SnitchesPage() {
  return (
    <div className="snitches-view px-2 pt-[80px] pb-8 sm:px-4 sm:pt-[100px]">
      <div className="mx-auto w-full max-w-[98%] sm:max-w-[95%]">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Snitch Viewer',
            url: `${site.url}/snitches`,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            description: metadata.description,
            isAccessibleForFree: true,
          }}
        />
        <h1 className="mb-4 text-center text-2xl font-bold text-primary sm:mb-6 sm:text-4xl">
          Snitch Viewer
        </h1>
        <SnitchViewer />
      </div>
    </div>
  )
}

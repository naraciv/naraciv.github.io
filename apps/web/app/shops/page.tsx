import type { Metadata } from 'next'
import { getShops } from '@nara/lib'
import { ShopsClient } from '@/components/ShopsClient'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Shops',
  description:
    'Shop Nara! Explore prices, trades, shopowners and more, both in List and Map form!',
  alternates: { canonical: '/shops' },
}

/**
 * Rebuilt at most every 5 minutes and served from the edge, like /homes. The
 * URL's filters (`?search=diamond&type=map`) are applied in the browser after
 * hydration, so a shared filtered link narrows one frame after load — the
 * trade for not rendering all 579 rows on every request.
 */
export const revalidate = 300

export default async function ShopsPage() {
  const shops = await getShops()
  const cities = [...new Set(shops.map((shop) => shop.city).filter(Boolean))].sort()

  return (
    <div className="shops-view px-3 pt-[88px] sm:px-4 sm:pt-[100px]">
      <div className="mx-auto w-full py-6 sm:w-[90%] sm:max-w-[90%] sm:py-20">
        {/*
         * A Dataset, not a 579-item ItemList of Products.
         *
         * /homes lists RealEstateListings because each one genuinely is one.
         * These are not products: a row is a barter, and an `Offer` needs a
         * price in an ISO 4217 currency that diamonds do not have — so every
         * row would be a Product with no price, no availability and no seller
         * on half of them, 340KB of markup that Google ignores and that edges
         * toward fabricated structured data.
         *
         * What actually made this page machine-readable is below it: the
         * table is server-rendered, so a crawler sees every row. This node
         * describes that table and points at the CSV behind it.
         */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'Player shop exchanges in Nara',
            description: `Every recorded shop exchange in Nara: what each one takes, what it gives, its coordinates, city and owner. ${shops.length} exchanges across ${cities.length} cities (${cities.join(', ')}), maintained by the community.`,
            url: `${site.url}/shops`,
            creator: { '@type': 'Organization', name: site.name, url: site.url },
            variableMeasured: ['input', 'output', 'coordinates', 'city', 'contact', 'tags'],
            /* Minecraft X/Z are not latitude and longitude, so no spatialCoverage. */
            isAccessibleForFree: true,
          }}
        />

        <h1 className="mb-6 text-center text-4xl font-bold text-primary sm:mb-16 sm:text-5xl">
          Shops
        </h1>
        <ShopsClient shops={shops} />
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { getListings, formatBuildingType, parseCoordinates } from '@nara/lib'
import HomesPortalClient from '@/components/HomesPortalClient'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Homes',
  description:
    'Property listings across Nara: homes, apartments, shops and hotel rooms for sale or rent, with prices, coordinates and owners, on the CivMC world map.',
  alternates: { canonical: '/homes' },
}

export const revalidate = 300

export default async function HomesPage() {
  const listings = await getListings()

  return (
    <>
      {/*
       * RealEstateListing is a genuine schema.org fit, and the listings are
       * server-rendered, so a crawler that does not run JavaScript sees them.
       *
       * Diamonds are not a currency: no `price`/`priceCurrency`, no ISO 4217
       * code invented for them. The amount rides as an additionalProperty.
       */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Property listings in Nara',
          url: `${site.url}/homes`,
          numberOfItems: listings.length,
          itemListElement: listings.map((listing, i) => {
            const coords = parseCoordinates(listing.coordinates)
            return {
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'RealEstateListing',
                name: listing.address || listing.city || 'Property in Nara',
                url: `${site.url}/homes/${listing._id}`,
                ...(listing.images?.[0] ? { image: listing.images[0] } : {}),
                ...(listing.listing_owner
                  ? { provider: { '@type': 'Person', name: listing.listing_owner } }
                  : {}),
                additionalProperty: [
                  {
                    '@type': 'PropertyValue',
                    name: 'price',
                    value: listing.price,
                    unitText: 'diamonds',
                  },
                  {
                    '@type': 'PropertyValue',
                    name: 'listingType',
                    value: listing.is_rental ? 'rental' : 'sale',
                  },
                  {
                    '@type': 'PropertyValue',
                    name: 'buildingType',
                    value: formatBuildingType(listing.building_type),
                  },
                  ...(coords
                    ? [
                        {
                          '@type': 'PropertyValue',
                          name: 'coordinates',
                          value: `${coords.x}, ${coords.z}`,
                          description: 'Minecraft world X and Z, not latitude and longitude',
                        },
                      ]
                    : []),
                ],
              },
            }
          }),
        }}
      />

      <h1 className="sr-only">Property listings in Nara</h1>
      <HomesPortalClient listings={listings} />
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, MessageSquare } from 'lucide-react'
import {
  formatBuildingType,
  getListing,
  getListings,
  getReachableDepartures,
  parseCoordinates,
} from '@nara/lib'
import { Price } from '@/components/Diamond'
import { PropertyAlbum } from '@/components/PropertyAlbum'
import { SchematicViewer } from '@/components/SchematicViewer'
import { CopyCoordinates } from '@/components/CopyCoordinates'
import { RailDirections } from '@/components/RailDirections'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const revalidate = 300

/** Pre-render the listings that exist; anything else renders on demand. */
export async function generateStaticParams() {
  const listings = await getListings()
  return listings.map((listing) => ({ id: listing._id }))
}

export async function generateMetadata({ params }: PageProps<'/homes/[id]'>): Promise<Metadata> {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) return { title: 'Property not found' }

  const name = listing.address || listing.city || 'Property'
  const kind = formatBuildingType(listing.building_type)
  const deal = listing.is_rental ? 'for rent' : 'for sale'
  const price = listing.price === 0 ? 'free' : `${listing.price} diamonds`

  return {
    title: name,
    description: `${kind} ${deal} in ${listing.city ?? 'Nara'} at ${price}. Listed by ${
      listing.listing_owner || 'the Naran government'
    }.`,
    alternates: { canonical: `/homes/${id}` },
    openGraph: {
      title: `${name} — ${kind} ${deal}`,
      images: listing.images?.[0] ? [listing.images[0]] : undefined,
    },
  }
}

export default async function ListingPage({ params }: PageProps<'/homes/[id]'>) {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) notFound()

  const coords = parseCoordinates(listing.coordinates)
  const rental = listing.is_rental
  const departures = listing.city ? getReachableDepartures(listing.city) : []

  return (
    <div className="mx-auto flex w-full max-w-7xl grow flex-col gap-5 px-6 py-8 pt-[104px]">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'RealEstateListing',
          name: listing.address || listing.city || 'Property in Nara',
          url: `${site.url}/homes/${listing._id}`,
          ...(listing.images?.length ? { image: listing.images } : {}),
          ...(listing.listing_owner
            ? { provider: { '@type': 'Person', name: listing.listing_owner } }
            : {}),
          /* Diamonds have no ISO 4217 code, so no Offer/priceCurrency here. */
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'price', value: listing.price, unitText: 'diamonds' },
            {
              '@type': 'PropertyValue',
              name: 'listingType',
              value: rental ? 'rental' : 'sale',
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
        }}
      />

      <div>
        <Link
          href="/homes"
          className="group flex items-center gap-2 py-2 text-sm text-ink-3 transition-colors hover:text-white"
        >
          <ArrowLeft
            aria-hidden
            className="size-4 transition-transform group-hover:-translate-x-1"
          />
          Back to Listings
        </Link>
      </div>

      <div className="unified-panel flex w-full flex-col overflow-hidden rounded-2xl lg:flex-row">
        <div className="flex w-full flex-col border-b border-edge lg:w-3/5 lg:border-r lg:border-b-0">
          <PropertyAlbum
            images={listing.images ?? []}
            alt={listing.address || listing.city || 'Property'}
            coordinates={coords}
          />
          {listing.schematicUrl && (
            <SchematicViewer
              url={listing.schematicUrl}
              name={listing.address?.replace(/\s+/g, '') || 'schematic'}
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-6 bg-surface/40 p-8 lg:w-2/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-row flex-wrap gap-2">
              <span
                className={`w-fit rounded-full border px-3 py-1 text-[9px] font-bold tracking-wider uppercase ${
                  rental
                    ? 'border-purple/50 bg-purple/20 text-purple'
                    : 'border-cyan/50 bg-cyan/20 text-cyan'
                }`}
              >
                {rental ? 'Rental Property' : 'For Sale'}
              </span>
              <span className="w-fit rounded-full border border-cyan/30 bg-surface px-3 py-1 text-[9px] font-bold tracking-wider text-cyan uppercase">
                {formatBuildingType(listing.building_type)}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <span className="mb-0.5 block text-[9px] font-bold tracking-wider text-ink-3 uppercase">
                Price
              </span>
              <span className="flex items-center justify-end gap-1.5 text-xl font-extrabold text-white">
                <Price price={listing.price} rental={rental} className="size-5" />
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-edge pt-5">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {listing.address || 'Unnamed Property'}
            </h1>
            {listing.city && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-3">
                <MapPin aria-hidden className="size-4 text-cyan" /> {listing.city}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-edge pt-5">
            <div className="flex flex-col gap-1 rounded-xl border border-edge bg-ground/40 p-4">
              <dt className="text-[9px] font-bold tracking-wider text-cyan uppercase">Listed by</dt>
              <dd className="text-sm font-bold text-ink">{listing.listing_owner || 'Unknown'}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-edge bg-ground/40 p-4">
              <dt className="text-[9px] font-bold tracking-wider text-cyan uppercase">
                Coordinates
              </dt>
              <dd className="font-mono text-sm font-bold text-ink">{listing.coordinates}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 border-t border-edge pt-5">
            <CopyCoordinates coordinates={listing.coordinates} />
            <a
              href={site.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange/70 bg-ground py-3.5 font-bold text-orange transition-all hover:bg-surface hover:text-white"
            >
              <MessageSquare aria-hidden className="size-4" /> Contact an Agent
            </a>
          </div>

          {listing.city && departures.length > 0 && (
            <RailDirections destination={listing.city} departures={departures} />
          )}
        </div>
      </div>
    </div>
  )
}

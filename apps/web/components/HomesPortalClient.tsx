'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Image as ImageIcon, Layers, House, Sliders } from 'lucide-react'
import { buildingTypeKey, formatBuildingType, parseCoordinates, type Listing } from '@nara/lib'
/* Type-only: a runtime import would evaluate @nara/map's barrel, which pulls in
   Leaflet and breaks server rendering. */
import type { Cluster } from '@/components/map'
import { Diamond, Price } from './Diamond'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { HomesMap } from './HomesMap'

/**
 * The property portal: map on the left, filters and cards on the right.
 *
 * This component server-renders — only the map inside it is client-only,
 * because Leaflet needs `window`. That matters: the cards are in the delivered
 * HTML, so a crawler sees them.
 *
 * Clustering, pins, popups and the map itself come from components/map.
 */

const MAX_PRICE = 200

const BUILDING_TYPES = [
  ['all', 'All Buildings'],
  ['home', 'Home'],
  ['apartment', 'Apartment'],
  ['house_shop', 'House & Shop'],
  ['hotel_room', 'Hotel Room'],
] as const

const LISTING_TYPES = [
  ['all', 'Sale & Rental'],
  ['sale', 'For Sale'],
  ['rental', 'Rental Only'],
] as const

export default function HomesPortalClient({ listings }: { listings: Listing[] }) {
  const [city, setCity] = useState('all')
  const [buildingType, setBuildingType] = useState<string>('all')
  const [listingType, setListingType] = useState<string>('all')
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)
  /* Phones get the list only, so the map (Leaflet and its tiles) is not even mounted there. */
  const desktop = useMediaQuery('(min-width: 1024px)')

  const cities = useMemo(
    () => [...new Set(listings.map((l) => l.city).filter(Boolean))].sort() as string[],
    [listings],
  )

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (city !== 'all' && l.city !== city) return false
        if (buildingType !== 'all' && buildingTypeKey(l.building_type) !== buildingType)
          return false
        if (listingType === 'sale' && l.is_rental) return false
        if (listingType === 'rental' && !l.is_rental) return false
        if (l.price > maxPrice) return false
        return true
      }),
    [listings, city, buildingType, listingType, maxPrice],
  )

  return (
    <div className="homes-portal flex w-full grow flex-col">
      <div className="flex w-full grow flex-col overflow-hidden lg:h-[calc(100vh-80px)] lg:flex-row">
        {/* ── Map ── Desktop only, by owner decision: phones get the list. */}
        <div className="relative hidden w-full shrink-0 overflow-hidden lg:block lg:h-full lg:w-3/5 lg:border-r lg:border-[#1e293b]">
          {desktop && <HomesMap listings={filtered} popup={(c) => <ClusterPopup cluster={c} />} />}
        </div>

        {/* ── Filters + cards ── */}
        <div className="flex h-full w-full grow flex-col border-l border-[#0f172a] bg-ground lg:w-2/5">
          <div className="neon-panel flex shrink-0 flex-col gap-4 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-white">
                <Sliders aria-hidden className="size-4 text-orange" /> Search &amp; Filters
              </h2>
              <span
                aria-live="polite"
                className="rounded-full border border-[#f97316]/30 bg-gradient-to-r from-[#f97316] via-[#a855f7] to-[#06b6d4] px-2.5 py-0.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(255,107,53,0.35)]"
              >
                {filtered.length} {filtered.length === 1 ? 'listing' : 'listings'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Region / Location"
                value={city}
                onChange={setCity}
                options={[['all', 'All Locations'], ...cities.map((c) => [c, c] as const)]}
              />
              <Select
                label="Building Style"
                value={buildingType}
                onChange={setBuildingType}
                options={BUILDING_TYPES}
              />
              <Select
                label="Listing Category"
                value={listingType}
                onChange={setListingType}
                options={LISTING_TYPES}
              />

              <div className="flex flex-col px-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="filter-price"
                    className="text-[9px] font-bold tracking-wider text-[#22d3ee] uppercase"
                  >
                    Max Cost
                  </label>
                  <span className="text-[10px] font-bold text-orange">
                    {maxPrice === MAX_PRICE ? (
                      'All Prices'
                    ) : (
                      <>
                        ≤ <Diamond className="size-3" /> {maxPrice}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center py-2.5">
                  <input
                    id="filter-price"
                    type="range"
                    min={0}
                    max={MAX_PRICE}
                    step={1}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number.parseInt(e.target.value, 10))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-orange"
                  />
                </div>
              </div>
            </div>
          </div>

          <ul className="custom-scroll grid grow auto-rows-min grid-cols-1 content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            {filtered.length === 0 ? (
              <li className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-[#0f172a] bg-surface/10 py-16 text-ink-3">
                <House aria-hidden className="size-8 text-edge" />
                <p className="text-xs font-semibold">No properties found matching criteria.</p>
              </li>
            ) : (
              filtered.map((listing) => <ListingCard key={listing._id} listing={listing} />)
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ── Pins ─────────────────────────────────────────────── */

function ClusterPopup({ cluster }: { cluster: Cluster<Listing> }) {
  if (cluster.items.length === 1) return <SinglePopup listing={cluster.items[0]} />

  return (
    <div className="w-[320px] overflow-hidden rounded-lg bg-surface text-ink">
      <PopupImage listing={cluster.items[0]} />
      <div className="flex items-center justify-between border-b border-edge bg-ground/50 p-3">
        <span className="flex items-center gap-1 text-[11px] font-extrabold tracking-wider text-cyan uppercase">
          <Layers aria-hidden className="size-3.5" /> Multiple Listings
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[9px] font-bold text-ink-2">
          {cluster.items.length} Units
        </span>
      </div>
      <ul className="flex max-h-52 flex-col divide-y divide-edge/30 overflow-y-auto p-2">
        {cluster.items.map((listing) => {
          const coords = parseCoordinates(listing.coordinates)
          return (
            <li key={listing._id}>
              <Link
                href={`/homes/${listing._id}`}
                className="flex items-center justify-between gap-3 rounded px-2 py-2 transition-colors hover:bg-surface-2/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] leading-tight font-bold break-words text-white">
                    {listing.address || 'Unknown Property'}
                  </span>
                  {coords && (
                    <span className="mt-1 block font-mono text-[9px] text-ink-3">
                      X:{coords.x} Z:{coords.z}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-cyan">
                  <Price price={listing.price} rental={listing.is_rental} className="size-3" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SinglePopup({ listing }: { listing: Listing }) {
  const rental = listing.is_rental
  return (
    <div className="w-64 overflow-hidden rounded-lg bg-surface text-ink">
      <PopupImage listing={listing} />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-extrabold text-white">
            <Price price={listing.price} rental={listing.is_rental} className="size-4" />
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase ${
              rental
                ? 'border-purple/50 bg-purple/20 text-purple'
                : 'border-orange/50 bg-orange/20 text-orange'
            }`}
          >
            {rental ? 'Rental' : 'For Sale'}
          </span>
        </div>
        <p className="text-xs font-medium text-ink-2">
          {formatBuildingType(listing.building_type)} for {rental ? 'rent' : 'sale'}
          <span className="mx-1.5 text-ink-3">|</span>
          {listing.listing_owner || 'Unknown'}
        </p>
        <address className="mt-0.5 truncate text-sm font-bold text-white not-italic">
          {listing.address || 'Unnamed Property'}
          {listing.city ? `, ${listing.city}` : ''}
        </address>
        {/* `!`: Leaflet's unlayered `.leaflet-container a { color }` beats layered utilities,
            which drew this label grey-blue on the gradient. Dark text holds 6:1+ across
            all three stops; white fails on the cyan end. */}
        <Link
          href={`/homes/${listing._id}`}
          className="mt-2 w-full rounded-lg bg-gradient-to-r from-orange via-purple to-cyan py-2 text-center text-xs font-extrabold !text-ground no-underline transition-all hover:brightness-110"
        >
          View Property
        </Link>
      </div>
    </div>
  )
}

function PopupImage({ listing }: { listing: Listing }) {
  if (!listing.images?.[0]) {
    return (
      <div className="flex h-24 w-full items-center justify-center border-b border-edge bg-surface-2 font-mono text-[10px] font-bold text-ink-3">
        No Property Images
      </div>
    )
  }
  return (
    <Image
      src={listing.images[0]}
      alt={listing.address ? `${listing.address}` : 'Property'}
      width={320}
      height={180}
      className="block aspect-video w-full object-cover"
    />
  )
}

/* ── Cards ────────────────────────────────────────────── */

function ListingCard({ listing }: { listing: Listing }) {
  const coords = parseCoordinates(listing.coordinates)
  const rental = listing.is_rental

  return (
    <li className="property-card-glow overflow-hidden">
      <Link href={`/homes/${listing._id}`} className="flex h-full flex-col">
        <div className="relative h-40 w-full shrink-0">
          {listing.images?.[0] ? (
            <Image
              src={listing.images[0]}
              alt=""
              width={400}
              height={225}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center border-b border-edge bg-ground/80 text-ink-3">
              <ImageIcon aria-hidden className="mb-1 size-6 text-edge" />
              <span className="text-[10px]">No Property Images</span>
            </div>
          )}
          <span
            className={`absolute top-2.5 left-2.5 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
              rental ? 'bg-purple text-ground' : 'bg-orange text-ground'
            }`}
          >
            {rental ? 'For Rent' : 'For Sale'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-3.5">
          <span className="flex items-center gap-1.5 text-lg font-extrabold text-cyan">
            <Price price={listing.price} rental={listing.is_rental} className="size-5" />
          </span>
          {coords && (
            <span className="font-mono text-[10px] font-semibold text-ink-3">
              X: {coords.x}, Z: {coords.z}
            </span>
          )}
          {(listing.address || listing.city) && (
            <span className="truncate text-xs font-bold text-white">
              {[listing.address, listing.city].filter(Boolean).join(', ')}
            </span>
          )}
          <span className="mt-0.5 border-t border-edge/50 pt-1 text-[9px] font-semibold tracking-wide text-ink-3 uppercase">
            Listed by {listing.listing_owner || 'Government'}
          </span>
        </div>
      </Link>
    </li>
  )
}

/* ── Filter select ────────────────────────────────────── */

/**
 * A native select: keyboard support, type-ahead and mobile pickers for free.
 */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
}) {
  const id = `filter-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-1.5 ml-1 text-[9px] font-bold tracking-wider text-[#22d3ee] uppercase"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-full border border-[#334155] bg-[#0f172a] px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:border-orange"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

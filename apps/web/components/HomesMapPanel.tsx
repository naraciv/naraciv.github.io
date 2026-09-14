'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { parseCoordinates, type Coords, type Listing } from '@nara/lib'
import { DIAMOND_ICON } from './Diamond'
import {
  CivMap,
  MapFrame,
  MarkerLayer,
  clusterByRadius,
  type CivMapHandle,
  type Cluster,
} from '@/components/map'

function pinFor(cluster: Cluster<Listing>) {
  if (cluster.items.length > 1) {
    return {
      className: 'zillow-price-marker-wrap',
      anchor: [35, 12] as [number, number],
      html: `<div class="zillow-price-marker cluster">${cluster.items.length} Units</div>`,
    }
  }
  const listing = cluster.items[0]
  const price = listing.price === 0 ? 'Free' : `${listing.price}`
  return {
    className: 'zillow-price-marker-wrap',
    anchor: [30, 12] as [number, number],
    html: `<div class="zillow-price-marker${listing.is_rental ? ' rental' : ''}">${
      listing.price === 0 ? '' : `<img src="${DIAMOND_ICON}" class="size-3.5" alt="">`
    }<span>${price}${listing.is_rental ? '/mo' : ''}</span></div>`,
  }
}

/** Centres on Shiroyama at zoom -3 and clamps the map there. */
const SHIROYAMA: Coords = { x: 3227, z: 4792 }
const HOMES_ZOOM = -3
/** Pins merge listings within 5 blocks of each other. */
const CLUSTER_RADIUS = 5

export default function HomesMapPanel({
  listings,
  popup,
}: {
  listings: Listing[]
  popup: (cluster: Cluster<Listing>) => ReactNode
}) {
  const [hover, setHover] = useState<Coords>({ x: 0, z: 0 })
  const handle = useRef<CivMapHandle>(null)

  const clusters = useMemo(
    () => clusterByRadius(listings, CLUSTER_RADIUS, (l) => parseCoordinates(l.coordinates)),
    [listings],
  )

  return (
    <MapFrame
      handleRef={handle}
      resetTo={SHIROYAMA}
      resetZoom={HOMES_ZOOM}
      status={
        <span className="font-bold text-[#cbd5e1]">
          X: <span className="text-orange">{Math.round(hover.x)}</span>, Z:{' '}
          <span className="text-orange">{Math.round(hover.z)}</span>
        </span>
      }
    >
      <CivMap
        className="size-full"
        initialCenter={SHIROYAMA}
        initialZoom={HOMES_ZOOM}
        minZoom={HOMES_ZOOM}
        showClaims={false}
        onMouseMove={setHover}
        handleRef={handle}
      >
        <MarkerLayer items={clusters} position={(c) => c} icon={pinFor} popup={popup} />
      </CivMap>
    </MapFrame>
  )
}

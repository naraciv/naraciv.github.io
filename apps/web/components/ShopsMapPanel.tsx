'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import type { Coords, Shop } from '@nara/lib'
import {
  CivMap,
  MapFrame,
  MarkerLayer,
  clusterByRadius,
  zoomScaledRadius,
  type CivMapHandle,
  type Cluster,
} from '@/components/map'
import { Lore } from './ShopsClient'
import { ItemIcon } from './ItemIcon'

/**
 * The map view: a list of exchanges on the left, the world map on the right.
 *
 * Clustering, pins, popups, the tile pyramid and the map chrome all come from
 * components/map. What is left
 * here is the two behaviours that are specific to /shops — a cluster radius
 * that widens as you zoom out, and clicking a pin to pin its exchanges into
 * the sidebar.
 */

/* Hardcoded because they are camera presets, not data. They jump to zoom 1. */
const CITIES: { name: string; at: Coords }[] = [
  { name: 'Shiroyama', at: { x: 3313, z: 4913 } },
  { name: 'Orakuru', at: { x: 3614, z: 6985 } },
]
const CITY_ZOOM = 1

/** Up to this many exchanges are drawn inside one pin before it just counts. */
const PIN_ROWS = 2

function pinFor(cluster: Cluster<Shop>) {
  const rows = cluster.items
    .slice(0, PIN_ROWS)
    .map((shop, index) => {
      const slot = (icon: string | null) =>
        icon
          ? `<img src="${icon}" class="size-3.5 item-icon shrink-0" alt="">`
          : '<div class="size-3.5 rounded bg-surface-2 shrink-0"></div>'
      return `<div class="flex items-center gap-1 ${
        index > 0 ? 'mt-0.5 border-t border-edge/40 pt-0.5' : ''
      }">${slot(shop.input.icon)}<span class="select-none font-mono text-[9px] font-bold text-ink-3">&rarr;</span>${slot(
        shop.output.icon,
      )}</div>`
    })
    .join('')

  const count =
    cluster.items.length > 1
      ? `<div class="mt-0.5 w-full border-t border-edge/40 pt-0.5 text-center text-[9px] font-extrabold whitespace-nowrap text-cyan">${cluster.items.length} Exchanges</div>`
      : ''

  return {
    className: '',
    anchor: [
      21,
      Math.min(cluster.items.length, PIN_ROWS) * 10 + (cluster.items.length > 1 ? 12 : 0),
    ] as [number, number],
    html: `<div class="shop-marker-pill${cluster.items.length > 1 ? ' cluster' : ''}">${rows}${count}</div>`,
  }
}

export default function ShopsMapPanel({ shops, hidden }: { shops: Shop[]; hidden: boolean }) {
  const handle = useRef<CivMapHandle>(null)
  const [hover, setHover] = useState<Coords>({ x: 0, z: 0 })
  const [zoom, setZoom] = useState(CITY_ZOOM)
  /* The cluster whose exchanges have replaced the full list in the sidebar. */
  const [pinned, setPinned] = useState<Cluster<Shop> | null>(null)
  const [focused, setFocused] = useState<Shop | null>(null)

  /* Leaflet caches the container size, and this panel is hidden while the
     table is showing, so it measures zero until it is told otherwise. */
  useEffect(() => {
    if (!hidden) handle.current?.invalidateSize()
  }, [hidden])

  const mappable = useMemo(() => shops.filter((shop) => shop.position), [shops])

  /* The radius is a function of the zoom, so this re-runs on every zoomend and
     distant shops merge as you pull back — the one piece of /shops' map that
     is not shared with /homes. */
  const clusters = useMemo(
    () => clusterByRadius(mappable, zoomScaledRadius(zoom), (shop) => shop.position),
    [mappable, zoom],
  )

  /* Derived rather than stored, so a sidebar-opened popup survives the
     re-cluster that a zoom triggers. */
  const openCluster = useMemo(
    () => (focused ? (clusters.find((c) => c.items.includes(focused)) ?? null) : null),
    [clusters, focused],
  )

  /* A pinned cluster is rebuilt on zoom too, or the sidebar would keep showing
     a cluster that no longer exists on the map. */
  const listed = useMemo(() => {
    if (!pinned) return mappable
    const anchor = pinned.items[0]
    return clusters.find((c) => c.items.includes(anchor))?.items ?? pinned.items
  }, [pinned, clusters, mappable])

  const show = (shop: Shop) => {
    setFocused(shop)
    if (shop.position) handle.current?.setView(shop.position, Math.max(zoom, CITY_ZOOM))
  }

  return (
    /* The map's height must be definite, not just a minimum: .map-container is
       height:100%, and a percentage against a min-height resolves to zero. So
       a fixed 450px stacked, and the row's own height side by side. */
    <div hidden={hidden} className="flex flex-col lg:h-[calc(100vh-200px)] lg:flex-row">
      {/* ── Sidebar ── */}
      <div className="custom-scroll max-h-52 w-full shrink-0 overflow-y-auto rounded-t-lg border border-edge bg-surface lg:max-h-none lg:w-[340px] lg:rounded-l-lg lg:rounded-tr-none lg:border-r-0">
        <div className="sticky top-0 z-10 border-b border-edge bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              {pinned ? `${listed.length} pinned` : `Shops · ${listed.length}`}
            </h2>
            {pinned && (
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="rounded border border-edge px-2 py-0.5 text-[10px] text-ink-2 transition-colors hover:border-primary hover:text-white"
              >
                Show all
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-ink-2">Select one to show it on the map</p>
        </div>

        <ul>
          {listed.map((shop) => (
            <li key={shop.id}>
              <div
                className={`flex w-full flex-col gap-0.5 border-b border-edge px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                  focused === shop ? 'bg-[#1e3a5f]' : ''
                }`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => show(shop)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                  >
                    {shop.input.icon && <ItemIcon src={shop.input.icon} className="size-6" />}
                    <span className="break-words text-ink-2">{shop.input.label}</span>
                    <span aria-hidden className="shrink-0 text-ink-3">
                      &rarr;
                    </span>
                    {shop.output.icon && <ItemIcon src={shop.output.icon} className="size-6" />}
                    <span className="break-words text-ink-2">{shop.output.label}</span>
                  </button>
                  {shop.input.lore && <Lore text={shop.input.lore} label={shop.input.label} />}
                  {shop.output.lore && <Lore text={shop.output.lore} label={shop.output.label} />}
                </div>
                {pinned && shop.position && (
                  <span className="font-mono text-[10px] text-ink-2">
                    {shop.position.x}, {shop.position.z}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Map ── */}
      <div className="relative h-[450px] grow overflow-hidden lg:h-auto">
        <MapFrame
          handleRef={handle}
          resetTo={CITIES[0].at}
          resetZoom={CITY_ZOOM}
          status={
            <span className="font-bold text-[#cbd5e1]">
              {Math.round(hover.x)}, {Math.round(hover.z)}
            </span>
          }
        >
          <CivMap
            className="size-full"
            initialCenter={CITIES[0].at}
            initialZoom={CITY_ZOOM}
            showClaims={false}
            onMouseMove={setHover}
            onZoom={setZoom}
            onClick={() => {
              setPinned(null)
              setFocused(null)
            }}
            handleRef={handle}
          >
            <MarkerLayer
              items={clusters}
              position={(cluster) => cluster}
              icon={pinFor}
              openItem={openCluster}
              onSelect={(cluster) => {
                setPinned(cluster)
                setFocused(null)
              }}
              popup={(cluster) => <ClusterPopup cluster={cluster} />}
            />
          </CivMap>

          <div className="absolute top-3 right-3 z-1000 flex overflow-hidden rounded-lg border border-edge bg-surface/95">
            {CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => handle.current?.setView(city.at, CITY_ZOOM)}
                className="px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-white"
              >
                {city.name}
              </button>
            ))}
          </div>
        </MapFrame>
      </div>
    </div>
  )
}

function ClusterPopup({ cluster }: { cluster: Cluster<Shop> }) {
  const many = cluster.items.length > 1

  return (
    <div className="w-[min(420px,80vw)] overflow-hidden rounded-lg bg-surface text-ink">
      {/* pr-10 keeps the count clear of Leaflet's close button, which floats
          over the popup at top right. */}
      <div className="flex items-center justify-between gap-2 border-b border-edge bg-ground/50 p-3 pr-10">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-cyan uppercase">
          <Layers aria-hidden className="size-3.5" />{' '}
          {many ? 'Multiple Exchanges' : 'Shop Exchange'}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[9px] font-bold text-ink-2">
          {cluster.items.length} Exchange{many ? 's' : ''}
        </span>
      </div>

      <ul className="custom-scroll flex max-h-56 flex-col divide-y divide-edge/30 overflow-y-auto p-3">
        {cluster.items.map((shop) => (
          <li key={shop.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              {shop.input.icon && <ItemIcon src={shop.input.icon} className="size-5" />}
              <span className="text-xs font-bold text-white">{shop.input.label}</span>
              <span aria-hidden className="text-xs text-ink-3">
                &rarr;
              </span>
              {shop.output.icon && <ItemIcon src={shop.output.icon} className="size-5" />}
              <span className="text-xs font-bold text-white">{shop.output.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-ink-2">
              <span className="rounded border border-edge bg-ground/60 px-1.5 py-0.5 font-mono text-[9px] text-cyan">
                {shop.position?.x}, {shop.position?.z}
              </span>
              {/*
               * Shown on clustered pins too: that is exactly when several shops
               * share a spot and you most need to know whose is whose.
               */}
              <span>
                Contact <span className="font-bold text-ink-2">{shop.contact || 'Unknown'}</span>
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] text-ink-2">
                {shop.city}
              </span>
              {!shop.inStock && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] text-ink-2">
                  No exchanges available
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

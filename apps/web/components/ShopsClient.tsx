'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, ChevronDown, List, Map as MapIcon, Search, X } from 'lucide-react'
import { formatCoordinates, tradePng, type Shop } from '@nara/lib'
import { CopyImageButton, Switch, ToggleButton } from '@/components/ui'
import {
  COLUMNS,
  filterShops,
  readFilters,
  writeFilters,
  type ColumnKey,
  type Filters,
} from '@/lib/shopFilters'
import { ShopsMap } from './ShopsMap'
import { ItemIcon } from './ItemIcon'

/**
 * The shop browser: filters, a sortable table, and a map view.
 *
 * This component server-renders — only the map inside it is client-only,
 * because Leaflet needs `window` — so every row arrives as HTML.
 */

export function ShopsClient({ shops }: { shops: Shop[] }) {
  const [filters, setFilters] = useState(() => readFilters(new URLSearchParams()))
  /* Mounted on first use and then kept mounted: re-initialising Leaflet costs
     far more than leaving a hidden map in the DOM. */
  const [mapUsed, setMapUsed] = useState(false)

  /* The page is built on a timer, not per request, so the URL is read here. */
  useEffect(() => {
    const fromUrl = readFilters(new URLSearchParams(window.location.search))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once, after hydration
    setFilters(fromUrl)
    if (fromUrl.view === 'map') setMapUsed(true)
  }, [])

  /* The URL write is a side effect, so it stays out of the state updater —
     React may call an updater more than once per commit. */
  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }
    writeFilters(next)
    setFilters(next)
  }

  const cities = useMemo(
    () => [...new Set(shops.map((shop) => shop.city).filter(Boolean))].sort(),
    [shops],
  )
  const tags = useMemo(() => [...new Set(shops.flatMap((shop) => shop.tags))].sort(), [shops])

  const visible = useMemo(() => filterShops(shops, filters), [shops, filters])

  const allCities = filters.cities === null

  const toggleCity = (city: string) => {
    const lower = city.toLowerCase()
    const selected = filters.cities ?? cities.map((c) => c.toLowerCase())
    const next = selected.includes(lower)
      ? selected.filter((c) => c !== lower)
      : [...selected, lower]
    update({ cities: next.length === cities.length ? null : next })
  }

  const toggleTag = (tag: string) =>
    update({
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    })

  /* First click sorts ascending; both directions are one click away. */
  const toggleSort = (key: ColumnKey) =>
    update({
      sort:
        filters.sort?.key === key && filters.sort.direction === 'asc'
          ? { key, direction: 'desc' }
          : { key, direction: 'asc' },
    })

  return (
    <>
      {/* ── City filters ── */}
      <div className="mb-6 flex flex-wrap gap-2">
        <ToggleButton pressed={allCities} onClick={() => update({ cities: allCities ? [] : null })}>
          All
        </ToggleButton>
        {cities.map((city) => (
          <ToggleButton
            key={city}
            pressed={allCities || !!filters.cities?.includes(city.toLowerCase())}
            onClick={() => toggleCity(city)}
          >
            {city}
          </ToggleButton>
        ))}
      </div>

      {/* ── Advanced options ── */}
      <details className="group mb-6">
        <summary className="flex cursor-pointer items-center gap-2 text-primary transition-colors hover:text-white">
          <ChevronDown aria-hidden className="size-6 transition-transform group-open:rotate-180" />
          <span className="text-lg font-semibold">Advanced Options</span>
        </summary>

        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-ink-3">Filter by tag</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <ToggleButton
                  key={tag}
                  pressed={filters.tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {filters.tags.includes(tag) && <X aria-hidden className="ml-1 inline size-3" />}
                </ToggleButton>
              ))}
            </div>
          </fieldset>

          {/*
           * Reads Exchanges_Available, and hides four rows in five — worth
           * naming which way round it runs.
           */}
          <Switch
            label="Only shops with exchanges available"
            checked={filters.availableOnly}
            onChange={(availableOnly) => update({ availableOnly })}
            className="justify-start"
          />
        </div>
      </details>

      {/* ── View toggle and search ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="group" aria-label="View">
          <ToggleButton
            pressed={filters.view === 'table'}
            onClick={() => update({ view: 'table' })}
          >
            <List aria-hidden className="size-4" />
            Table
          </ToggleButton>
          <ToggleButton
            pressed={filters.view === 'map'}
            onClick={() => {
              setMapUsed(true)
              update({ view: 'map' })
            }}
          >
            <MapIcon aria-hidden className="size-4" />
            Map
          </ToggleButton>
        </div>

        <div className="ml-auto flex h-10 w-full items-center gap-2 rounded-full border border-edge bg-surface pr-2 pl-3 transition-colors focus-within:border-primary sm:w-1/2">
          <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search shops…"
            aria-label="Search shops"
            className="h-full min-w-0 grow bg-transparent text-sm text-white placeholder-ink-2 focus:outline-none"
          />
          <label htmlFor="search-field" className="sr-only">
            Search in
          </label>
          <select
            id="search-field"
            value={filters.searchField}
            onChange={(event) => update({ searchField: event.target.value as ColumnKey | 'all' })}
            className="shrink-0 cursor-pointer bg-surface text-sm text-white focus:outline-none"
          >
            <option value="all">All Fields</option>
            {COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="mb-3 text-sm text-ink-3">
        {visible.length} of {shops.length} exchanges
        {filters.view === 'map' && ' · the filters above apply to the map too'}
      </p>

      {/* ── Table ── */}
      <div
        hidden={filters.view !== 'table'}
        className="overflow-hidden rounded-lg border border-edge bg-surface"
      >
        {/* Below md each row lays out as a card from the same markup — no second copy of
            579 rows. Column headers are hidden there, so sorting gets a dropdown. */}
        <label className="flex items-center gap-2 border-b border-edge px-3 py-2 text-sm text-ink-2 md:hidden">
          Sort by
          <select
            value={filters.sort ? `${filters.sort.key}:${filters.sort.direction}` : ''}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(':') as [ColumnKey, 'asc' | 'desc']
              update({ sort: e.target.value ? { key, direction } : null })
            }}
            className="min-w-0 flex-1 cursor-pointer rounded-full border border-edge bg-surface px-3 py-1 text-sm text-white"
          >
            <option value="">Default</option>
            {COLUMNS.flatMap((column) => [
              <option key={`${column.key}:asc`} value={`${column.key}:asc`}>
                {column.label} (A–Z)
              </option>,
              <option key={`${column.key}:desc`} value={`${column.key}:desc`}>
                {column.label} (Z–A)
              </option>,
            ])}
          </select>
        </label>
        <div className="md:overflow-x-auto">
          <table className="w-full max-md:block md:table-fixed">
            <thead className="bg-surface-2 max-md:hidden">
              <tr>
                {COLUMNS.map((column) => {
                  const sorted = filters.sort?.key === column.key
                  const ascending = filters.sort?.direction === 'asc'
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={sorted ? (ascending ? 'ascending' : 'descending') : 'none'}
                      className="w-1/5 px-3 py-4 text-left text-sm font-semibold sm:px-6"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={`flex items-center gap-1 whitespace-nowrap transition-colors hover:text-white ${
                          sorted ? 'text-white' : 'text-primary'
                        }`}
                      >
                        <ChevronDown
                          aria-hidden
                          className={`size-4 transition-[transform,opacity] ${
                            sorted ? (ascending ? 'rotate-180' : '') : 'opacity-30'
                          }`}
                        />
                        {column.label}
                      </button>
                    </th>
                  )
                })}
                <th scope="col" className="w-36 px-3 py-4">
                  <span className="sr-only">Share</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge max-md:block">
              {visible.map((shop) => (
                <tr
                  key={shop.id}
                  className="transition-colors hover:bg-surface-2 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:px-3 max-md:py-2.5"
                >
                  <Cell className="max-md:col-span-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <ItemCell item={shop.input} />
                      <span aria-hidden className="text-primary md:hidden">
                        →
                      </span>
                      <span className="md:hidden">
                        <ItemCell item={shop.output} />
                      </span>
                    </span>
                  </Cell>
                  <Cell className="max-md:hidden">
                    <ItemCell item={shop.output} />
                  </Cell>
                  <Cell className="max-md:col-span-2">
                    <Coordinates shop={shop} />
                    <span className="text-ink-3 md:hidden"> · {shop.city}</span>
                  </Cell>
                  <Cell className="max-md:hidden">{shop.city}</Cell>
                  <Cell className="max-md:self-center">
                    <span className="text-ink-3 md:hidden">Contact: </span>
                    {shop.contact}
                  </Cell>
                  <td className="py-4 pr-4 pl-3 text-right max-md:p-0 sm:pr-6">
                    <CopyImageButton
                      compact
                      label="Copy Trade"
                      name={`trade ${shop.output.label}`}
                      ariaLabel={`Copy trade image: ${shop.input.label} for ${shop.output.label}`}
                      png={() => tradePng(shop)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-ink-2">
            No exchanges match these filters.
          </p>
        )}
      </div>

      {/* ── Map ── */}
      {mapUsed && <ShopsMap shops={visible} hidden={filters.view !== 'map'} />}
    </>
  )
}

/* ── Table pieces ─────────────────────────────────────── */

function Cell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={`px-3 py-4 text-sm break-words text-ink-2 max-md:block max-md:p-0 md:max-w-[200px] md:px-6 ${className}`}
    >
      {children}
    </td>
  )
}

export function ItemCell({ item }: { item: Shop['input'] }) {
  return (
    <span className="flex items-center gap-2">
      {item.icon && <ItemIcon src={item.icon} />}
      <span>{item.label}</span>
      {item.lore && <Lore text={item.lore} label={item.label} />}
    </span>
  )
}

/**
 * An item's lore, from the book icon — a button, so it is reachable by keyboard
 * and screen reader.
 *
 * The text is a popover, so it renders in the top layer: an absolutely placed
 * tooltip was clipped by the table's scroll container and the card's rounded
 * overflow. Hover or focus shows it; a tap or click pins it until you tap away
 * or press Escape. It is placed above the icon, flipped below near the top of the
 * screen, and kept inside the viewport.
 */
export function Lore({ text, label }: { text: string; label: string }) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const pinned = useRef(false)

  const place = () => {
    const anchor = button.current?.getBoundingClientRect()
    const el = tip.current
    if (!anchor || !el) return
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    const left = Math.min(
      Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - margin,
    )
    const above = anchor.top - height - margin
    el.style.left = `${left}px`
    el.style.top = `${above >= margin ? above : anchor.bottom + margin}px`
  }
  const show = () => {
    if (!tip.current?.matches(':popover-open')) tip.current?.showPopover()
    place()
  }
  const hide = () => {
    if (!pinned.current && tip.current?.matches(':popover-open')) tip.current.hidePopover()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="relative ml-1 inline-flex min-h-6 min-w-6 cursor-help items-center justify-center align-middle"
        aria-label={`Item details for ${label}`}
        aria-describedby={id}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          pinned.current = !pinned.current
          if (pinned.current) show()
          else tip.current?.hidePopover()
        }}
      >
        <BookOpen aria-hidden className="size-4 text-ink-3" />
      </button>
      <div
        ref={tip}
        id={id}
        popover="auto"
        role="tooltip"
        onToggle={(e) => {
          if (e.newState === 'closed') pinned.current = false
        }}
        className="fixed inset-auto m-0 w-max max-w-[min(320px,calc(100vw-16px))] rounded-md border border-[#4b5563] bg-surface px-3 py-2 text-left text-sm whitespace-pre-wrap text-white shadow-[0_4px_6px_rgb(0_0_0/30%)]"
      >
        {text}
      </div>
    </>
  )
}

export function Coordinates({ shop }: { shop: Shop }) {
  if (!shop.position) return shop.coordinates
  return (
    <a
      href={`https://map.civinfo.net/#c=${shop.position.x},${shop.position.z}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in CivInfo map"
      className="coord-link relative inline-block text-primary-alt no-underline"
    >
      {formatCoordinates(shop.position)}
    </a>
  )
}

/* ── Buttons ──────────────────────────────────────────── */

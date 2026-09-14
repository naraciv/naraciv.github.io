import type { Shop } from '@nara/lib'

/**
 * Which rows /shops shows, and how that state round-trips through the URL.
 *
 * Its own module so the filtering stays pure and testable apart from the
 * component that reads and writes the browser URL.
 */

/* Column keys double as the search-field values. `sortIndex` is the CSV
   column number that ?sort_col= links use. */
export const COLUMNS = [
  { key: 'input', label: 'Input', sortIndex: 1 },
  { key: 'output', label: 'Output', sortIndex: 3 },
  { key: 'coords', label: 'Coords', sortIndex: 5 },
  { key: 'city', label: 'City', sortIndex: 7 },
  { key: 'contact', label: 'Contact (IGN)', sortIndex: 9 },
] as const

export type ColumnKey = (typeof COLUMNS)[number]['key']

export function field(shop: Shop, key: ColumnKey): string {
  switch (key) {
    case 'input':
      return shop.input.label
    case 'output':
      return shop.output.label
    case 'coords':
      return shop.coordinates
    case 'city':
      return shop.city
    case 'contact':
      return shop.contact
  }
}

/**
 * What "All Fields" covers: not the timestamp or stock flag, so "2025" and
 * "true" do not match every row; the lore and tags are included.
 */
const haystack = (shop: Shop) =>
  [
    shop.input.label,
    shop.output.label,
    shop.input.lore,
    shop.output.lore,
    shop.coordinates,
    shop.city,
    shop.contact,
    shop.tags.join(' '),
  ]
    .join('\n')
    .toLowerCase()

export type Filters = {
  search: string
  searchField: ColumnKey | 'all'
  tags: string[]
  /** Lowercased city names, or null for every city. An empty array hides them
   *  all. */
  cities: string[] | null
  availableOnly: boolean
  sort: { key: ColumnKey; direction: 'asc' | 'desc' } | null
  view: 'table' | 'map'
}

const isColumnKey = (value: string | null): value is ColumnKey =>
  COLUMNS.some((column) => column.key === value)

/** Filters from a query string; an empty one gives the defaults. */
export function readFilters(params: URLSearchParams): Filters {
  const sortColumn = COLUMNS.find((column) => String(column.sortIndex) === params.get('sort_col'))
  const searchField = params.get('field')

  return {
    search: params.get('search') ?? '',
    searchField: isColumnKey(searchField) ? searchField : 'all',
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
    cities: params.get('cities')?.split(',').filter(Boolean) ?? null,
    availableOnly: params.get('exclude_oos') === 'true',
    sort: sortColumn
      ? { key: sortColumn.key, direction: params.get('sort_dir') === 'desc' ? 'desc' : 'asc' }
      : null,
    view: params.get('type') === 'map' ? 'map' : 'table',
  }
}

export function writeFilters(filters: Filters) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.searchField !== 'all') params.set('field', filters.searchField)
  if (filters.tags.length) params.set('tags', filters.tags.join(','))
  if (filters.cities) params.set('cities', filters.cities.join(','))
  if (filters.availableOnly) params.set('exclude_oos', 'true')
  if (filters.sort) {
    const column = COLUMNS.find((c) => c.key === filters.sort?.key)
    if (column) {
      params.set('sort_col', String(column.sortIndex))
      params.set('sort_dir', filters.sort.direction)
    }
  }
  if (filters.view === 'map') params.set('type', 'map')

  /* replaceState, not pushState: a history entry per keystroke would make Back
     walk the search box backwards one character at a time. */
  const query = params.toString()
  window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
}

/** The visible rows, filtered then sorted. Pure, so the same call gives the
 *  static first paint and every keystroke after. */
export function filterShops(shops: Shop[], filters: Filters): Shop[] {
  const search = filters.search.trim().toLowerCase()

  const matched = shops.filter((shop) => {
    if (filters.cities && !filters.cities.includes(shop.city.toLowerCase())) return false
    if (filters.tags.length && !filters.tags.some((tag) => shop.tags.includes(tag))) return false
    if (filters.availableOnly && !shop.inStock) return false
    if (!search) return true
    return filters.searchField === 'all'
      ? haystack(shop).includes(search)
      : field(shop, filters.searchField).toLowerCase().includes(search)
  })

  const sort = filters.sort
  if (!sort) return matched
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...matched].sort(
    (a, b) => direction * field(a, sort.key).localeCompare(field(b, sort.key)),
  )
}

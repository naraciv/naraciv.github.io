import { sanity } from './sanity'
import { parseShops, type Shop } from './shops'
import { fallbackCities, fallbackGovernmentRoles, fallbackOrganizations } from './fallback'

export type GovernmentGroup = 'leadership' | 'daimyo' | 'komuin' | 'other' | 'populace'

export type GovernmentRole = {
  _id: string
  title: string
  /** Absent for the groups that describe a kind of person rather than a post. */
  holder?: string
  group: GovernmentGroup
  description: string
  icon?: 'star' | 'users' | 'crosshair'
}

/**
 * Other Roles and Nara's Populace describe a class of person, so they have no
 * holder and lead with the role name. Every other group is a post someone
 * holds, and an empty holder means the post is open.
 */
const HELD_GROUPS: GovernmentGroup[] = ['leadership', 'daimyo', 'komuin']

export function roleHolder(role: GovernmentRole): string | null {
  if (!HELD_GROUPS.includes(role.group)) return null
  return role.holder?.trim() || 'Vacant'
}

export type Organization = {
  _id: string
  title: string
  description: string
  icon?: 'book' | 'bookOpen' | 'coffee' | 'mail' | 'users'
}

export type Listing = {
  _id: string
  address?: string
  coordinates: string
  price: number
  is_rental?: boolean
  city?: string
  listing_owner?: string
  building_type?: string
  schematicUrl?: string
  images?: string[]
}

/**
 * Building types as stored. `house_and_shop` and `house_shop` are both in the
 * data, so every page formats through here.
 */
const BUILDING_TYPES: Record<string, string> = {
  home: 'Home',
  apartment: 'Apartment',
  house_shop: 'House & Shop',
  hotel_room: 'Hotel Room',
  shop: 'Shop',
}

export function formatBuildingType(type: string | undefined): string {
  return BUILDING_TYPES[buildingTypeKey(type)] ?? (type as string)
}

/** Normalised for filtering, so the two spellings compare equal. */
export function buildingTypeKey(type: string | undefined): string {
  const key = type?.toLowerCase() || 'home'
  return key === 'house_and_shop' ? 'house_shop' : key
}

export type City = {
  _id: string
  name: string
  slug: string
  coordinates: string
  description: string
  image?: { url: string; alt?: string }
}

/**
 * Sanity when it has content, the fallback data when it does not.
 *
 * Two cases collapse into one here on purpose: Sanity not seeded yet, and the
 * Content Lake being unreachable. Either way a reader gets the page rather
 * than an empty section.
 */
async function withFallback<T>(query: string, fallback: T[], label: string): Promise<T[]> {
  try {
    const rows = await sanity.fetch<T[]>(query)
    return rows?.length ? rows : fallback
  } catch (error) {
    console.warn(`[nara] Sanity query for ${label} failed, serving fallback data.`, error)
    return fallback
  }
}

export function getGovernmentRoles(): Promise<GovernmentRole[]> {
  return withFallback(
    /* defined(title): the name field is optional so a part-written role can be
       saved, but a card with no heading is meaningless — those stay unpublished
       in effect. The Studio preview says so on the document itself. */
    `*[_type == "governmentRole" && defined(title)] | order(order asc, title asc) {
      _id, title, holder, group, description, icon
    }`,
    fallbackGovernmentRoles,
    'governmentRole',
  )
}

export function getOrganizations(): Promise<Organization[]> {
  return withFallback(
    `*[_type == "organization" && defined(title)] | order(order asc, title asc) {
      _id, title, description, icon
    }`,
    fallbackOrganizations,
    'organization',
  )
}

/**
 * Listings for /homes. `is_active != false` counts undefined as active, and filtering
 * here means an inactive listing never reaches the browser at all.
 *
 * No fallback data: inventing property listings would be worse than an empty page.
 */
export function getListings(): Promise<Listing[]> {
  return withFallback(
    `*[_type == "listingPost" && is_active != false && defined(coordinates)] | order(price asc) {
      _id, address, coordinates, price, is_rental, city, listing_owner, building_type,
      "schematicUrl": schematic_file.asset->url,
      "images": images[].asset->url
    }`,
    [],
    'listingPost',
  )
}

/**
 * A single listing.
 *
 * The `$id` parameter is the point: interpolating the id into the GROQ string
 * would let a crafted id rewrite the query. Parameters are sent separately and
 * cannot alter it.
 */
export async function getListing(id: string): Promise<Listing | null> {
  try {
    return await sanity.fetch<Listing | null>(
      `*[_type == "listingPost" && _id == $id][0] {
        _id, address, coordinates, price, is_rental, city, listing_owner, building_type,
        "schematicUrl": schematic_file.asset->url,
        "images": images[].asset->url
      }`,
      { id },
    )
  } catch (error) {
    console.warn('[nara] Sanity query for listing failed.', error)
    return null
  }
}

export function getCities(): Promise<City[]> {
  return withFallback(
    `*[_type == "city" && defined(name)] | order(order asc, name asc) {
      _id, name, "slug": slug.current, coordinates, description,
      "image": image{ "url": asset->url, alt }
    }`,
    fallbackCities,
    'city',
  )
}

/**
 * Empty rather than a fallback: shop listings are player-maintained and
 * inventing them would be worse than an empty table. Same call as /homes.
 */
export async function getShops(): Promise<Shop[]> {
  try {
    const url = await sanity.fetch<string | null>(
      `*[_type == "shopEntry"] | order(_createdAt desc)[0].csv_file.asset->url`,
    )
    if (!url) return []

    /* The asset URL is content-addressed, so this only refetches when a new
       CSV is uploaded and the query above returns a different one. */
    const response = await fetch(url, { next: { revalidate: 300 } })
    if (!response.ok) throw new Error(`shop CSV ${response.status}`)

    return parseShops(await response.text())
  } catch (error) {
    console.warn('[nara] Loading the shop CSV failed, serving an empty table.', error)
    return []
  }
}

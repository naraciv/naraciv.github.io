import type { MetadataRoute } from 'next'
import { getListings } from '@nara/lib'
import { site } from '@/lib/site'

/**
 * Every indexable page. /collect is per-visitor state (robots.ts disallows it)
 * and player profiles are noindex, so neither is listed.
 */
const routes = [
  '',
  '/government',
  '/heads',
  '/homes',
  '/joining',
  '/planner',
  '/privacy',
  '/rocket',
  '/shops',
  '/snitches',
  '/stats',
  '/tools',
]

/* Listings come from Sanity, so pick up new ones the way /homes does. */
export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await getListings()
  return [
    ...routes.map((route) => ({
      url: `${site.url}${route}`,
      changeFrequency: route === '' ? ('weekly' as const) : ('monthly' as const),
      priority: route === '' ? 1 : 0.7,
    })),
    ...listings.map((listing) => ({
      url: `${site.url}/homes/${listing._id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}

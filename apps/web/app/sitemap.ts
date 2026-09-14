import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

/**
 * Static routes only, for now. Individual listings and player profiles get
 * added as those routes land, generated from their own sources so this stays
 * correct without maintenance.
 */
const routes = [
  '',
  '/collect',
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

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }))
}

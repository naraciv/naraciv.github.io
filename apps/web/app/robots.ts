import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

/**
 * Every crawler, LLM crawlers included, is allowed deliberately; /collect is
 * per-visitor state and has nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/collect'] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}

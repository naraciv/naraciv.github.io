import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import { parseHeads } from '@nara/lib'
import { HeadShop } from '@/components/HeadShop'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'MitsuHead Shop',
  description:
    "Browse MitsuHeadCorp's decorative heads for sale in Shiro: player heads, mob heads, decoration heads and more more more.",
  alternates: { canonical: '/heads' },
  openGraph: {
    title: 'Nara | MitsuHeadCorp Shop',
    images: [{ url: '/images/head_preview.webp', width: 1200, height: 630 }],
  },
}

/*
 * Static: the CSV is committed to this repo and read once at build. A request-
 * time read would need the file traced into the server bundle from outside
 * apps/web, which is fragile; a rebuild on data change is not — vercel.json's
 * ignoreCommand watches data/ for exactly this.
 */
export const dynamic = 'force-static'

const heads = parseHeads(
  readFileSync(path.join(process.cwd(), '../../data/head_shop_data.csv'), 'utf8'),
)

export default function HeadsPage() {
  return (
    <div className="px-3 pt-[88px] sm:px-4 sm:pt-[100px]">
      <div className="mx-auto w-full py-6 sm:w-[90%] sm:max-w-[90%] sm:py-20">
        {/* A Store, not a catalogue of Offers: prices are diamonds and iron,
            which have no currency code, and inventing one would be fabricated
            structured data. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: 'MitsuHeadCorp',
            description: `A private head shop in Nara selling ${heads.length} decorative Minecraft heads.`,
            url: `${site.url}/heads`,
            image: `${site.url}/images/head_preview.webp`,
          }}
        />

        <h1 className="mb-6 text-center text-4xl font-bold text-primary sm:mb-16 sm:text-5xl">
          MitsuHeadCorp
        </h1>

        <HeadShop heads={heads} />

        <div className="mt-8 mb-4 p-4 text-center">
          <p className="text-sm text-ink-3">
            <strong className="text-ink-2">Disclaimer:</strong> MitsuHeadCorp is not affiliated with
            the Naran Government and is a private business.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            For any inquiries, please reach out to <span className="text-primary">HPLaptop</span>{' '}
            (@rm.dv).
          </p>
          <p className="mt-1 text-xs text-ink-3">Online ordering is not available at this time.</p>
        </div>
      </div>
    </div>
  )
}

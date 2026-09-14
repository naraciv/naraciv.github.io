import type { Metadata } from 'next'
import { Noto_Sans_JP, Rajdhani } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { DiscordFloatingButton } from '@/components/ui'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/lib/site'

const notoSansJp = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
})

/* Used only by the gacha countdown timer. */
const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

/* The homepage NARA wordmark. */
const hiromisake = localFont({
  src: '../public/static/HIROMISAKE.ttf',
  variable: '--font-hiromisake',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: '/' },
  icons: { icon: '/images/nara_flag_white_border.svg' },
  /* No title, description or url here: Next fills og:title and og:description
     from each page's own metadata, and hard-coding them gave every page the
     homepage's link preview. */
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'en_US',
    images: [{ url: '/images/nara_above.webp', alt: 'Shiroyama, the capital of Nara' }],
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${notoSansJp.variable} ${rajdhani.variable} ${hiromisake.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: site.name,
            alternateName: 'Nara Civ',
            url: site.url,
            description: site.description,
            foundingDate: site.founded,
            logo: `${site.url}/images/nara_flag_white_border.svg`,
            sameAs: [site.discord],
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-ground"
        >
          Skip to content
        </a>
        <Navbar />
        {/* Pages own their own top spacing: content pages use an h-[100px]
            spacer, the homepage hero clears the nav exactly. */}
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <DiscordFloatingButton href={site.discord} label="Join Naracord" />
      </body>
    </html>
  )
}

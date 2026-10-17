import type { Metadata } from 'next'
import { IceRoadViewer } from '@/components/IceRoadViewer'

/* Unlisted: not in the nav, tools page or sitemap, kept out of search, and no link-preview embed. */
export const metadata: Metadata = {
  title: 'Ice Road Map',
  description: null,
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
}

export default function IceRoadsPage() {
  return (
    <div
      data-hide-discord
      className="px-2 pt-[76px] pb-3 [--map-backdrop:#1a1a1a] [--map-tile-opacity:0.35] sm:px-3 sm:pt-[84px]"
    >
      <h1 className="mb-2 text-center text-xl font-bold text-primary sm:text-2xl">Ice Road Map</h1>
      <IceRoadViewer />
    </div>
  )
}

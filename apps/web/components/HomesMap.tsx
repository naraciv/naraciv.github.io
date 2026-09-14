'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import type { Listing } from '@nara/lib'
import type { Cluster } from '@/components/map'

/**
 * The client-only boundary, kept as small as possible: Leaflet reads `window`
 * at module scope, so only the map is excluded from server rendering. The
 * filters and listing cards around it still arrive as HTML.
 */
export const HomesMap = dynamic<{
  listings: Listing[]
  popup: (cluster: Cluster<Listing>) => ReactNode
}>(() => import('./HomesMapPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-[#050811] text-xs text-ink-3">
      Loading map…
    </div>
  ),
})

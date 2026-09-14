'use client'

import dynamic from 'next/dynamic'
import type { Shop } from '@nara/lib'

/**
 * The client-only boundary, kept as small as possible: Leaflet reads `window`
 * at module scope, so only the map and its sidebar are excluded from server
 * rendering. The filters and the whole table around it still arrive as HTML.
 */
export const ShopsMap = dynamic<{ shops: Shop[]; hidden: boolean }>(
  () => import('./ShopsMapPanel'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-edge bg-[#050811] text-xs text-ink-3">
        Loading map…
      </div>
    ),
  },
)

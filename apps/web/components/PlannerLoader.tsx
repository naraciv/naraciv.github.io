'use client'

import dynamic from 'next/dynamic'
import { useMediaQuery } from '@/lib/useMediaQuery'

/**
 * Leaflet reads `window` when its module is evaluated, so the planner has to
 * be client-only. Next 16 rejects `ssr: false` inside a Server Component, so
 * the dynamic import lives here and the page renders this instead.
 */
const Planner = dynamic(() => import('./Planner'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[560px] items-center justify-center text-ink-3">
      Loading the map…
    </div>
  ),
})

/** Tablet width and up only: on phones the page shows a notice and the planner (and Leaflet) never loads. */
export function PlannerLoader() {
  return useMediaQuery('(min-width: 768px)') ? <Planner /> : null
}

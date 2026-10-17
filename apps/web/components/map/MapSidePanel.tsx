'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * A panel that floats over the top-left of a map on desktop and stacks above it on
 * phones. Halfway down its right edge is a small tab, drawn as part of the panel (same
 * fill, no border between them), the way Google Maps and ArcGIS side panels collapse:
 * clicking it slides the panel off the map's left edge, leaving only the tab to bring
 * it back.
 *
 * Put it in the same `lg:relative` wrapper as the map; children are the panel's
 * sections and are separated by dividers. A section with min-h-0 gives up height first;
 * past that the whole panel scrolls, so it never runs off the bottom of the map.
 *
 * Import it from this file, not the map index: the index pulls in Leaflet, which cannot
 * load during server rendering.
 */

const surface = 'border-[#374151] bg-surface/95 backdrop-blur-sm'

export function MapSidePanel({ label, children }: { label: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false)
  return (
    <aside
      aria-label={label}
      className={`flex flex-col transition-transform duration-300 lg:absolute lg:top-3 lg:left-3 lg:z-10 lg:max-h-[calc(100%-6rem)] lg:w-72 ${hidden ? 'lg:-translate-x-[calc(100%+0.75rem)]' : ''}`}
    >
      <div
        inert={hidden}
        className={`custom-scroll flex min-h-0 flex-col divide-y divide-[#374151] overflow-y-auto rounded-lg border shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${surface}`}
      >
        {children}
      </div>
      {/* -ml-px: overlaps the panel's border so the tab and panel read as one shape. */}
      <button
        type="button"
        onClick={() => setHidden(!hidden)}
        aria-expanded={!hidden}
        aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
        title={hidden ? 'Show panel' : 'Hide panel'}
        className={`absolute top-1/2 left-full -ml-px hidden h-12 w-5 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 text-ink-2 shadow-[4px_0_8px_rgba(0,0,0,0.35)] transition-colors hover:text-white lg:flex ${surface}`}
      >
        <ChevronLeft
          aria-hidden
          className={`size-4 transition-transform duration-300 ${hidden ? 'rotate-180' : ''}`}
        />
      </button>
    </aside>
  )
}

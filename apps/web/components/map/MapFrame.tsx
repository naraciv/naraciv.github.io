'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Crosshair, Maximize, Minus, Plus } from 'lucide-react'
import type { Coords } from '@nara/lib'
import type { CivMapHandle } from './CivMap'

/**
 * The chrome around a map: rounded container, the zoom / reset / fullscreen
 * button stack, and a status readout in the bottom-left corner.
 *
 * `/planner` uses it today; `/homes`, `/shops` and `/snitches` all need the
 * same furniture, which is why it lives here rather than in the planner.
 *
 * Styling comes from the app's stylesheet (`.map-container`, `.map-controls`,
 * `.map-control-btn`, `.coords-display`) so the classes stay next to the rest
 * of the site's CSS.
 */
export function MapFrame({
  handleRef,
  resetTo,
  resetZoom = -4,
  status,
  children,
}: {
  handleRef: RefObject<CivMapHandle | null>
  /** Where the crosshair button returns to. */
  resetTo: Coords
  resetZoom?: number
  /** Bottom-left readout — coordinates, counts, a hint. */
  status?: ReactNode
  children: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)

  /* Leaflet caches the container size, so it has to be told after the
     fullscreen transition changes it. */
  useEffect(() => {
    const onChange = () => setTimeout(() => handleRef.current?.invalidateSize(), 100)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [handleRef])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else container.current?.requestFullscreen().catch(() => {})
  }

  return (
    <div ref={container} className="map-container">
      {children}

      <div className="map-controls">
        <button
          type="button"
          className="map-control-btn"
          title="Zoom In"
          aria-label="Zoom in"
          onClick={() => handleRef.current?.zoomIn()}
        >
          <Plus aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Zoom Out"
          aria-label="Zoom out"
          onClick={() => handleRef.current?.zoomOut()}
        >
          <Minus aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Reset View"
          aria-label="Reset view"
          onClick={() => handleRef.current?.setView(resetTo, resetZoom)}
        >
          <Crosshair aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Toggle Fullscreen"
          aria-label="Toggle fullscreen"
          onClick={toggleFullscreen}
        >
          <Maximize aria-hidden className="size-5" />
        </button>
      </div>

      {status && <div className="coords-display">{status}</div>}
    </div>
  )
}

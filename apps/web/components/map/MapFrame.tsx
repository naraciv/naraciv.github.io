'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Crosshair, Maximize, Minus, Plus } from 'lucide-react'
import type { Coords } from '@nara/lib'
import type { CivMapHandle } from './CivMap'

const controlButton =
  'flex size-[38px] cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[rgba(15,23,42,0.85)] text-[#f1f5f9] shadow-[0_4px_12px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-purple/50 hover:bg-purple/20 hover:text-white'

/**
 * The chrome around a map: rounded container, the zoom / reset / fullscreen
 * button stack, and a status readout in the bottom-left corner.
 *
 * `/planner` uses it today; `/homes`, `/shops` and `/snitches` all need the
 * same furniture, which is why it lives here rather than in the planner.
 *
 * isolation: Leaflet stacks its panes and controls at z-index 400-1000, and
 * without a stacking context of its own those values compete with the whole
 * page — so the map drew over the fixed navbar and the Discord button, both
 * z-50. Isolating keeps every map's layers inside its own frame.
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
    <div
      ref={container}
      className="relative isolate size-full min-h-0 overflow-hidden rounded-2xl border border-white/8 bg-[#0b0b0f] shadow-[inset_0_0_45px_rgba(0,0,0,0.85)] [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
    >
      {children}

      <div className="absolute right-4 bottom-4 z-900 flex flex-col gap-2">
        {(
          [
            [Plus, 'Zoom in', (map: CivMapHandle) => map.zoomIn()],
            [Minus, 'Zoom out', (map: CivMapHandle) => map.zoomOut()],
            [Crosshair, 'Reset view', (map: CivMapHandle) => map.setView(resetTo, resetZoom)],
            [Maximize, 'Toggle fullscreen', null],
          ] as const
        ).map(([Icon, label, action]) => (
          <button
            key={label}
            type="button"
            className={controlButton}
            title={label}
            aria-label={label}
            onClick={() =>
              action ? handleRef.current && action(handleRef.current) : toggleFullscreen()
            }
          >
            <Icon aria-hidden className="size-5" />
          </button>
        ))}
      </div>

      {status && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-900 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.9)] px-[0.85rem] py-2 font-mono text-[0.8rem] text-[#e2e8f0] shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-sm">
          {status}
        </div>
      )}
    </div>
  )
}

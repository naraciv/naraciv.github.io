'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, X } from 'lucide-react'
import {
  STATUS_COLOR,
  cullTs,
  daysUntil,
  describeSnitch,
  fitSnitches,
  groupOf,
  markerRadius,
  snitchAt,
  snitchKey,
  type Coords,
  type Snitch,
  type SnitchStatus,
} from '@nara/lib'
import { CanvasLayer, CivMap, MapFrame, type CivMapHandle, type DrawArgs } from '@/components/map'
import type { SnitchSettings } from './SnitchViewer'

/**
 * The snitch map: CivMap tiles, a canvas of markers, a hover card, a selection
 * list, and right-click to copy coordinates. Remounted per database, so the
 * first view fits that database's snitches.
 */

const STATUS_LABEL: Record<SnitchStatus, string> = {
  active: 'Active',
  'will-dormant': 'Will be Dormant',
  dormant: 'Dormant',
  culled: 'Culled',
}

export default function SnitchMap({
  snitches,
  statusOf,
  settings,
  selected,
  onSelect,
  onClearSelection,
  now,
}: {
  snitches: Snitch[]
  statusOf: Map<Snitch, SnitchStatus>
  settings: SnitchSettings
  selected: Map<string, Snitch>
  onSelect: (snitch: Snitch) => void
  onClearSelection: () => void
  now: number
}) {
  const handle = useRef<CivMapHandle>(null)
  const box = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<Coords>({ x: 0, z: 0 })
  /* flip: open the card up/left of the pointer when it would run off that edge. */
  const [hover, setHover] = useState<{
    snitch: Snitch
    x: number
    y: number
    flipX: boolean
    flipY: boolean
  } | null>(null)
  const [copied, setCopied] = useState<{ x: number; y: number } | null>(null)
  const zoomRef = useRef(-5)
  /* Last pointer position inside the frame; Leaflet's mousemove gives world coordinates only. */
  const pointerAt = useRef({ x: 0, y: 0 })

  /* With "will be dormant" off, those snitches draw — and filter — as active. */
  const shownStatus = useCallback(
    (s: Snitch): SnitchStatus => {
      const status = statusOf.get(s) ?? 'active'
      return status === 'will-dormant' && !settings.showWillDormant ? 'active' : status
    },
    [statusOf, settings.showWillDormant],
  )
  const shown = useMemo(
    () => snitches.filter((s) => !settings.hiddenStatuses.has(shownStatus(s))),
    [snitches, settings.hiddenStatuses, shownStatus],
  )

  /* Fit once, on mount: the map is keyed per database. */
  const [initial] = useState(() => fitSnitches(snitches, 600))
  useEffect(() => {
    const size = box.current ? Math.min(box.current.clientWidth, box.current.clientHeight) : 600
    const fit = fitSnitches(snitches, size)
    handle.current?.setView(fit, fit.zoom)
    // Mount only; later filter changes must not yank the view around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = useCallback(
    ({ ctx, width, height, zoom, project }: DrawArgs) => {
      zoomRef.current = zoom
      const radius = markerRadius(zoom)
      const range = 21 * 2 ** zoom
      const half = range / 2
      const margin = settings.showRange ? half + 10 : 10

      for (const s of shown) {
        const p = project(s.x, s.z)
        if (p.x < -margin || p.x > width + margin || p.y < -margin || p.y > height + margin)
          continue
        const color = STATUS_COLOR[shownStatus(s)]
        const isSelected = selected.has(snitchKey(s))

        if (settings.showRange) {
          ctx.globalAlpha = 0.5
          ctx.fillStyle = color
          ctx.fillRect(p.x - half, p.y - half, range, range)
          ctx.globalAlpha = 0.8
          ctx.strokeStyle = color
          ctx.lineWidth = 1
          ctx.strokeRect(p.x - half, p.y - half, range, range)
          ctx.globalAlpha = 1
          if (isSelected) {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.strokeRect(p.x - half - 2, p.y - half - 2, range + 4, range + 4)
          }
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          if (isSelected) {
            ctx.beginPath()
            ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2)
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
      }
    },
    [shown, shownStatus, selected, settings.showRange],
  )

  const localPoint = (clientX: number, clientY: number) => {
    const rect = box.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY }
  }

  const status = hover ? (statusOf.get(hover.snitch) ?? 'active') : null
  const cull = hover ? cullTs(hover.snitch) : null

  return (
    <div
      ref={box}
      className="relative size-full"
      onPointerMove={(e) => (pointerAt.current = localPoint(e.clientX, e.clientY))}
      onPointerLeave={() => setHover(null)}
    >
      <MapFrame
        handleRef={handle}
        resetTo={{ x: 0, z: 0 }}
        resetZoom={-5}
        status={
          <>
            <div>
              X: {Math.round(cursor.x)}, Z: {Math.round(cursor.z)}
            </div>
            <div className="mt-1 font-sans text-[0.65rem] text-ink-3">
              Right click map to copy coordinates
            </div>
          </>
        }
      >
        <CivMap
          className="size-full"
          initialCenter={initial}
          initialZoom={initial.zoom}
          showClaims={false}
          onMouseMove={(point, zoom) => {
            setCursor(point)
            const hit = snitchAt(shown, point.x, point.z, zoom)
            const { x, y } = pointerAt.current
            const frame = box.current
            setHover(
              hit
                ? {
                    snitch: hit,
                    x,
                    y,
                    flipX: !!frame && x > frame.clientWidth - 300,
                    flipY: !!frame && y > frame.clientHeight - 160,
                  }
                : null,
            )
          }}
          onClick={(point) => {
            if (!settings.clickSelect) return
            const hit = snitchAt(shown, point.x, point.z, zoomRef.current)
            if (hit) onSelect(hit)
          }}
          onContextMenu={(point, event) => {
            copy(`${point.x}, ${point.z}`).then(() => {
              setCopied(localPoint(event.clientX, event.clientY))
              setTimeout(() => setCopied(null), 800)
            }, warnCopy)
          }}
          handleRef={handle}
        >
          <CanvasLayer draw={draw} />
        </CivMap>

        {/* ── Hover card, inside the frame so it survives fullscreen ── */}
        {hover && status && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-[1000] max-w-[280px] min-w-[150px] rounded-lg border border-[#374151] bg-[rgba(17,24,39,0.95)] p-3 text-xs"
            style={{
              left: hover.x + 15,
              top: hover.y + 15,
              transform: `translate(${hover.flipX ? 'calc(-100% - 30px)' : '0'}, ${hover.flipY ? 'calc(-100% - 30px)' : '0'})`,
            }}
          >
            <div className="mb-2 flex items-center gap-2 border-b border-[#374151] pb-2">
              <span
                className="rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase"
                style={{
                  background: STATUS_COLOR[status],
                  color: status === 'will-dormant' ? '#000' : '#fff',
                }}
              >
                {STATUS_LABEL[status]}
              </span>
              <span className="text-ink">{groupOf(hover.snitch)}</span>
            </div>
            {hover.snitch.name && <Detail label="Name" value={hover.snitch.name} />}
            <Detail
              label="Coordinates"
              value={`${hover.snitch.x}, ${hover.snitch.y}, ${hover.snitch.z}`}
            />
            {(status === 'active' || status === 'will-dormant') &&
              (hover.snitch.dormant_ts ?? 0) > 0 && (
                <Detail
                  label="Becomes Dormant"
                  value={new Date(hover.snitch.dormant_ts!).toLocaleString()}
                />
              )}
            {(status === 'dormant' || status === 'culled') && cull && (
              <Detail label="Cull Date" value={new Date(cull).toLocaleString()} />
            )}
            {status === 'will-dormant' && daysUntil(hover.snitch.dormant_ts, now) && (
              <div className="mt-2 border-t border-[#4b5563] pt-2 font-medium text-[#facc15]">
                Dormant in {daysUntil(hover.snitch.dormant_ts, now)} day
                {daysUntil(hover.snitch.dormant_ts, now) === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}

        {copied && (
          <span
            aria-live="polite"
            className="pointer-events-none absolute z-[1000] animate-[fade-up_0.8s_ease-out_forwards] rounded bg-[#10b981] px-2 py-1 text-xs text-white"
            style={{ left: copied.x, top: copied.y }}
          >
            Copied!
          </span>
        )}

        {/* ── Selection ── */}
        {selected.size > 0 && (
          <div className="absolute top-3 left-3 z-[1000] w-64 rounded-lg border border-[#374151] bg-[rgba(17,24,39,0.95)] text-xs">
            <div className="flex items-center justify-between border-b border-[#374151] px-3 py-2">
              <h3 className="font-semibold text-white">Selected ({selected.size})</h3>
              <div className="flex gap-1">
                <IconButton
                  label="Copy all selected"
                  onClick={() =>
                    copy([...selected.values()].map(describeSnitch).join('\n')).catch(warnCopy)
                  }
                >
                  <Copy aria-hidden className="size-4" />
                </IconButton>
                <IconButton label="Clear selection" onClick={onClearSelection}>
                  <X aria-hidden className="size-4" />
                </IconButton>
              </div>
            </div>
            <ul className="custom-scroll max-h-60 overflow-y-auto">
              {[...selected].map(([key, s]) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 border-b border-[#2d3748] px-3 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-white">{s.name || groupOf(s)}</span>
                    <span className="block text-ink-2">
                      {s.x}, {s.y}, {s.z}
                    </span>
                  </span>
                  <IconButton
                    label={`Copy ${describeSnitch(s)}`}
                    onClick={() => copy(describeSnitch(s)).catch(warnCopy)}
                  >
                    <Copy aria-hidden className="size-3" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </MapFrame>
    </div>
  )
}

/* async, so a missing clipboard (plain http) rejects like a denied one instead of throwing. */
const copy = async (text: string) => navigator.clipboard.writeText(text)
const warnCopy = (error: unknown) => console.warn('[nara] Copying to the clipboard failed.', error)

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1">
      <span className="text-ink-3">{label}</span>
      <div className="text-white">{value}</div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-ink-2 transition-colors hover:bg-[#374151] hover:text-primary-alt"
    >
      {children}
    </button>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Switch, ToggleButton } from '@/components/ui'
import {
  Check,
  Clipboard,
  Crop,
  Download,
  Edit2,
  ExternalLink,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  CivMap,
  GridOverlay,
  MapFrame,
  MAX_ZOOM,
  MIN_ZOOM,
  PRESETS,
  PRESET_KEYS,
  formatCoordinateList,
  nearestVertex,
  selectWithinBorder,
  type CivMapHandle,
  type BorderMode,
  type Point,
  type PresetKey,
} from '@/components/map'

/**
 * Bastion & snitch grid planner.
 *
 * The state is React's and the map is a controlled component; the geometry
 * lives in components/map.
 *
 * <CivMap> imports Leaflet, which touches `window` at module scope, so this
 * component is only ever rendered from a dynamic import with ssr: false.
 */

type Toast = { message: string; tone: 'ok' | 'error' } | null

const panel =
  'rounded-xl border border-purple/15 bg-[rgba(15,23,42,0.65)] p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] backdrop-blur-md lg:p-4'
const input =
  'w-full rounded-lg border border-white/10 bg-[rgba(15,23,42,0.6)] text-white transition-all duration-200 focus:border-purple focus:shadow-[0_0_10px_rgba(224,64,251,0.25)] focus:outline-none'

export default function Planner() {
  const [presetKey, setPresetKey] = useState<PresetKey>('city')
  const [center, setCenter] = useState<Point>({ x: 0, z: 0 })
  const [rangeMinZoom, setRangeMinZoom] = useState(PRESETS.city.rangeMinZoom)
  const [frozen, setFrozen] = useState(false)
  const [showClaims, setShowClaims] = useState(true)
  const [showRanges, setShowRanges] = useState(true)
  const [drawLabels, setDrawLabels] = useState(false)
  const [containPref, setContainPref] = useState(false)
  const [editing, setEditing] = useState(false)
  const [border, setBorder] = useState<Point[]>([])
  const [hover, setHover] = useState<{ point: Point; zoom: number }>({
    point: { x: 0, z: 0 },
    zoom: -4,
  })
  const [jsonOpen, setJsonOpen] = useState(false)
  const [json, setJson] = useState('')
  const [toast, setToast] = useState<Toast>(null)

  const mapHandle = useRef<CivMapHandle>(null)
  const preset = PRESETS[presetKey]
  const closed = border.length >= 3
  /* Derived rather than synced: containment is meaningless without a closed
     polygon, and an effect that unset it would cascade a second render. The
     preference survives clearing the border. */
  const containWithinBorder = closed && containPref

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const selectPreset = (key: PresetKey) => {
    setPresetKey(key)
    setRangeMinZoom(PRESETS[key].rangeMinZoom)
  }

  const onMapClick = useCallback(
    (point: Point) => {
      if (editing) {
        setBorder((current) => [...current, point])
        return
      }
      if (frozen) return
      setCenter(point)
    },
    [editing, frozen],
  )

  /* The vertex under the pointer, with 8 px of slop converted to blocks at the
     zoom (CRS.Simple draws 2^zoom px per block). */
  const vertexAt = (point: Point, zoom: number) => nearestVertex(border, point, 8 / 2 ** zoom)

  const onMapRightClick = (point: Point) => {
    const index = vertexAt(point, hover.zoom)
    if (index >= 0) setBorder((current) => current.filter((_, i) => i !== index))
  }

  /* Pressing on a vertex in Edit Mode drags it; anywhere else the map pans. */
  const onMapGrab = (point: Point, zoom: number) => {
    const index = editing ? vertexAt(point, zoom) : -1
    if (index < 0) return undefined
    return (to: Point) => setBorder((current) => current.map((v, i) => (i === index ? to : v)))
  }

  const onMapMove = useCallback((point: Point, zoom: number) => {
    setHover({ point, zoom })
  }, [])

  const copySelection = async (mode: BorderMode) => {
    const points = selectWithinBorder({ center, preset, polygon: border, mode })
    if (points.length === 0) {
      setToast({
        message: 'No grid points match that criteria inside the border.',
        tone: 'error',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(formatCoordinateList(points))
      setToast({
        message: `Copied ${points.length} coordinates (${mode === 'strict' ? 'strictly inside' : 'centre inside'}).`,
        tone: 'ok',
      })
    } catch {
      setToast({ message: 'Clipboard unavailable: the browser blocked the copy.', tone: 'error' })
    }
  }

  const exportJson = async () => {
    if (!closed) {
      setToast({ message: 'Draw at least 3 border vertices first.', tone: 'error' })
      return
    }
    const ring = border.map((p) => [p.x, p.z])
    ring.push([border[0].x, border[0].z])
    const text = JSON.stringify(
      {
        name: 'Exported Configuration',
        color: '#e040fb',
        polygons: [{ geometryGeoJson: { type: 'Polygon', coordinates: [ring] }, sortOrder: 0 }],
      },
      null,
      2,
    )
    setJson(text)
    setJsonOpen(true)
    try {
      await navigator.clipboard.writeText(text)
      setToast({ message: 'Border exported and copied to the clipboard.', tone: 'ok' })
    } catch {
      setToast({ message: 'Border exported to the box below.', tone: 'ok' })
    }
  }

  const importJson = () => {
    const raw = json.trim()
    if (!raw) {
      setToast({ message: 'Paste a JSON border payload first.', tone: 'error' })
      return
    }
    let ring: unknown
    try {
      ring = findPolygonRing(JSON.parse(raw))
    } catch (error) {
      setToast({ message: `Could not parse that JSON: ${(error as Error).message}`, tone: 'error' })
      return
    }
    if (!Array.isArray(ring) || ring.length < 3) {
      setToast({ message: 'No polygon of 3 or more points found in that payload.', tone: 'error' })
      return
    }

    const points = (ring as [number, number][])
      .map(([x, z]) => ({ x: Number.parseFloat(String(x)), z: Number.parseFloat(String(z)) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z))

    /* GeoJSON rings repeat the first point to close; the planner does not. */
    const last = points.at(-1)
    if (points.length > 1 && last && last.x === points[0].x && last.z === points[0].z) points.pop()

    setBorder(points)
    setJsonOpen(false)
    if (points[0]) mapHandle.current?.panTo(points[0])
    setToast({ message: `Imported ${points.length} border vertices.`, tone: 'ok' })
  }

  return (
    <div className="flex flex-grow flex-col px-4 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-[98%] flex-grow flex-col sm:max-w-[95%]">
        <div className="relative mb-6 shrink-0 text-center">
          <div className="relative inline-block">
            <span className="absolute -top-[0.6rem] -left-8 z-2 -rotate-18 rounded bg-[#dc2626] px-[0.65rem] py-[0.35rem] text-[0.95rem] leading-none tracking-[0.04em] text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] sm:-top-[0.8rem] sm:-left-[2.7rem] sm:text-[1.1rem]">
              BETA
            </span>
            <div
              aria-hidden
              className="mb-2 bg-gradient-to-r from-orange via-purple to-cyan bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl"
            >
              Bastion &amp; Snitch Grid Planner
            </div>
          </div>
          <p className="text-sm text-ink-3 sm:text-base">
            Visualize coverages, draw or import selection borders, and export exact layout
            coordinates of all bastions.
          </p>
        </div>

        <div className="planner-layout flex flex-col gap-6 lg:flex-row">
          {/* ── Sidebar ── */}
          <div className="scrollable-panel flex w-full shrink-0 flex-col gap-5 lg:w-[420px] lg:gap-3">
            <section className={panel}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white lg:mb-2.5">
                <Settings aria-hidden className="size-5 text-purple" /> Grid Settings
              </h2>

              <fieldset className="mb-4 lg:mb-3">
                <legend className="mb-2 block text-xs font-semibold tracking-wider text-ink-3 uppercase">
                  Grid Option
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_KEYS.map((key) => {
                    const active = key === presetKey
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectPreset(key)}
                        aria-pressed={active}
                        className={`rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-all ${
                          active
                            ? 'border-purple bg-purple/30 text-white'
                            : 'border-purple/20 bg-purple-950/40 text-ink-2 hover:border-purple/50'
                        }`}
                      >
                        {PRESETS[key].label}
                        <br />
                        <span className={`text-[10px] ${active ? 'text-ink' : 'text-ink-2'}`}>
                          {PRESETS[key].size}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="mb-4 lg:mb-3">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-ink-3 uppercase">
                  Grid Center Point
                </span>
                <div className="flex gap-2">
                  {(['x', 'z'] as const).map((axis) => (
                    <div key={axis} className="relative flex-1">
                      <label
                        htmlFor={`center-${axis}`}
                        className="absolute top-2 left-2.5 text-xs font-bold text-ink-3"
                      >
                        {axis.toUpperCase()}
                      </label>
                      <input
                        id={`center-${axis}`}
                        type="number"
                        className={`${input} py-1.5 pr-2 pl-7 text-sm`}
                        value={Math.round(center[axis])}
                        onChange={(e) =>
                          setCenter((c) => ({
                            ...c,
                            [axis]: Number.parseInt(e.target.value, 10) || 0,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <span className="mt-1 block text-[10px] text-ink-3">
                  Left click on map to set Center unless Frozen or in Edit Mode.
                </span>
              </div>

              <div className="mb-4 lg:mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="range-zoom" className="text-xs text-ink-2">
                    Range Zoom Layer
                  </label>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-2">
                    {rangeMinZoom}
                  </span>
                </div>
                <input
                  id="range-zoom"
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={1}
                  value={rangeMinZoom}
                  onChange={(e) => setRangeMinZoom(Number.parseInt(e.target.value, 10))}
                  className="w-full accent-purple"
                />
                <span className="mt-1 block text-[10px] text-ink-3">
                  Default: {preset.rangeMinZoom}
                </span>
              </div>

              <div className="flex flex-col gap-3 border-t border-edge pt-4 lg:pt-3">
                <Toggle label="Freeze Grid Center" checked={frozen} onChange={setFrozen} />
                <Toggle label="Show Claims Overlay" checked={showClaims} onChange={setShowClaims} />
                <Toggle label="Show Grid Ranges" checked={showRanges} onChange={setShowRanges} />
                <Toggle label="Show Coords on Map" checked={drawLabels} onChange={setDrawLabels} />
                <Toggle
                  label="Contain Within Border"
                  checked={containWithinBorder}
                  onChange={setContainPref}
                  disabled={!closed}
                  hint={closed ? undefined : 'Draw a closed border first'}
                />
              </div>
            </section>

            {/* ── Selection border ── */}
            <section className={panel}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white lg:mb-2.5">
                <Crop aria-hidden className="size-5 text-green" /> Selection Border
              </h2>

              <div className="mb-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  <ToggleButton
                    pressed={editing}
                    onClick={() => setEditing((v) => !v)}
                    size="sm"
                    className="flex-1"
                  >
                    {editing ? (
                      <>
                        <Check aria-hidden className="size-3.5" /> Edit Mode Active
                      </>
                    ) : (
                      <>
                        <Edit2 aria-hidden className="size-3.5" /> Edit Border
                      </>
                    )}
                  </ToggleButton>
                  <button
                    type="button"
                    onClick={() => setBorder([])}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-950/40 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-500/50"
                  >
                    <Trash2 aria-hidden className="size-3.5" /> Clear Border
                  </button>
                </div>
                <span className="block text-[10px] text-ink-3">
                  Click Edit Border, then left click on the map to place vertices, drag one to move
                  it, and right click one to remove it. The shape will close automatically.
                </span>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-edge pt-4 lg:pt-3">
                <button
                  type="button"
                  onClick={() => copySelection('strict')}
                  disabled={!closed}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-purple-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clipboard aria-hidden className="size-3.5" /> Copy strictly inside
                </button>
                <button
                  type="button"
                  onClick={() => copySelection('center')}
                  disabled={!closed}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clipboard aria-hidden className="size-3.5" /> Copy with center inside
                </button>
                <BorderStats border={border} center={center} preset={preset} />
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-edge pt-4 lg:mt-3 lg:pt-3">
                <span className="mb-1 block text-xs font-semibold tracking-wider text-ink-3 uppercase">
                  JSON Border Import / Export
                </span>
                <a
                  href="https://civmap.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-purple hover:text-pink"
                >
                  <ExternalLink aria-hidden className="size-3" /> Get claim JSON configurations from
                  civmap.com
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJsonOpen((v) => !v)}
                    aria-expanded={jsonOpen}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-edge"
                  >
                    <Download aria-hidden className="size-3.5" /> Load from JSON
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-edge"
                  >
                    <Upload aria-hidden className="size-3.5" /> Save to JSON
                  </button>
                </div>

                {jsonOpen && (
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="sr-only" htmlFor="border-json">
                      Border JSON
                    </label>
                    <textarea
                      id="border-json"
                      rows={6}
                      value={json}
                      onChange={(e) => setJson(e.target.value)}
                      placeholder="Paste your civmap.com JSON border payload here..."
                      className={`${input} p-2 font-mono text-[11px]`}
                    />
                    <button
                      type="button"
                      onClick={importJson}
                      className="w-full rounded-lg bg-purple py-1.5 text-xs font-semibold text-white transition-colors hover:bg-pink"
                    >
                      Apply JSON Configuration
                    </button>
                  </div>
                )}

                {toast && (
                  <p
                    role="status"
                    className={`mt-1 text-[11px] ${toast.tone === 'ok' ? 'text-green' : 'text-orange'}`}
                  >
                    {toast.message}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ── Map ── */}
          <div className="relative flex-1">
            <MapFrame
              handleRef={mapHandle}
              resetTo={center}
              status={
                <>
                  <span className="font-bold">
                    X: {Math.round(hover.point.x)}, Z: {Math.round(hover.point.z)} (Zoom:{' '}
                    {hover.zoom})
                  </span>
                  <span
                    className={`mt-0.5 block text-[10px] ${editing ? 'text-green' : 'text-ink-3'}`}
                  >
                    {editing
                      ? 'Left click to add a border point, drag one to move it, right click one to remove it. Click the button again to exit Edit Mode.'
                      : 'Click to place Center. Hover to see blocks.'}
                  </span>
                </>
              }
            >
              <CivMap
                className="size-full bg-[#0b0b0f]"
                showClaims={showClaims}
                onClick={onMapClick}
                /* Only in Edit Mode; otherwise the browser's own menu is left alone. */
                onContextMenu={editing ? onMapRightClick : undefined}
                onGrab={onMapGrab}
                onMouseMove={onMapMove}
                onZoom={(zoom) => setHover((current) => ({ ...current, zoom }))}
                handleRef={mapHandle}
              >
                <GridOverlay
                  center={center}
                  preset={preset}
                  border={border}
                  showRanges={showRanges}
                  drawLabels={drawLabels}
                  containWithinBorder={containWithinBorder}
                  rangeMinZoom={rangeMinZoom}
                />
              </CivMap>
            </MapFrame>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-45' : ''}`}>
      <label htmlFor={`toggle-${label}`} className="text-xs text-ink-2">
        {label}
        {hint && <span className="sr-only">, {hint}</span>}
      </label>
      <Switch id={`toggle-${label}`} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

function BorderStats({
  border,
  center,
  preset,
}: {
  border: Point[]
  center: Point
  preset: (typeof PRESETS)[PresetKey]
}) {
  if (border.length === 0) {
    return (
      <span className="mt-1 block text-center text-[10px] text-ink-3 italic">
        No border polygon drawn yet.
      </span>
    )
  }

  if (border.length < 3) {
    return (
      <span className="mt-1 block text-center text-[10px]">
        <span className="font-medium text-gold">Border Points: {border.length}</span>
        <br />
        <span className="text-ink-3">Need at least 3 points to form closed polygon.</span>
      </span>
    )
  }

  const strict = selectWithinBorder({ center, preset, polygon: border, mode: 'strict' }).length
  const centre = selectWithinBorder({ center, preset, polygon: border, mode: 'center' }).length

  return (
    <span className="mt-1 block text-center text-[10px]">
      <span className="font-bold text-green">Closed Polygon Active</span>
      <br />
      <span className="text-ink-2">Border Points: {border.length} vertices</span>
      <br />
      <span className="text-ink">
        {strict} strictly inside, {centre} with center inside
      </span>
    </span>
  )
}

/** civmap.com wraps its polygons a few different ways; accept all of them. */
function findPolygonRing(parsed: unknown): unknown {
  const value = parsed as Record<string, never>
  const polygons = value?.polygons as unknown as { geometryGeoJson?: { coordinates?: unknown[] } }[]
  if (Array.isArray(polygons) && polygons.length > 0) {
    const ring = polygons[0]?.geometryGeoJson?.coordinates
    if (Array.isArray(ring)) return ring[0]
  }

  const geo = value?.geometryGeoJson as unknown as { coordinates?: unknown[] } | undefined
  if (Array.isArray(geo?.coordinates)) return geo.coordinates[0]

  if (value?.type === 'Polygon' && Array.isArray(value?.coordinates)) {
    return (value.coordinates as unknown[])[0]
  }

  return null
}

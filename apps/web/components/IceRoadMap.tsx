'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  eachBlock,
  layerLength,
  type Coords,
  type IceLayer,
  type IceMarker,
  type IceSection,
} from '@nara/lib'
import {
  CanvasLayer,
  CivMap,
  MapFrame,
  MarkerLayer,
  MIN_ZOOM,
  type CivMapHandle,
  type DrawArgs,
} from '@/components/map'
import { markerIcon, markerLabel } from './iceRoadMarkers'

/**
 * The ice road map: CivMap tiles with every visible road painted through CanvasLayer,
 * a hover card naming the network under the pointer, and right-click to copy coordinates.
 * Layers arrive with their colour already resolved.
 */

type Point = [number, number]
/* ends: the hovered section's two ends, east end first (north end first if level). */
type Hit = { layer: IceLayer; ends: [Point, Point]; x: number; y: number }

/* East before west; for a north-south section, north (smaller Z) before south. */
const eastFirst = (a: Point, b: Point): [Point, Point] =>
  a[0] > b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a]
type Box = { minX: number; maxX: number; minZ: number; maxZ: number }

const HIT_PX = 8

/* A marker's pin: just its icon, centred on the block, with a shadow to stand out from the
   tiles. Rendered by React so a name from someone else's file is escaped, not markup. Fixed
   at 24px, with the icon centred: Leaflet makes marker images width: auto, so a narrow one
   (the portal) would sit left of its anchor. */
const pin = (m: IceMarker) => ({
  html: renderToStaticMarkup(
    <div
      title={markerLabel(m)}
      className="grid size-6 place-items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
    >
      {markerIcon(m)}
    </div>,
  ),
  anchor: [12, 12] as [number, number],
})
/* Empty map: the whole world, filling the frame. */
const START = { x: 0, z: 0 }
const START_ZOOM = -4

const bounds = (points: [number, number][]): Box => {
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (const [x, z] of points) {
    box.minX = Math.min(box.minX, x)
    box.maxX = Math.max(box.maxX, x)
    box.minZ = Math.min(box.minZ, z)
    box.maxZ = Math.max(box.maxZ, z)
  }
  return box
}

/* Roads are drawn this many blocks wide once a block is at least a pixel. */
const ROAD_BLOCKS = 3
/* Zoomed out, roads are lines this wide: ROAD_BLOCKS at zoom 0, so the switch is seamless. */
const LINE_PX = ROAD_BLOCKS
const OUTLINE = 'rgba(0,0,0,0.6)'

/* Every block a path covers, ROAD_BLOCKS wide, as flat [x, z, x, z, ...]. Cached per path.
   Blocks repeat where segments meet; harmless, since a layer is filled as one shape. */
const cellCache = new WeakMap<[number, number][], number[]>()
const cellsOf = (path: [number, number][]) => {
  let cells = cellCache.get(path)
  if (cells) return cells
  const r = (ROAD_BLOCKS - 1) / 2
  cells = []
  eachBlock(path, (x, z) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) cells!.push(x + dx, z + dz)
  })
  cellCache.set(path, cells)
  return cells
}

/* Distance from (px, pz) to the segment a-b. */
const segmentDistance = (px: number, pz: number, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const t = len2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz))
}

export default function IceRoadMap({
  layers,
  showClaims,
  selected = null,
  onPick,
  focus,
  onEditMarker,
  onPlace,
}: {
  layers: IceLayer[]
  showClaims: boolean
  /** The section drawn highlighted. */
  selected?: IceSection | null
  /** When set, clicking a road picks the section under the pointer. */
  onPick?: (section: IceSection) => void
  /** The map moves here whenever this changes (a new object each time). */
  focus?: Coords | null
  /** When set, a marker's popup has an Edit button that calls this. */
  onEditMarker?: (groupId: string, marker: IceMarker) => void
  /** When set, a click on the map is a spot for a marker, not a road pick. */
  onPlace?: (point: Coords) => void
}) {
  const handle = useRef<CivMapHandle>(null)
  const zoomRef = useRef(START_ZOOM)
  /* Centred on it, zoomed in far enough to see the road around it. */
  useEffect(() => {
    if (focus)
      handle.current?.setView({ x: focus.x + 0.5, z: focus.z + 0.5 }, Math.max(zoomRef.current, 0))
  }, [focus])
  const box = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<Coords>({ x: 0, z: 0 })
  const [hover, setHover] = useState<(Hit & { flipX: boolean; flipY: boolean }) | null>(null)
  const [copied, setCopied] = useState<{ x: number; y: number } | null>(null)
  /* Last pointer position inside the frame; Leaflet's mousemove gives world coordinates only. */
  const pointerAt = useRef({ x: 0, y: 0 })

  const markers = useMemo(
    () => layers.flatMap((group) => (group.markers ?? []).map((marker) => ({ marker, group }))),
    [layers],
  )
  const boxes = useMemo(() => layers.map((l) => l.paths.map(bounds)), [layers])
  const all = useMemo(() => boxes.flat(), [boxes])

  /* Fit when roads first appear (initial load, first import, after Clear). */
  const hasRoads = all.length > 0
  const allRef = useRef(all)
  useEffect(() => {
    allRef.current = all
  })
  useEffect(() => {
    if (!hasRoads) return
    const b = allRef.current.reduce((a, c) => ({
      minX: Math.min(a.minX, c.minX),
      maxX: Math.max(a.maxX, c.maxX),
      minZ: Math.min(a.minZ, c.minZ),
      maxZ: Math.max(a.maxZ, c.maxZ),
    }))
    /* Largest whole zoom (capped at -1) where the roads plus 15% fit both ways. */
    const w = (box.current?.clientWidth ?? 800) * 0.85
    const h = (box.current?.clientHeight ?? 600) * 0.85
    const span = Math.max((b.maxX - b.minX) / w, (b.maxZ - b.minZ) / h, 1e-9)
    const zoom = Math.max(MIN_ZOOM, Math.min(-1, Math.floor(-Math.log2(span))))
    handle.current?.setView({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }, zoom)
  }, [hasRoads])

  const draw = useCallback(
    ({ ctx, width, height, zoom, project }: DrawArgs) => {
      /* Zoomed in, roads are whole blocks; zoomed out a block is under a pixel, so lines.
         Both get the same 1px outline and square ends, and at zoom 0 both are 3px wide,
         so only the width changes as you zoom. */
      const asBlocks = zoom >= 0
      const scale = 2 ** zoom
      const pad = asBlocks ? ROAD_BLOCKS * scale : LINE_PX + 2
      const origin = project(0, 0)
      const onScreen = (b: Box) => {
        const a = project(b.minX, b.minZ)
        const c = project(b.maxX, b.maxZ)
        return (
          Math.max(a.x, c.x) >= -pad &&
          Math.min(a.x, c.x) <= width + pad &&
          Math.max(a.y, c.y) >= -pad &&
          Math.min(a.y, c.y) <= height + pad
        )
      }
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
      /* A set of paths as one shape: all its outline, then all its colour, so paths that
         meet have no dark seam between them. */
      const paint = (visible: [number, number][][], color: string) => {
        if (asBlocks) {
          for (const [grow, style] of [
            [1, OUTLINE],
            [0, color],
          ] as const) {
            ctx.beginPath()
            for (const path of visible) {
              const cells = cellsOf(path)
              for (let i = 0; i < cells.length; i += 2)
                ctx.rect(
                  origin.x + cells[i] * scale - grow,
                  origin.y + cells[i + 1] * scale - grow,
                  scale + grow * 2,
                  scale + grow * 2,
                )
            }
            ctx.fillStyle = style
            ctx.fill()
          }
          return
        }
        ctx.beginPath()
        for (const path of visible)
          path.forEach(([x, z], i) => {
            /* Through the middle of each block, snapped to a pixel centre so the 3px line
               covers 3 whole pixels instead of blurring across 4. */
            const p = project(x + 0.5, z + 0.5)
            const [px, py] = [Math.floor(p.x) + 0.5, Math.floor(p.y) + 0.5]
            if (i) ctx.lineTo(px, py)
            else ctx.moveTo(px, py)
          })
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = LINE_PX + 2
        ctx.stroke()
        ctx.strokeStyle = color
        ctx.lineWidth = LINE_PX
        ctx.stroke()
      }
      layers.forEach((layer, li) => {
        const visible = layer.paths.filter((_, ri) => onScreen(boxes[li][ri]))
        if (visible.length) paint(visible, layer.color ?? '#38bdf8')
      })
      /* The picked section, in white on top. */
      const path = selected && layers.find((l) => l.id === selected.id)?.paths[selected.path]
      if (path?.[selected!.segment + 1])
        paint([[path[selected!.segment], path[selected!.segment + 1]]], '#ffffff')
    },
    [layers, boxes, selected],
  )

  const localPoint = (clientX: number, clientY: number) => {
    const rect = box.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY }
  }

  /* The section nearest the pointer, within HIT_PX, and its layer. On a tie (groups sharing
     road) the later group wins: it is drawn on top, so it is the one you see. */
  const hitAt = (point: Coords, zoom: number) => {
    const reach = HIT_PX / 2 ** zoom
    let best: { layer: IceLayer; section: IceSection; d: number } | null = null
    layers.forEach((layer, li) =>
      layer.paths.forEach((path, ri) => {
        const b = boxes[li][ri]
        if (
          point.x < b.minX - reach ||
          point.x > b.maxX + reach ||
          point.z < b.minZ - reach ||
          point.z > b.maxZ + reach
        )
          return
        for (let i = 1; i < path.length; i++) {
          const d = segmentDistance(point.x, point.z, path[i - 1], path[i])
          if (d <= reach && (!best || d <= best.d))
            best = { layer, section: { id: layer.id, path: ri, segment: i - 1 }, d }
        }
      }),
    )
    return best as { layer: IceLayer; section: IceSection } | null
  }

  return (
    <div
      ref={box}
      className="iceroads-view relative size-full [--popup-accent:56_189_248]"
      onPointerMove={(e) => (pointerAt.current = localPoint(e.clientX, e.clientY))}
      onPointerLeave={() => setHover(null)}
    >
      <MapFrame
        handleRef={handle}
        resetTo={START}
        resetZoom={START_ZOOM}
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
          initialCenter={START}
          initialZoom={START_ZOOM}
          showClaims={showClaims}
          onMouseMove={(point, zoom) => {
            zoomRef.current = zoom
            setCursor(point)
            const hit = hitAt(point, zoom)
            const path = hit?.layer.paths[hit.section.path]
            const { x, y } = pointerAt.current
            const frame = box.current
            setHover(
              hit && path
                ? {
                    layer: hit.layer,
                    ends: eastFirst(path[hit.section.segment], path[hit.section.segment + 1]),
                    x,
                    y,
                    flipX: !!frame && x > frame.clientWidth - 300,
                    flipY: !!frame && y > frame.clientHeight - 120,
                  }
                : null,
            )
          }}
          onClick={(point) => {
            if (onPlace) return onPlace(point)
            const hit = onPick && hitAt(point, zoomRef.current)
            if (hit) onPick!(hit.section)
          }}
          onContextMenu={(point, event) => {
            /* async, so a missing clipboard (plain http) rejects like a denied one. */
            const write = async () => navigator.clipboard.writeText(`${point.x}, ${point.z}`)
            write().then(
              () => {
                setCopied(localPoint(event.clientX, event.clientY))
                setTimeout(() => setCopied(null), 800)
              },
              (e) => console.warn('[nara] Copying to the clipboard failed.', e),
            )
          }}
          handleRef={handle}
        >
          <CanvasLayer draw={draw} />
          <MarkerLayer
            items={markers}
            position={({ marker }) => ({ x: marker.x + 0.5, z: marker.z + 0.5 })}
            icon={({ marker }) => pin(marker)}
            panToOnClick={false}
            popup={({ marker: m, group }) => (
              <div className="flex min-w-[150px] flex-col gap-1 p-3 pr-10 text-xs">
                <span className="font-semibold text-white">{markerLabel(m)}</span>
                <span className="flex items-center gap-2 text-ink-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: group.color }}
                  />
                  {group.name}
                </span>
                <span className="font-mono text-white">
                  {m.x}, {m.z}
                </span>
                {onEditMarker && (
                  <button
                    type="button"
                    onClick={() => onEditMarker(group.id, m)}
                    className="mt-1 rounded border border-[#6b7280] bg-surface-2 px-2 py-0.5 font-medium text-ink hover:border-primary hover:text-white"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          />
        </CivMap>

        {hover && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-[1000] max-w-[280px] min-w-[150px] rounded-lg border border-[#374151] bg-[rgba(17,24,39,0.95)] p-3 text-xs"
            style={{
              left: hover.x + 15,
              top: hover.y + 15,
              transform: `translate(${hover.flipX ? 'calc(-100% - 30px)' : '0'}, ${hover.flipY ? 'calc(-100% - 30px)' : '0'})`,
            }}
          >
            <div className="flex items-center gap-2 font-semibold text-white">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: hover.layer.color }}
              />
              {hover.layer.name}
            </div>
            <div className="mt-1 font-mono text-white">
              {hover.ends[0].join(', ')} → {hover.ends[1].join(', ')}
            </div>
            <div className="mt-1 text-ink-3">
              {Math.round(
                Math.hypot(
                  hover.ends[0][0] - hover.ends[1][0],
                  hover.ends[0][1] - hover.ends[1][1],
                ),
              ).toLocaleString()}{' '}
              blocks · {Math.round(layerLength(hover.layer)).toLocaleString()} in this group
            </div>
            {onPick && <div className="mt-1 text-primary">Click to select this section</div>}
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
      </MapFrame>
    </div>
  )
}

'use client'

import L from 'leaflet'
import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { worldToLatLng, latLngToWorld, type Coords } from '@nara/lib'

/**
 * The CivMC world map: tile pyramid, optional claims overlay, and a context so
 * layers can compose on top.
 *
 * Leaflet touches `window` when its module is evaluated, so this cannot be
 * server-rendered. Consumers must reach it through
 * `next/dynamic(..., { ssr: false })` — see apps/web/components/Planner.tsx.
 * Remember to import 'leaflet/dist/leaflet.css' somewhere too.
 */

const TILE_URL = 'https://civmap.nara.rocks/{z}/{x},{y}.png'
const CLAIMS_IMAGE_URL = 'https://civmc-map.github.io/CivMCMap44Transparent.png'

/** The claims PNG covers this square of the world. */
const CLAIMS_EXTENT = 10832
/** Hand-tuned nudge that lines the claims PNG up with the tiles. */
const CLAIMS_ALIGNMENT_OFFSET = { x: 12, z: 10 }
const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-25600, -25600],
  [25600, 25600],
]

export const MIN_ZOOM = -6
export const MAX_ZOOM = 2

const MapContext = createContext<L.Map | null>(null)

/** Available to any layer rendered inside <CivMap>. Null until the map mounts. */
export function useCivMap(): L.Map | null {
  return useContext(MapContext)
}

export type CivMapHandle = {
  zoomIn(): void
  zoomOut(): void
  panTo(point: Coords): void
  setView(point: Coords, zoom?: number): void
  invalidateSize(): void
}

export function CivMap({
  initialCenter = { x: 120, z: 350 },
  initialZoom = -4,
  minZoom = MIN_ZOOM,
  showClaims = true,
  onClick,
  onMouseMove,
  onZoom,
  onContextMenu,
  handleRef,
  className,
  children,
}: {
  initialCenter?: Coords
  initialZoom?: number
  /** Clamps how far out the map pans. Tiles always go to MIN_ZOOM regardless —
   *  /homes stops the user at -3 while still rendering the -6 pyramid. */
  minZoom?: number
  showClaims?: boolean
  /** World coordinates of a left click, already rounded. */
  onClick?: (point: Coords) => void
  onMouseMove?: (point: Coords, zoom: number) => void
  /** Fires after every zoom settles. /shops re-clusters on it, because its
   *  cluster radius is a function of the zoom level. */
  onZoom?: (zoom: number) => void
  /** A right click, in rounded world coordinates, with the DOM event for its screen position. */
  onContextMenu?: (point: Coords, event: MouseEvent) => void
  handleRef?: RefObject<CivMapHandle | null>
  className?: string
  children?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const claimsRef = useRef<L.ImageOverlay | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)

  /* Handlers live in a ref so changing them never tears down the map. */
  const handlers = useRef({ onClick, onMouseMove, onZoom, onContextMenu })
  useLayoutEffect(() => {
    handlers.current = { onClick, onMouseMove, onZoom, onContextMenu }
  })

  useEffect(() => {
    if (!container.current || mapRef.current) return

    const instance = L.map(container.current, {
      crs: L.CRS.Simple,
      minZoom,
      maxZoom: MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    })

    L.tileLayer(TILE_URL, {
      tileSize: 256,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxNativeZoom: 0,
      noWrap: true,
      bounds: WORLD_BOUNDS,
    }).addTo(instance)

    claimsRef.current = L.imageOverlay(
      CLAIMS_IMAGE_URL,
      [
        [-CLAIMS_EXTENT, -CLAIMS_EXTENT],
        [CLAIMS_EXTENT, CLAIMS_EXTENT],
      ],
      { opacity: 0.85, interactive: false },
    )

    /* The claims PNG is a fraction of a block out; nudge it by a scaled
       margin on every view change. */
    const alignClaims = () => {
      const element = claimsRef.current?.getElement()
      if (!element) return
      const scale = instance.options.crs!.scale(instance.getZoom())
      element.style.marginLeft = `${CLAIMS_ALIGNMENT_OFFSET.x * scale}px`
      element.style.marginTop = `${CLAIMS_ALIGNMENT_OFFSET.z * scale}px`
    }

    instance.setView(worldToLatLng(initialCenter.x, initialCenter.z), initialZoom)

    instance.on('click', (event: L.LeafletMouseEvent) => {
      const point = latLngToWorld(event.latlng.lat, event.latlng.lng)
      handlers.current.onClick?.({ x: Math.round(point.x), z: Math.round(point.z) })
    })
    instance.on('mousemove', (event: L.LeafletMouseEvent) => {
      const point = latLngToWorld(event.latlng.lat, event.latlng.lng)
      handlers.current.onMouseMove?.(point, instance.getZoom())
    })
    instance.on('zoomend', () => handlers.current.onZoom?.(instance.getZoom()))
    instance.on('contextmenu', (event: L.LeafletMouseEvent) => {
      if (!handlers.current.onContextMenu) return
      event.originalEvent.preventDefault()
      const point = latLngToWorld(event.latlng.lat, event.latlng.lng)
      handlers.current.onContextMenu(
        { x: Math.round(point.x), z: Math.round(point.z) },
        event.originalEvent,
      )
    })
    instance.on('move zoom zoomend moveend resize', alignClaims)

    mapRef.current = instance
    setMap(instance)
    alignClaims()

    return () => {
      instance.remove()
      mapRef.current = null
      claimsRef.current = null
      setMap(null)
    }
    // Initial view is a mount-time concern; later changes go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map || !claimsRef.current) return
    if (showClaims) claimsRef.current.addTo(map)
    else claimsRef.current.remove()
  }, [map, showClaims])

  useImperativeHandle(
    handleRef,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      panTo: (point) => mapRef.current?.panTo(worldToLatLng(point.x, point.z)),
      setView: (point, zoom) =>
        mapRef.current?.setView(worldToLatLng(point.x, point.z), zoom ?? mapRef.current.getZoom()),
      invalidateSize: () => mapRef.current?.invalidateSize(),
    }),
    [],
  )

  return (
    <div ref={container} className={className}>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  )
}

'use client'

import L from 'leaflet'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCivMap } from './CivMap'
import type { Point } from './grid'

/**
 * Pins with React popups.
 *
 * `/homes` and `/shops` both build `L.divIcon` markers with a popup card, and
 * both did it by assembling several hundred characters of HTML in a template
 * literal — which is how `/homes` ended up with `onclick="navigateToDetail(...)"`
 * strings and a `<>` fragment pasted into markup where it renders literally.
 *
 * The icon stays an HTML string, because that is what Leaflet's divIcon takes
 * and a price chip is a span and a number. The popup is a React node rendered
 * through a portal, so links, handlers and types all work normally.
 *
 * Only the open popup is mounted; there is no point rendering hundreds of
 * cards nobody is looking at.
 */

export type MarkerIcon = {
  html: string
  className?: string
  /** Pixel offset from the marker's anchor point to the icon's top-left. */
  anchor?: [number, number]
}

export function MarkerLayer<T>({
  items,
  position,
  icon,
  popup,
  onSelect,
  openItem,
  panToOnClick = true,
}: {
  items: T[]
  position: (item: T) => Point
  icon: (item: T) => MarkerIcon
  popup?: (item: T) => ReactNode
  onSelect?: (item: T) => void
  /** Opens this item's popup from outside — /shops' sidebar drives the map
   *  this way. Re-applied whenever `items` changes, so a popup opened by a
   *  sidebar click survives the re-cluster that follows a zoom. */
  openItem?: T | null
  /** Clicking a pin centres it. */
  panToOnClick?: boolean
}) {
  const map = useCivMap()
  const [open, setOpen] = useState<{ item: T; container: HTMLElement } | null>(null)
  const markersRef = useRef(new Map<T, L.Marker>())

  /* Callbacks in a ref so re-rendering them does not rebuild every marker. */
  const cbs = useRef({ position, icon, popup, onSelect })
  useLayoutEffect(() => {
    cbs.current = { position, icon, popup, onSelect }
  })

  useEffect(() => {
    if (!map) return

    markersRef.current = new Map()
    const markers = items.map((item) => {
      const point = cbs.current.position(item)
      const spec = cbs.current.icon(item)
      const marker = L.marker([-point.z, point.x], {
        icon: L.divIcon({
          html: spec.html,
          className: spec.className ?? '',
          // null lets the div size itself to its content
          iconSize: undefined,
          iconAnchor: spec.anchor,
        }),
      }).addTo(map)

      if (cbs.current.popup) {
        /* Bound empty and filled by the portal below; Leaflet needs an element
           at bind time so it has something to measure. */
        const container = L.DomUtil.create('div')
        marker.bindPopup(container, { closeButton: true, offset: [0, -5] })
        marker.on('popupopen', () => setOpen({ item, container }))
        marker.on('popupclose', () => setOpen(null))
      }

      marker.on('click', () => {
        if (panToOnClick) map.panTo([-point.z, point.x])
        cbs.current.onSelect?.(item)
      })

      markersRef.current.set(item, marker)
      return marker
    })

    return () => {
      setOpen(null)
      for (const marker of markers) marker.remove()
    }
  }, [map, items, panToOnClick])

  useEffect(() => {
    if (openItem) markersRef.current.get(openItem)?.openPopup()
  }, [items, openItem])

  /* A popup sizes itself before its images load, so it clips them. Re-measure
     once they have. */
  useEffect(() => {
    if (!open || !map) return
    const popupInstance = map.getPane('popupPane')?.querySelector('.leaflet-popup')
    if (!popupInstance) return
    const images = open.container.querySelectorAll('img')
    const update = () =>
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.isPopupOpen()) layer.getPopup()?.update()
      })
    images.forEach((img) => img.addEventListener('load', update))
    update()
    return () => images.forEach((img) => img.removeEventListener('load', update))
  }, [open, map])

  if (!open || !popup) return null
  return createPortal(popup(open.item), open.container)
}

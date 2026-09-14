'use client'

import L from 'leaflet'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useCivMap } from './CivMap'
import type { Bounds } from './grid'

/**
 * A full-viewport canvas pinned over the map, redrawn on every view change.
 *
 * It owns the canvas, its sizing and the repaint triggers, and hands the caller
 * a drawing context plus the world-to-screen helpers. What gets painted is
 * entirely the `draw` callback's business — the planner grid and the snitch
 * point cloud.
 */

export type DrawArgs = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  zoom: number
  /** World coordinates to container pixels. */
  project: (x: number, z: number) => { x: number; y: number }
  /** Visible world rectangle, optionally grown on every side. */
  worldBounds: (padding?: number) => Bounds
  /** Leaflet's scale factor between the current zoom and `to`. */
  zoomScale: (to: number) => number
}

export function CanvasLayer({
  draw,
  className,
}: {
  draw: (args: DrawArgs) => void
  className?: string
}) {
  const map = useCivMap()
  /* Both in refs so new props repaint without re-adding the layer. */
  const drawRef = useRef(draw)
  useLayoutEffect(() => {
    drawRef.current = draw
  })
  const repaintRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!map) return

    const canvas = L.DomUtil.create('canvas', className ?? '')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    const ctx = canvas.getContext('2d')
    map.getPanes().overlayPane.appendChild(canvas)

    const repaint = () => {
      if (!ctx) return
      const size = map.getSize()
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]))
      canvas.width = size.x
      canvas.height = size.y
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`

      ctx.clearRect(0, 0, size.x, size.y)
      drawRef.current({
        ctx,
        width: size.x,
        height: size.y,
        zoom: map.getZoom(),
        project: (x, z) => {
          const p = map.latLngToContainerPoint([-z, x])
          return { x: p.x, y: p.y }
        },
        worldBounds: (padding = 0) => {
          const b = map.getBounds()
          return {
            minX: b.getWest() - padding,
            maxX: b.getEast() + padding,
            minZ: -b.getNorth() - padding,
            maxZ: -b.getSouth() + padding,
          }
        },
        zoomScale: (to) => map.getZoomScale(map.getZoom(), to),
      })
    }

    repaintRef.current = repaint
    map.on('move zoom resize zoomend moveend', repaint)
    repaint()

    return () => {
      map.off('move zoom resize zoomend moveend', repaint)
      canvas.remove()
      repaintRef.current = () => {}
    }
  }, [map, className])

  /* Repaint when the caller's draw changes — new preset, moved centre, edited
     border — without touching the layer itself. */
  useEffect(() => {
    repaintRef.current()
  }, [draw])

  return null
}

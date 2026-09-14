'use client'

import { useCallback } from 'react'
import { CanvasLayer, type DrawArgs } from './CanvasLayer'
import {
  MAX_GRID_POINTS,
  generateGridPoints,
  isPointInPolygon,
  type Point,
  type Preset,
} from './grid'

/**
 * Draws the planner's grid and selection border. The geometry lives in grid.ts
 * and the state arrives as props.
 */
export function GridOverlay({
  center,
  preset,
  border,
  showRanges,
  drawLabels,
  containWithinBorder,
  rangeMinZoom,
}: {
  center: Point
  preset: Preset
  border: Point[]
  showRanges: boolean
  drawLabels: boolean
  containWithinBorder: boolean
  rangeMinZoom: number
}) {
  const draw = useCallback(
    ({ ctx, zoom, project, worldBounds, zoomScale }: DrawArgs) => {
      drawBorder(ctx, border, project)

      const radius = preset.radius
      const bounds = worldBounds(radius + 2)
      let points = generateGridPoints({ center, preset, bounds })
      if (containWithinBorder && border.length >= 3) {
        points = points.filter((p) => isPointInPolygon(p, border))
      }

      drawCenterMarker(ctx, center, project)

      if (points.length > MAX_GRID_POINTS) {
        drawOverflowNotice(ctx, points.length)
        return
      }

      const canDrawRanges = showRanges && zoom >= rangeMinZoom

      for (const point of points) {
        if (canDrawRanges) {
          if (preset.shape === 'circle') {
            drawBlockCircle(ctx, point, radius, preset, project, zoomScale)
          } else {
            drawBlockRect(ctx, point, radius, preset, project)
          }
        }

        drawPointMarker(ctx, point, preset.stroke, project)

        const isCenter = point.x === center.x && point.z === center.z
        if ((drawLabels || isCenter) && zoom >= -3) drawLabel(ctx, point, project)
      }
    },
    [center, preset, border, showRanges, drawLabels, containWithinBorder, rangeMinZoom],
  )

  return <CanvasLayer draw={draw} className="planner-overlay-canvas" />
}

type Project = DrawArgs['project']

/** A block's coverage is inclusive of its far edge, hence the +1. */
function drawBlockRect(
  ctx: CanvasRenderingContext2D,
  { x, z }: Point,
  radius: number,
  preset: Preset,
  project: Project,
) {
  const topLeft = project(x - radius, z - radius)
  const bottomRight = project(x + radius + 1, z + radius + 1)
  const w = bottomRight.x - topLeft.x
  const h = bottomRight.y - topLeft.y

  ctx.fillStyle = preset.fill
  ctx.fillRect(topLeft.x, topLeft.y, w, h)
  ctx.strokeStyle = preset.stroke
  ctx.lineWidth = 1.5
  ctx.strokeRect(topLeft.x, topLeft.y, w, h)
}

/**
 * A Minecraft circle, drawn row by row rather than as an arc — the game fills
 * whole blocks, so a smooth ellipse would misrepresent the coverage by up to a
 * block on every edge.
 */
function drawBlockCircle(
  ctx: CanvasRenderingContext2D,
  { x, z }: Point,
  radius: number,
  preset: Preset,
  project: Project,
  zoomScale: DrawArgs['zoomScale'],
) {
  const r2 = radius * radius
  ctx.fillStyle = preset.fill
  ctx.strokeStyle = preset.stroke
  ctx.lineWidth = Math.max(1, zoomScale(0) * 0.7)

  for (let dz = -radius + 1; dz < radius; dz++) {
    const target = r2 - dz * dz
    if (target <= 0) continue
    const maxDx = Math.floor(Math.sqrt(target - 0.0001))
    const topLeft = project(x - maxDx, z + dz)
    const bottomRight = project(x + maxDx + 1, z + dz + 1)
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
  }

  /* Outline: the left and right end block of each row. */
  ctx.beginPath()
  for (let dz = -radius + 1; dz < radius; dz++) {
    const target = r2 - dz * dz
    if (target <= 0) continue
    const maxDx = Math.floor(Math.sqrt(target - 0.0001))
    const leftTop = project(x - maxDx, z + dz)
    const leftBottom = project(x - maxDx + 1, z + dz + 1)
    const rightTop = project(x + maxDx, z + dz)
    const rightBottom = project(x + maxDx + 1, z + dz + 1)
    ctx.rect(leftTop.x, leftTop.y, leftBottom.x - leftTop.x, leftBottom.y - leftTop.y)
    ctx.rect(rightTop.x, rightTop.y, rightBottom.x - rightTop.x, rightBottom.y - rightTop.y)
  }
  ctx.stroke()
}

function drawPointMarker(
  ctx: CanvasRenderingContext2D,
  { x, z }: Point,
  color: string,
  project: Project,
) {
  const p = project(x, z)
  ctx.beginPath()
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawCenterMarker(ctx: CanvasRenderingContext2D, center: Point, project: Project) {
  const p = project(center.x, center.z)

  ctx.save()
  ctx.shadowBlur = 8
  ctx.shadowColor = '#e040fb'
  ctx.beginPath()
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#e040fb'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = 'rgba(224, 64, 251, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(p.x - 20, p.y)
  ctx.lineTo(p.x + 20, p.y)
  ctx.moveTo(p.x, p.y - 20)
  ctx.lineTo(p.x, p.y + 20)
  ctx.stroke()
}

function drawLabel(ctx: CanvasRenderingContext2D, { x, z }: Point, project: Project) {
  const p = project(x, z)
  const text = `${Math.round(x)}, ${Math.round(z)}`

  ctx.font = 'bold 10px monospace'
  const width = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.fillRect(p.x - width / 2 - 4, p.y - 18, width + 8, 14)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(p.x - width / 2 - 4, p.y - 18, width + 8, 14)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(text, p.x, p.y - 8)
  ctx.textAlign = 'start'
}

function drawBorder(ctx: CanvasRenderingContext2D, border: Point[], project: Project) {
  if (border.length === 0) return

  ctx.beginPath()
  const first = project(border[0].x, border[0].z)
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < border.length; i++) {
    const next = project(border[i].x, border[i].z)
    ctx.lineTo(next.x, next.y)
  }
  if (border.length > 2) ctx.closePath()

  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'
  ctx.fill()
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 2.5
  ctx.setLineDash([6, 6])
  ctx.stroke()
  ctx.setLineDash([])

  for (const vertex of border) {
    const p = project(vertex.x, vertex.z)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#15803d'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawOverflowNotice(ctx: CanvasRenderingContext2D, count: number) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
  ctx.fillRect(10, 10, 290, 38)
  ctx.strokeStyle = 'rgba(224, 64, 251, 0.5)'
  ctx.strokeRect(10, 10, 290, 38)
  ctx.fillStyle = '#ffffff'
  ctx.font = '11px sans-serif'
  ctx.fillText(`Zoom in to render ${count.toLocaleString()} grid zones.`, 20, 34)
}

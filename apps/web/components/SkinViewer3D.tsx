'use client'

import { useEffect, useRef } from 'react'

/**
 * A walking 3D player model. skinview3d (MIT) is imported on first use, in its
 * own chunk. Tries the skin by UUID, then by name — a name is only as current
 * as the cache that produced it.
 */

export function SkinViewer3D({ name, uuid }: { name: string; uuid: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let viewer: import('skinview3d').SkinViewer | null = null
    let cancelled = false
    import('skinview3d')
      .then((lib) => {
        if (cancelled || !canvas.current) return
        viewer = new lib.SkinViewer({ canvas: canvas.current, width: 250, height: 350 })
        viewer.controls.enableZoom = true
        viewer.controls.enableRotate = true
        const walk = new lib.WalkingAnimation()
        walk.speed = 0.5
        viewer.animation = walk

        const byName = `https://mc-heads.net/skin/${encodeURIComponent(name)}`
        const v = viewer
        ;(uuid ? v.loadSkin(`https://mc-heads.net/skin/${uuid}`) : Promise.reject())
          .catch(() => v.loadSkin(byName))
          .catch(() => {})
      })
      .catch(console.warn)
    return () => {
      cancelled = true
      viewer?.dispose()
    }
  }, [name, uuid])

  return (
    <canvas
      ref={canvas}
      width={250}
      height={350}
      role="img"
      aria-label={`${name}'s Minecraft skin, rotatable`}
      className="rounded-lg"
    />
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { RotateCw, X } from 'lucide-react'
import type { Head } from '@nara/lib'

/**
 * A rotatable 3D head in a <dialog>.
 *
 * headview3d (MIT, a head-only fork of skinview3d) is imported on first open,
 * so three.js lands in its own chunk and never weighs on the page itself.
 */

type Viewer = import('headview3d').SkinViewer

export function HeadPreview({ head, onClose }: { head: Head | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<Viewer | null>(null)

  useEffect(() => {
    if (!head) return
    dialog.current?.showModal()

    let viewer: Viewer | null = null
    let cancelled = false
    import('headview3d')
      .then((headview) => {
        if (cancelled || !canvas.current) return
        viewer = new headview.SkinViewer({
          canvas: canvas.current,
          width: 250,
          height: 250,
        })
        viewerRef.current = viewer
        if (head.skinUrl) viewer.loadSkin(head.skinUrl).catch(console.warn)
        Object.assign(viewer, { zoom: 1, animation: null, autoRotate: true, autoRotateSpeed: 0.75 })
        Object.assign(viewer.controls, { enableZoom: true, enableRotate: true, enablePan: false })
        viewer.camera.position.set(0, 10, 25)
        viewer.camera.lookAt(0, 26, 0)
      })
      .catch(console.error)

    return () => {
      cancelled = true
      viewer?.dispose()
      viewerRef.current = null
    }
  }, [head])

  /* Grabbing the head stops the idle spin. */
  const stopRotating = () => {
    if (viewerRef.current) viewerRef.current.autoRotate = false
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      aria-labelledby="head-preview-name"
      className="m-auto rounded-xl border border-edge bg-surface p-5 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="head-preview-name" className="text-lg font-bold text-white">
          {head?.name ?? 'Head'}
        </h2>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close preview"
          className="rounded p-1 text-ink-3 transition-colors hover:text-white"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <canvas
        ref={canvas}
        width={250}
        height={250}
        onPointerDown={stopRotating}
        className="mx-auto block"
      />
      <p className="mt-3 flex items-center justify-center gap-1 text-sm text-ink-3">
        <RotateCw aria-hidden className="size-3" /> Drag to rotate
      </p>
    </dialog>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Box, Loader2 } from 'lucide-react'

/**
 * The in-browser 3D schematic viewer.
 *
 * ── Why the library is loaded from a CDN rather than npm ────────────────────
 *
 * `schematic-renderer` is AGPL-3.0-only, and its published ESM bundle is 11.7 MB
 * with `three`, `@ffmpeg/ffmpeg`, `gif.js` and a WASM block parser all inlined.
 * Loading it at runtime keeps an AGPL bundle out of this repo's build output and
 * 11.7 MB out of the client chunks. To vendor it instead: `pnpm add
 * schematic-renderer` and swap the import — but read the licence first, because
 * AGPL §13 reaches network-served combined works.
 *
 * ── Why jsDelivr's `+esm` and not unpkg ────────────────────────────────────
 *
 * The package's own ESM entry imports `three` and `nucleation` as *bare*
 * specifiers, which a browser cannot resolve without an import map. Importing the
 * unpkg URL throws `Failed to resolve module specifier "three"`. jsDelivr's `+esm`
 * rewrites bare specifiers to CDN URLs, so it resolves.
 *
 * ── The texture pack ───────────────────────────────────────────────────────
 *
 * Self-hosted from /public, built by `pnpm build:pack`: 1.46 MB against the
 * stock pack's 6.79 MB. A block renderer never reads GUI, item, entity or
 * painting textures, so the build walks the blockstate → model → texture
 * reference graph and keeps only what is reachable. The single biggest saving
 * is dropping `pack.png`, a 1.55 MB icon nothing renders.
 *
 * Serving it ourselves puts it behind the site's own CDN with immutable
 * caching, rather than depending on a personal Dropbox link.
 */

const VERSION = '1.6.1'
const RENDERER_URL = `https://cdn.jsdelivr.net/npm/schematic-renderer@${VERSION}/+esm`

/**
 * Built from `data/pack.zip`, which is byte-identical to the renderer's own
 * bundled pack.
 */
const RESOURCE_PACK_URL = '/schematic-pack.zip'

/** Only the surface this component touches. */
type Renderer = {
  dispose: () => void
  getResourcePacks?: () => Promise<unknown[]>
}
type RendererModule = {
  SchematicRenderer: new (
    canvas: HTMLCanvasElement,
    schematics: Record<string, () => Promise<ArrayBuffer>>,
    resourcePacks: Record<string, () => Promise<Blob>>,
    options: Record<string, unknown>,
  ) => Renderer
}

type Status = 'loading' | 'ready' | 'error'

export function SchematicViewer({ url, name }: { url: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!canvasRef.current) return
      try {
        /* A variable specifier, so the bundler leaves this as a runtime import
           rather than trying to resolve and inline 11.7 MB. */
        const mod: RendererModule = await import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */ RENDERER_URL
        )
        if (cancelled || !canvasRef.current) return

        const renderer = new mod.SchematicRenderer(
          canvasRef.current,
          { [name]: async () => (await fetch(url)).arrayBuffer() },
          /* The third positional argument is legacy in 1.6.1 and is ignored;
             packs are loaded through resourcePackOptions.defaultPacks below.
             Passing it here renders every block with placeholder textures. */
          {},
          {
            showGrid: true,
            cameraOptions: { position: [20, 20, 20] },
            /* A read-only property view, so every editing affordance is off.
               Each of these defaults to enabled in 1.6.1: the sidebar puts a
               tabbed editor panel over the page, keyboard controls capture
               WASD and show a "Creative Mode" overlay, and the resource-pack
               UI invites the reader to drop their own pack. */
            enableDragAndDrop: false,
            enableGizmos: false,
            /* The library's own progress bar covers the full canvas while
               meshes build. It is driven by the render loop, so anything that
               stalls that loop leaves it parked over the view — this component
               reports loading in its own header instead. */
            enableProgressBar: false,
            sidebarOptions: { enabled: false, enableKeyboardShortcuts: false },
            keyboardControlsOptions: { enabled: false },
            resourcePackOptions: {
              defaultPacks: {
                default: async () => (await fetch(RESOURCE_PACK_URL)).blob(),
              },
              enableUI: false,
              enableKeyboardShortcuts: false,
              /* Its advice — drop a resource pack — is meaningless here. The
                 check below covers the case it was warning about. */
              showMissingPackNotice: false,
            },
            callbacks: {
              onRendererInitialized: async () => {
                if (cancelled) return
                setStatus('ready')
                /* Without a pack the model still builds, just with placeholder
                   textures, so a broken pack fails silently. Say so. */
                const packs = await renderer.getResourcePacks?.()
                if (!packs?.length) {
                  console.warn(
                    `[nara] Schematic rendered without a resource pack — check ${RESOURCE_PACK_URL}.`,
                  )
                }
              },
            },
          },
        )
        rendererRef.current = renderer
      } catch (error) {
        console.warn('[nara] Schematic renderer failed to load.', error)
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      /* Frees the worker pool and the WebGL context. */
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [url, name])

  return (
    <section className="flex w-full flex-col border-t border-edge bg-surface/20">
      <div className="flex items-center justify-between border-b border-edge bg-surface/40 px-6 py-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wider text-white uppercase">
          <Box aria-hidden className="size-5 text-cyan" /> 3D Schematic View
        </h2>
        {status === 'loading' && (
          <span className="flex items-center gap-2 text-xs text-ink-3" role="status">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Loading…
          </span>
        )}
      </div>

      {status === 'error' ? (
        <p className="px-6 py-8 text-center text-xs text-ink-3">
          The 3D viewer could not be loaded.{' '}
          <a href={url} className="text-cyan underline">
            Download the schematic
          </a>{' '}
          instead.
        </p>
      ) : (
        <div className="schematic-canvas-container">
          <canvas ref={canvasRef} aria-label={`3D view of ${name}`} />
          <div className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-3 rounded-md border border-edge bg-ground/80 px-3 py-1.5 font-mono text-[10px] text-ink-3">
            <span>Drag to rotate</span>
            <span>Scroll to zoom</span>
          </div>
        </div>
      )}
    </section>
  )
}

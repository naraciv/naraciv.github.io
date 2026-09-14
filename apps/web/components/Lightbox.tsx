'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

/**
 * Click any `.city-image` to open it large, in a styled card carrying the same
 * details as the grid tile.
 *
 * The image data rides on the element as data attributes rather than being
 * passed down as props, so the cards themselves stay server components. Two
 * things it needs from every trigger:
 *
 *   data-full-src  the original asset. Without it we would open whatever
 *                  next/image handed the grid — a 640px thumbnail, which is why
 *                  the modal looked small.
 *   data-name / data-coordinates / data-description  optional; present on the
 *                  city tiles, absent on the standalone about-section banner,
 *                  which opens as a plain image.
 */

type Viewed = {
  src: string
  alt: string
  name?: string
  coordinates?: string
  description?: string
}

export function Lightbox() {
  const [viewed, setViewed] = useState<Viewed | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement)?.closest?.('img.city-image') as HTMLImageElement | null
      if (!img) return
      setViewed({
        src: img.dataset.fullSrc || img.currentSrc || img.src,
        alt: img.alt,
        name: img.dataset.name,
        coordinates: img.dataset.coordinates,
        description: img.dataset.description,
      })
    }
    /* The images are focusable (role=button in page.tsx), so Enter and Space open them too. */
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        (e.target as HTMLElement).matches?.('img.city-image')
      ) {
        e.preventDefault()
        onClick(e as unknown as MouseEvent)
      }
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  /* A modal <dialog> brings Escape, the focus trap, focus restore and the top layer;
     globals.css locks page scroll and tile hovers with :has(dialog[open]). */
  useEffect(() => {
    if (viewed && !dialog.current?.open) dialog.current?.showModal()
  }, [viewed])

  const hasDetails = Boolean(viewed?.name)

  return (
    <dialog
      ref={dialog}
      onClose={() => setViewed(null)}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      aria-label={viewed?.name ?? viewed?.alt ?? 'Image'}
      className="fullscreen-modal p-4 sm:p-8"
    >
      {viewed && (
        <>
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 flex size-10 items-center justify-center rounded-full border-0 bg-purple/80 text-2xl leading-none text-white transition hover:scale-110 hover:bg-purple sm:top-5 sm:right-5 sm:size-12"
          >
            ×
          </button>

          {hasDetails ? (
            <article className="gacha-card flex max-h-full w-full max-w-4xl flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element -- src is resolved from the clicked element at runtime */}
              <img
                src={viewed.src}
                alt={viewed.alt}
                className="max-h-[60vh] w-full shrink-0 object-contain"
              />
              <div className="overflow-y-auto p-6">
                <h2 className="text-gacha mb-2 text-3xl font-bold">{viewed.name}</h2>
                {viewed.coordinates && (
                  <p className="mb-3 flex items-center gap-1 text-sm text-ink-2">
                    <MapPin aria-hidden className="size-4" />
                    <span className="sr-only">Coordinates: </span>
                    {viewed.coordinates}
                  </p>
                )}
                {viewed.description && <p className="text-ink-hero">{viewed.description}</p>}
              </div>
            </article>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- as above */
            <img src={viewed.src} alt={viewed.alt} />
          )}
        </>
      )}
    </dialog>
  )
}

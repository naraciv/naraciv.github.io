'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import type { Coords } from '@nara/lib'

const arrow =
  'absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[rgba(5,8,17,0.8)] text-white transition-[background,transform] duration-200 hover:scale-108 hover:bg-orange/80'

/**
 * The listing image carousel.
 */
export function PropertyAlbum({
  images,
  alt,
  coordinates,
}: {
  images: string[]
  alt: string
  coordinates: Coords | null
}) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex h-[480px] flex-col items-center justify-center gap-2 bg-ground text-ink-3">
        <ImageIcon aria-hidden className="size-12 text-edge" />
        <p className="font-mono text-[10px] font-bold">
          X: {coordinates?.x ?? '?'}, Z: {coordinates?.z ?? '?'}
        </p>
        <p className="text-xs">No photos uploaded for this property blueprint yet.</p>
      </div>
    )
  }

  const many = images.length > 1
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length)

  return (
    <div className="relative h-[480px] w-full bg-ground">
      <Image
        key={images[index]}
        src={images[index]}
        alt={many ? `${alt}, image ${index + 1} of ${images.length}` : alt}
        fill
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-contain"
        priority
      />

      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous image"
            className={`${arrow} left-3`}
          >
            <ChevronLeft aria-hidden className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next image"
            className={`${arrow} right-3`}
          >
            <ChevronRight aria-hidden className="size-[18px]" />
          </button>

          <span
            aria-live="polite"
            className="absolute top-3 right-3 rounded-full bg-ground/80 px-2.5 py-1 font-mono text-[10px] font-bold text-ink"
          >
            {index + 1} / {images.length}
          </span>

          {/* 24px buttons around 8px dots: WCAG 2.2 target size, same look. */}
          <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
            {images.map((image, i) => (
              <button
                key={image}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className="group flex size-6 items-center justify-center"
              >
                <span
                  className={`size-2 rounded-full transition-colors ${
                    i === index ? 'bg-cyan' : 'bg-white/40 group-hover:bg-white/70'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

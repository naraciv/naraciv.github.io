'use client'

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'

/** Confirms the copy inline rather than with a blocking alert(). */
export function CopyCoordinates({ coordinates }: { coordinates: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(coordinates)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-surface-2 py-3.5 font-bold text-ink transition-all hover:bg-edge"
    >
      {copied ? (
        <>
          <Check aria-hidden className="size-4 text-green" /> Copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="size-4 text-cyan" /> Copy Coordinates
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? `${coordinates} copied to the clipboard` : ''}
      </span>
    </button>
  )
}

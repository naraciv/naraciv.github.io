'use client'

import { useState } from 'react'
import { Check, ImageDown } from 'lucide-react'
import { copyPng } from '@nara/lib'

/**
 * Copies a rendered PNG to the clipboard, or downloads it where the browser
 * refuses, and says which happened for two seconds.
 *
 * `png` is called on click, not before: the canvas is only drawn when asked
 * for, and Safari needs the clipboard write to start inside the click.
 */
export function CopyImageButton({
  png,
  name,
  label,
  ariaLabel,
  compact = false,
  className = '',
}: {
  png: () => Promise<Blob>
  /** Used for the download's filename when the clipboard is unavailable. */
  name: string
  label: string
  ariaLabel?: string
  /** Show only the icon below `sm` (the aria-label still names it). */
  compact?: boolean
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'saved'>('idle')

  const copy = async () => {
    setState(await copyPng(png(), name))
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-edge px-3 py-1 text-xs font-semibold whitespace-nowrap text-ink-2 transition-colors hover:border-primary hover:text-white ${className}`}
    >
      {state === 'idle' ? (
        <ImageDown aria-hidden className="size-3.5" />
      ) : (
        <Check aria-hidden className="size-3.5 text-green" />
      )}
      <span aria-live="polite" className={compact ? 'max-sm:sr-only' : ''}>
        {state === 'copied' ? 'Copied' : state === 'saved' ? 'Saved' : label}
      </span>
    </button>
  )
}

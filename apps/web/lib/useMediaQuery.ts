'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches, kept in sync as the window resizes.
 * False on the server and during hydration, so pair it with CSS (`hidden
 * md:block`) for the first paint and use this only to decide what to mount.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

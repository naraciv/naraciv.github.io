'use client'

import { avatarUrls } from '@nara/lib'

/**
 * A player's face from mc-heads.net, falling back to minotar.net when that
 * fails. Lazy by default.
 */
export function PlayerAvatar({
  username,
  size = 32,
  eager = false,
  className = '',
}: {
  username: string
  size?: number
  eager?: boolean
  className?: string
}) {
  const [primary, fallback] = avatarUrls(username, size)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={primary}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback
      }}
      className={`[image-rendering:pixelated] ${className}`}
    />
  )
}

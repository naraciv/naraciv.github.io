'use client'

/**
 * Not next/image: these come from a third-party icon host addressed by a name
 * we generate, and a handful will 404 as items are renamed in game. A broken
 * one should vanish rather than leave a gap.
 */
export function ItemIcon({ src, className = 'size-6' }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`item-icon shrink-0 ${className}`}
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  )
}

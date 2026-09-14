import type { ReactNode } from 'react'

/**
 * The site's standard content card: gray-900 on an 8px radius with 24px of
 * padding.
 *
 * `border` covers the three variants that actually appear: none, a full border
 * that warms to the brand colour on hover, and the left rule used by the Daimyo
 * and Komuin lists.
 */
export function Card({
  children,
  className = '',
  border = 'none',
}: {
  children: ReactNode
  className?: string
  border?: 'none' | 'full' | 'left'
}) {
  const borders = {
    none: '',
    full: 'border border-edge transition-colors hover:border-primary',
    left: 'border-l-4 border-primary',
  }
  return (
    <div className={`rounded-lg bg-surface p-6 ${borders[border]} ${className}`}>{children}</div>
  )
}

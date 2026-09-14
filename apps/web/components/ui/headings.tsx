import type { ReactNode } from 'react'

/** Page title: 48px bold, centred, in the brand blue. */
export function PageTitle({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <h1 className={`text-center text-5xl font-bold text-primary ${className}`}>{children}</h1>
}

/**
 * Section heading with the underline rule.
 *
 * `alt` picks the second brand blue (#2596be), used on /joining and /tools;
 * #4FC3F7 everywhere else.
 */
export function SectionHeading({
  children,
  alt = false,
  className = '',
}: {
  children: ReactNode
  alt?: boolean
  className?: string
}) {
  return (
    <h2
      className={`mb-8 border-b pb-2 text-3xl font-bold ${
        alt ? 'border-primary-alt text-primary-alt' : 'border-primary text-primary'
      } ${className}`}
    >
      {children}
    </h2>
  )
}

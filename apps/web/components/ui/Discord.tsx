import type { ReactNode } from 'react'

/**
 * Every Discord affordance on the site, in one place.
 */

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden>
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}

const variants = {
  /** Blurple pill with the icon — the step-one CTA. */
  blurple:
    'inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-6 py-2 text-white transition-colors hover:bg-[#4752C4]',
  /** White pill on a coloured panel — the closing CTA. */
  light:
    'inline-block rounded-lg bg-white px-8 py-3 font-bold text-black transition-colors hover:bg-gray-200',
} as const

export function DiscordButton({
  href,
  children,
  variant = 'blurple',
  className = '',
}: {
  href: string
  children: ReactNode
  variant?: keyof typeof variants
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variants[variant]} ${className}`}
    >
      {variant === 'blurple' && <DiscordIcon className="size-5" />}
      {children}
    </a>
  )
}

/** The pill fixed to the bottom-left of every page, expanding on hover. */
export function DiscordFloatingButton({ href, label }: { href: string; label: string }) {
  return (
    <div className="group fixed bottom-4 left-4 z-50 sm:bottom-10 sm:left-6">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="flex w-14 items-center overflow-hidden rounded-full bg-[#5865F2] p-3 text-white shadow-lg transition-all duration-300 hover:bg-[#4752C4] sm:hover:w-42"
      >
        <DiscordIcon className="size-8 shrink-0" />
        <span
          aria-hidden
          className="ml-2 hidden whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:inline"
        >
          {label}
        </span>
      </a>
    </div>
  )
}

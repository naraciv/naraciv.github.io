import { Star } from 'lucide-react'
import { RARITY, type RarityKey } from '@/lib/gacha'

/** A rarity as five stars, filled up to its count, sized by the surrounding font. */
export function Stars({ rarity, className = '' }: { rarity: RarityKey; className?: string }) {
  const { stars, color } = RARITY[rarity]
  return (
    <span
      role="img"
      aria-label={`${stars} of 5 stars`}
      className={`justify-center gap-[0.15em] ${className}`}
      style={{ color }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className="size-[1em]"
          fill={i < stars ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

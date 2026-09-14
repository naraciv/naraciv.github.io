'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

/**
 * The hover card every profile chart uses.
 *
 * A mouse shows it while hovering; a tap shows it for three seconds, since a
 * finger never "leaves" the way a pointer does.
 */

type Tip = { x: number; y: number; content: ReactNode }

export function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const bind = (content: ReactNode) => ({
    onPointerEnter: (e: PointerEvent) => {
      clearTimeout(timer.current)
      setTip({ x: e.clientX, y: e.clientY, content })
      if (e.pointerType === 'touch') timer.current = setTimeout(() => setTip(null), 3000)
    },
    onPointerMove: (e: PointerEvent) =>
      e.pointerType !== 'touch' && setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerLeave: (e: PointerEvent) => e.pointerType !== 'touch' && setTip(null),
  })

  return { tip, bind }
}

export function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null
  /* Near the top of the viewport it would clip, so it drops below the pointer. */
  const below = tip.y < 80
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[99999] rounded-md border border-[#374151] bg-[rgba(31,41,55,0.95)] px-3 py-1.5 text-[0.85rem] font-medium whitespace-nowrap text-[#f9fafb] shadow-lg backdrop-blur-sm"
      style={{
        left: tip.x,
        top: tip.y,
        transform: below ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 10px))',
      }}
    >
      {tip.content}
    </div>
  )
}

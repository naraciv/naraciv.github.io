'use client'

/**
 * Two native range inputs sharing one track, for picking a date span.
 *
 * Used by the heatmap and the bar chart. Native inputs bring keyboard support
 * (arrow keys, Page Up/Down) for free.
 */
export function RangeSlider({
  min,
  max,
  step,
  value: [lo, hi],
  onChange,
  ticks = [],
  format,
  label,
}: {
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  ticks?: number[]
  format: (value: number) => string
  label: string
}) {
  const span = max - min || 1
  const pct = (v: number) => ((v - min) / span) * 100
  const set = (a: number, b: number) => onChange(a <= b ? [a, b] : [b, a])

  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs text-ink-2">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
      <div className="range-pair relative h-10">
        <div className="absolute top-[18px] h-1 w-full rounded-sm bg-[#374151]" />
        <div
          className="absolute top-[18px] h-1 rounded-sm bg-[#ef4444]"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label}, from`}
          aria-valuetext={format(lo)}
          onChange={(e) => set(Number(e.target.value), hi)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label}, to`}
          aria-valuetext={format(hi)}
          onChange={(e) => set(lo, Number(e.target.value))}
        />
      </div>
      {ticks.length > 0 && (
        <div aria-hidden className="relative mt-0.5 h-4">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 text-[9px] whitespace-nowrap text-ink-3"
              style={{ left: `${pct(tick)}%` }}
            >
              {new Date(tick).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

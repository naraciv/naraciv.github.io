import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/**
 * The site's toggle controls, themed once from the /shops page: rounded-full
 * pills, primary-filled when on, edge-bordered when off. Every button group and
 * switch on the site uses these, so they look and behave the same everywhere.
 */

const SIZES = {
  sm: 'gap-1 px-3 py-1 text-xs',
  md: 'gap-1.5 px-4 py-2 text-sm',
}
export type ControlSize = keyof typeof SIZES

/** Pill classes for an on/off control. Exported for links styled as pills. */
export const pillClass = (on: boolean, size: ControlSize = 'md') =>
  `inline-flex items-center justify-center rounded-full border font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${SIZES[size]} ${
    on
      ? 'border-primary bg-primary text-ground'
      : 'border-edge bg-surface text-ink-2 hover:border-primary hover:text-white'
  }`

/** A single pressable pill (`aria-pressed`), for filters and on/off actions. */
export function ToggleButton({
  pressed,
  size = 'md',
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-pressed'> & {
  pressed: boolean
  size?: ControlSize
}) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={pressed}
      className={`${pillClass(pressed, size)} ${className}`}
    />
  )
}

/** Pick one of several: a labelled group of pills. */
export function ButtonGroup<T extends string>({
  label,
  showLabel = false,
  value,
  onChange,
  options,
  size = 'md',
  fill = false,
  mobileSelect = false,
  className = '',
}: {
  label: string
  /** Render the label as text before the pills; otherwise it is for screen readers only. */
  showLabel?: boolean
  value: T
  onChange: (value: T) => void
  options: readonly (readonly [T, ReactNode])[]
  size?: ControlSize
  /** One row, the pills sharing its width equally — for narrow sidebars. */
  fill?: boolean
  /** Below `sm`, a native dropdown instead of pills, where a row of pills would not fit. */
  mobileSelect?: boolean
  className?: string
}) {
  const select = mobileSelect && (
    <label className={`flex items-center gap-1.5 text-sm text-ink-2 sm:hidden ${className}`}>
      <span className={showLabel ? 'w-24 shrink-0' : 'sr-only'}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-w-0 flex-1 cursor-pointer rounded-full border border-edge bg-surface px-3 py-1.5 text-sm font-semibold text-white focus:border-primary"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {typeof text === 'string' ? text : option}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <>
      {select}
      <div
        role="group"
        aria-label={label}
        className={`items-center gap-1.5 ${mobileSelect ? 'hidden sm:flex' : 'flex'} ${fill ? '[&>button]:flex-1 [&>button]:px-2' : 'flex-wrap'} ${className}`}
      >
        {showLabel && <span className="w-24 shrink-0 text-sm text-ink-2 sm:w-28">{label}</span>}
        {options.map(([option, text]) => (
          <ToggleButton
            key={option}
            pressed={value === option}
            onClick={() => onChange(option)}
            size={size}
          >
            {text}
          </ToggleButton>
        ))}
      </div>
    </>
  )
}

/**
 * An on/off switch: a native checkbox with `role="switch"`, so Space, the
 * announced state and label clicks come from the browser. Pass `label` to get
 * the text and switch in one clickable row.
 */
export function Switch({
  label,
  onChange,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'onChange'> & {
  label?: ReactNode
  onChange: (checked: boolean) => void
}) {
  const input = (
    <input
      {...props}
      type="checkbox"
      role="switch"
      onChange={(e) => onChange(e.target.checked)}
      className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-edge bg-surface-2 transition-colors before:absolute before:top-px before:left-px before:size-4 before:rounded-full before:bg-ink-2 before:transition-[transform,background-color] checked:border-primary checked:bg-primary checked:before:translate-x-4 checked:before:bg-ground disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
  if (!label) return input
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-2 select-none ${className}`}
    >
      {label}
      {input}
    </label>
  )
}

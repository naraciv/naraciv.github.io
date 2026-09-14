'use client'

import { useState } from 'react'
import { findRoute, routeToDirections } from '@nara/lib'

/**
 * "Navigate from" — pick a city with a rail route here and read the directions.
 *
 * A native `<select>`, so positioning, dismissal and keyboard use come free.
 *
 * Directions come back as structured steps, so the coordinates and the `/dest`
 * command are emphasised as markup rather than interpolated into an HTML
 * string.
 */
export function RailDirections({
  destination,
  departures,
}: {
  destination: string
  departures: string[]
}) {
  const [from, setFrom] = useState('')

  const route = from ? findRoute(from, destination) : null
  const steps = route ? routeToDirections(route) : []

  return (
    <div className="flex flex-col gap-3 border-t border-edge pt-5 pb-4">
      <label
        htmlFor="navigate-from"
        className="ml-1 text-xs font-extrabold tracking-wide text-cyan uppercase"
      >
        Navigate from
      </label>
      <select
        id="navigate-from"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="cursor-pointer rounded-full border border-edge bg-surface px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:border-orange"
      >
        <option value="">Select a city…</option>
        {departures.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      {from && (
        <div
          aria-live="polite"
          className="rounded-xl border border-edge bg-ground/60 p-4 text-xs leading-relaxed text-ink-2"
        >
          {steps.length === 0 ? (
            <>
              No route found from {from} to {destination}.
            </>
          ) : (
            <ol className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={i}>
                  {step.prefix} the {step.lineName}
                  {step.departureCoordinates && (
                    <>
                      {' '}
                      <strong className="font-mono text-ink">{step.departureCoordinates}</strong>
                    </>
                  )}{' '}
                  from {step.departureCity} to {step.arrivalCity}
                  {step.arrivalCoordinates && (
                    <>
                      {' '}
                      <strong className="font-mono text-ink">{step.arrivalCoordinates}</strong>
                    </>
                  )}
                  {step.destCommand && (
                    <>
                      {' '}
                      using <strong className="font-mono text-cyan">{step.destCommand}</strong>
                    </>
                  )}
                  .
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

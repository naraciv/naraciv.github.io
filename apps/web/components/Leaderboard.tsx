'use client'

import Link from 'next/link'
import { ButtonGroup } from '@/components/ui'
import { useState } from 'react'
import type { LeaderboardPeriod, LeaderboardRow } from '@nara/lib'
import { PlayerAvatar } from './PlayerAvatar'

/**
 * The top ten by playtime. All three periods are ranked on the server; this
 * only switches between them.
 */

const TABS: [LeaderboardPeriod, string][] = [
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['allTime', 'All-Time'],
]

/* Gold, silver, bronze for the podium. */
const RANK_COLOR = ['text-gold', 'text-ink', 'text-[#d97706]']

export function Leaderboard({ boards }: { boards: Record<LeaderboardPeriod, LeaderboardRow[]> }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly')

  return (
    <>
      <ButtonGroup
        label="Period"
        value={period}
        onChange={setPeriod}
        options={TABS}
        size="sm"
        fill
        className="mb-4"
      />

      <div>
        <ol className="custom-scroll max-h-[60vh] space-y-3 overflow-y-auto pr-2">
          {boards[period].map((row, i) => (
            <li key={row.username} className="text-sm">
              <Link
                href={`/stats/${encodeURIComponent(row.username)}`}
                className="flex items-center gap-3 rounded bg-surface-2/50 p-2 transition-colors hover:bg-surface-2"
              >
                <span className={`w-6 text-center font-bold ${RANK_COLOR[i] ?? 'text-ink-2'}`}>
                  #{i + 1}
                </span>
                <PlayerAvatar username={row.username} className="size-8 rounded bg-edge" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {row.username}
                  </span>
                  <span className="block text-xs text-ink-2">{row[period]} hrs</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import { BarChart2 } from 'lucide-react'
import { parseLeaderboard, topPlayers } from '@nara/lib'
import { Leaderboard } from '@/components/Leaderboard'
import { OnlinePlayers } from '@/components/OnlinePlayers'

export const metadata: Metadata = {
  title: 'Player Stats',
  description:
    'Who is online on CivMC right now, and the weekly, monthly and all-time playtime leaderboard.',
  alternates: { canonical: '/stats' },
}

/* Static: the leaderboard CSV is rebuilt daily by update-leaderboard.yml and
   committed, which redeploys. Live players are fetched in the browser. */
export const dynamic = 'force-static'

const rows = parseLeaderboard(
  readFileSync(path.join(process.cwd(), '../../data/leaderboard.csv'), 'utf8'),
)
const boards = {
  weekly: topPlayers(rows, 'weekly'),
  monthly: topPlayers(rows, 'monthly'),
  allTime: topPlayers(rows, 'allTime'),
}

export default function StatsPage() {
  return (
    <div className="px-4 pt-[100px]">
      <div className="mx-auto flex w-full max-w-[95%] flex-col gap-8 py-10 lg:flex-row">
        {/* Below lg the aside dissolves (`contents`) so Sources can drop to the very bottom. */}
        <aside className="flex w-full flex-col gap-6 max-lg:contents lg:sticky lg:top-24 lg:w-1/5 lg:self-start">
          <section className="h-fit rounded-lg border border-edge bg-surface p-4">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-primary">
              <BarChart2 aria-hidden /> Leaderboard
            </h2>
            <Leaderboard boards={boards} />
            <p className="mt-4 border-t border-edge pt-3 text-center text-xs text-ink-3">
              Updated daily at 12am UTC
            </p>
          </section>

          <section className="rounded-lg border border-edge bg-surface p-4 text-sm text-ink-2 max-lg:order-last">
            <h2 className="font-semibold text-white">Sources</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Playtime stats are provided by{' '}
              <a
                href="https://civinfo.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                civinfo.net
              </a>
              . Please contact <span className="font-medium">@realhusky</span> on Discord if you
              spot any data errors. Player heads are sourced from{' '}
              <a
                href="https://mc-heads.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                mc-heads.net
              </a>{' '}
              and{' '}
              <a
                href="https://minotar.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                minotar.net
              </a>
              .
            </p>
            <p className="text-sm">Performance errors are likely my fault.</p>
          </section>
        </aside>

        <OnlinePlayers />
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { allTimeHours, allTimeRank, resolvePlayer } from '@/lib/playerLookup'
import { PlayerProfile } from '@/components/PlayerProfile'

/**
 * One player's playtime profile.
 *
 * `noindex` until the owner decides: these are pages about named real people,
 * potentially tens of thousands of them, and that is for the community to
 * settle rather than a default.
 */

export async function generateMetadata({
  params,
}: PageProps<'/stats/[player]'>): Promise<Metadata> {
  const { player } = await params
  const name = decodeURIComponent(player)
  const hours = allTimeHours(name)
  const rank = allTimeRank(name)
  /* The link preview is one line: hours from the daily leaderboard, rank if top ten. */
  const preview =
    hours === null
      ? 'CivMC playtime stats'
      : `${Math.round(hours).toLocaleString('en-US')} hours on CivMC${rank ? ` · #${rank} all time` : ''}`
  return {
    title: `${name}: Player Stats`,
    description: `${name}'s CivMC playtime: hours played, when they are usually online, and their history month by month.`,
    robots: { index: false, follow: true },
    openGraph: { title: name, description: preview, siteName: 'Nara Player Stats' },
  }
}

export default async function PlayerPage({ params }: PageProps<'/stats/[player]'>) {
  const requested = decodeURIComponent((await params).player)
  const resolved = resolvePlayer(requested)

  /* /stats/hg__80 → /stats/Hg__80, so there is one URL per player. Casing only, never another name. */
  if (resolved && resolved.name !== requested)
    permanentRedirect(`/stats/${encodeURIComponent(resolved.name)}`)

  const name = resolved?.name ?? requested
  return (
    <div className="px-4 pt-[100px]">
      <PlayerProfile name={name} uuid={resolved?.uuid ?? null} rank={allTimeRank(name)} />
    </div>
  )
}

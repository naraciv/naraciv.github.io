'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, LogOut, Search, Users } from 'lucide-react'
import { duration, type Player } from '@nara/lib'
import { PlayerAvatar } from './PlayerAvatar'

/**
 * Who is on CivMC now, then everyone civinfo knows about, newest first.
 *
 *   - /api/online-players does the civinfo calls and caches the merged result for
 *     5 minutes, so this only ever costs a same-origin request — see that route.
 *   - Failed requests retry twice, then offer a Retry button.
 *   - Offline players page in by 30 as you scroll, with native lazy images.
 */

const INITIAL = 50
const PAGE = 30

async function getJson<T>(url: string, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} from ${url}`)
      return await res.json()
    } catch (error) {
      if (attempt >= tries) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

type Status = 'loading' | 'ready' | 'error'

export function OnlinePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [now, setNow] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(INITIAL)
  const [urlRead, setUrlRead] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  /* Never sets state before its first await, so the mount effect can call it. */
  const load = useCallback(async () => {
    try {
      setPlayers(await getJson<Player[]>('/api/online-players'))
      setStatus('ready')
    } catch (error) {
      console.warn('[nara] online-players request failed.', error)
      setStatus((current) => (current === 'ready' ? current : 'error'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from civinfo is the external sync
    load()
  }, [load])

  /* Online durations tick once a minute. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  /* After hydration, like /heads: the page is static, the URL is not. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once, after hydration
    setSearch(params.get('search') ?? '')
    setUrlRead(true)
  }, [])

  useEffect(() => {
    if (!urlRead) return
    const url = new URL(window.location.href)
    if (search.trim()) url.searchParams.set('search', search.trim())
    else url.searchParams.delete('search')
    window.history.replaceState(null, '', url)
  }, [search, urlRead])

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? players.filter((p) => p.username.toLowerCase().includes(term)) : players
  }, [players, search])

  const online = matches.filter((p) => p.isOnline).length
  /* Search results page in too: "a" matches most of 55,000 accounts. */
  const visible = matches.slice(0, Math.max(shown, online))
  const more = visible.length < matches.length

  useEffect(() => {
    if (!more || !sentinel.current) return
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setShown((n) => n + PAGE),
      { rootMargin: '200px' },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [more, visible.length])

  return (
    <div className="w-full lg:w-4/5">
      <div className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h2 className="flex items-center gap-3 text-4xl font-bold text-primary">
          Online Players
          <span aria-live="polite" className="flex items-center gap-2 text-2xl text-ink-2">
            <Users aria-hidden className="size-6" />
            {players.filter((p) => p.isOnline).length}
          </span>
        </h2>
        <div className="relative w-full md:w-[30%]">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            aria-label="Search players"
            className="w-full rounded-full border border-edge bg-surface py-2 pr-4 pl-10 text-white placeholder-ink-2 transition-colors focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {status === 'error' ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-danger">Could not reach civinfo for player data.</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading')
              load()
            }}
            className="rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:border-primary hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : status === 'loading' ? (
        <p className="py-12 text-center text-ink-3">Loading player data...</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-ink-3">No players found</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((player) => (
            <li key={player.username}>
              <PlayerCard player={player} now={now} />
            </li>
          ))}
        </ul>
      )}
      {status === 'ready' && more && <div ref={sentinel} className="h-8" />}
    </div>
  )
}

function PlayerCard({ player, now }: { player: Player; now: number }) {
  const at = player.isOnline ? player.loginTime : player.logoutTime
  const days = Math.floor((now - player.logoutTime) / 86_400_000)

  return (
    <Link
      href={`/stats/${encodeURIComponent(player.username)}`}
      className="relative flex flex-col items-center gap-3 rounded-lg border border-edge bg-surface p-4 transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface-2"
    >
      <span className="relative">
        <PlayerAvatar
          username={player.username}
          eager={player.isOnline}
          className="size-20 rounded-md bg-surface-2 shadow-lg"
        />
        <span
          aria-hidden
          className={`absolute -right-1.5 -bottom-1.5 size-5 rounded-full border-4 border-surface ${
            player.isOnline ? 'bg-[#10b981]' : 'bg-[#ef4444]'
          }`}
        />
      </span>
      <span className="mt-2 w-full truncate text-center text-lg font-bold text-white">
        {player.username}
      </span>
      <span
        title={at ? new Date(at).toLocaleString() : 'Unknown'}
        className="flex items-center justify-center gap-2 text-sm font-medium text-ink-2"
      >
        {player.isOnline ? (
          <>
            <Clock aria-hidden className="size-4" /> Online for {duration(now - player.loginTime)}
          </>
        ) : (
          <>
            <LogOut aria-hidden className="size-4" />
            {days < 1 ? 'Offline < 1 day' : `Offline for ${days} day${days === 1 ? '' : 's'}`}
          </>
        )}
      </span>
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { Dices, Lock, Sparkles } from 'lucide-react'
import { Stars } from '@/components/Stars'
import { ToggleButton } from '@/components/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RARITY,
  RARITY_ORDER,
  canPullToday,
  fetchNarans,
  fetchState,
  getSkinUrl,
  type Collection,
  type Naran,
  type RarityKey,
} from '@/lib/gacha'

/**
 * The visitor's Naran collection: totals, progress, a rarity filter and a card
 * per Naran, locked until pulled.
 *
 * The detail image only exists once a Naran is chosen, inside a native
 * <dialog> — an empty `<img src="">` would be requested as the page URL.
 *
 * Everything depends on the visitor's own state from the gacha backend, so
 * nothing here is server-rendered beyond the page shell.
 */

/* [key, label, dot colour]. The pills share the site theme; the dot keeps each rarity's colour. */
const FILTERS: ['all' | RarityKey, string, string][] = [
  ['all', 'All', '#546E7A'],
  ...RARITY_ORDER.map((key): [RarityKey, string, string] => [
    key,
    RARITY[key].label,
    key === 'COMMON' ? '#6B7280' : RARITY[key].color,
  ]),
]

export function NaranCollection() {
  const [narans, setNarans] = useState<Naran[]>([])
  const [collection, setCollection] = useState<Collection>({})
  const [lastPull, setLastPull] = useState('')
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<'all' | RarityKey>('all')
  const [detail, setDetail] = useState<Naran | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([fetchNarans(), fetchState()]).then(([roster, state]) => {
      if (!alive) return
      setNarans(roster)
      setCollection(state.collection)
      setLastPull(state.lastPull)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const collected = Object.keys(collection).length
  const pulls = Object.values(collection).reduce((sum, entry) => sum + entry.count, 0)
  /* Guarded: an empty or failed roster would give NaN%. */
  const pct = narans.length ? Math.round((collected / narans.length) * 100) : 0

  const cards = useMemo(
    () =>
      narans
        .filter((naran) => filter === 'all' || naran.rarity === filter)
        .sort(
          (a, b) =>
            Number(!collection[a.id]) - Number(!collection[b.id]) ||
            RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
        ),
    [narans, collection, filter],
  )

  return (
    <>
      {/* ── Stats ── */}
      <dl className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Collected" value={collected} className="text-gacha" />
        <Stat label="Total Narans" value={narans.length} className="text-gold" />
        <Stat label="Total Pulls" value={pulls} className="text-purple" />
        <Stat label="Duplicates" value={Math.max(0, pulls - collected)} className="text-primary" />
      </dl>

      {/* ── Progress ── */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-ink-3">Collection Progress</span>
          <span className="text-gacha font-bold">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Collection progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 overflow-hidden rounded-lg border border-black/5 bg-surface"
        >
          <div
            className="h-full rounded-lg bg-gradient-to-r from-purple to-gold transition-[width] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Pull call to action ── */}
      <div className="gacha-banner mb-10 text-center">
        <p aria-live="polite" className="relative z-10 mb-4 min-h-6 text-ink-3">
          {!ready ? (
            'Loading your collection…'
          ) : canPullToday(lastPull) ? (
            <>
              <Sparkles aria-hidden className="inline size-4 text-orange" />{' '}
              <span className="text-orange">Your daily pull is available!</span>
            </>
          ) : (
            'Come back tomorrow for your next pull!'
          )}
        </p>
        <Link
          href="/"
          className="gacha-pull-btn relative z-10 inline-flex items-center gap-2 no-underline"
        >
          <Dices aria-hidden className="size-5" /> Go Pull!
        </Link>
      </div>

      {/* ── Rarity filter ── */}
      <div className="mb-8 flex flex-wrap justify-center gap-3" role="group" aria-label="Rarity">
        {FILTERS.map(([key, label, color]) => {
          return (
            <ToggleButton key={key} pressed={filter === key} onClick={() => setFilter(key)}>
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
              {label}
            </ToggleButton>
          )
        })}
      </div>

      {/* ── Cards ── */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-6">
        {cards.map((naran) => (
          <li key={naran.id}>
            <NaranCard
              naran={naran}
              count={collection[naran.id]?.count}
              onOpen={() => setDetail(naran)}
            />
          </li>
        ))}
      </ul>
      {ready && narans.length === 0 && (
        <p className="py-12 text-center text-ink-3">
          The Naran roster could not be loaded. Try again in a moment.
        </p>
      )}

      <NaranDetail
        naran={detail}
        entry={detail ? collection[detail.id] : undefined}
        onClose={() => setDetail(null)}
      />
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    /* dt must come first in a dl group; flex-col-reverse puts the figure on top. */
    <div className="flex flex-col-reverse rounded-xl border border-white/5 bg-surface p-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
      <dt className="mt-1 text-sm text-ink-3">{label}</dt>
      <dd className={`text-[2rem] font-black ${className}`}>{value}</dd>
    </div>
  )
}

function NaranCard({
  naran,
  count,
  onOpen,
}: {
  naran: Naran
  count: number | undefined
  onOpen: () => void
}) {
  const rarity = RARITY[naran.rarity]
  const body = (
    <>
      <Stars rarity={naran.rarity} className="flex" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getSkinUrl(naran.name)}
        alt=""
        loading="lazy"
        className="mx-auto mt-2 mb-3 size-[120px] object-contain [image-rendering:pixelated]"
      />
      <span
        className="my-1 block text-lg font-bold"
        style={{ color: count ? rarity.color : '#B0BEC5' }}
      >
        {naran.name}
      </span>
      <span className="block text-sm text-[#9ca3b0]">{naran.title}</span>
      {count && <span className="mt-2 block text-sm text-[#8891a5]">×{count}</span>}
    </>
  )
  const shared =
    'relative block w-full rounded-2xl border-2 bg-surface p-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.3)]'

  if (!count)
    return (
      <div
        aria-label={`${naran.name}, not collected yet`}
        className={`${shared} border-white/5 brightness-[0.3] grayscale`}
      >
        {body}
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <Lock className="size-12 text-white" />
        </span>
      </div>
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${shared} transition-transform hover:-translate-y-1`}
      style={{ borderColor: rarity.color }}
    >
      {body}
    </button>
  )
}

function NaranDetail({
  naran,
  entry,
  onClose,
}: {
  naran: Naran | null
  entry: Collection[string] | undefined
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const skin = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (naran) dialog.current?.showModal()
  }, [naran])

  /* The card tilts toward the pointer. */
  const tilt = (e: React.PointerEvent) => {
    const rect = skin.current?.getBoundingClientRect()
    if (!rect || !skin.current) return
    const dx = (e.clientX - (rect.left + rect.width / 2)) / rect.width
    const dy = (e.clientY - (rect.top + rect.height / 2)) / rect.height
    skin.current.style.transform = `rotateY(${dx * 20}deg) rotateX(${-dy * 15}deg)`
  }

  const rarity = naran ? RARITY[naran.rarity] : null

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onPointerMove={tilt}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      aria-labelledby="naran-detail-name"
      className="m-auto w-[90%] max-w-[360px] rounded-[20px] border-[3px] bg-surface p-8 text-center text-ink backdrop:bg-[rgba(2,6,23,0.92)]"
      style={rarity ? { borderColor: rarity.color, boxShadow: `0 0 30px ${rarity.glow}` } : {}}
    >
      {naran && rarity && (
        <>
          <Stars rarity={naran.rarity} className="flex text-2xl" />
          <div className="mx-auto my-4 inline-block [perspective:600px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={skin}
              src={getSkinUrl(naran.name)}
              alt={naran.name}
              className="w-[150px] transition-transform duration-100 ease-linear [image-rendering:pixelated]"
            />
          </div>
          <h2
            id="naran-detail-name"
            className="mt-2 mb-1 text-2xl font-black"
            style={{ color: rarity.color }}
          >
            {naran.name}
          </h2>
          <p className="text-base text-ink-2">{naran.title}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-3">{naran.description}</p>
          <span
            className="mt-3 inline-block rounded-[20px] px-4 py-1 text-[0.8rem] font-bold text-white"
            style={{ background: rarity.bg }}
          >
            {rarity.label}
          </span>
          {entry && (
            <p className="mt-2 text-xs text-ink-3">
              Pulled {entry.count} time{entry.count > 1 ? 's' : ''}
              {entry.firstPulled && ` · First: ${new Date(entry.firstPulled).toLocaleDateString()}`}
            </p>
          )}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="mt-5 rounded-3xl bg-gradient-to-br from-purple to-orange px-8 py-2 font-semibold text-white"
          >
            Close
          </button>
        </>
      )}
    </dialog>
  )
}

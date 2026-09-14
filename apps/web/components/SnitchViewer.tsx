'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { UploadCloud, Upload } from 'lucide-react'
import {
  STATUS_COLOR,
  filterSnitches,
  groupCounts,
  snitchKey,
  snitchStatus,
  type Snitch,
  type SnitchStatus,
} from '@nara/lib'
import { ButtonGroup, Switch, ToggleButton } from '@/components/ui'
import { RangeSlider } from './charts/RangeSlider'

/**
 * Open a SnitchMod database, filter it, and see it on the map.
 *
 * The map is the shared CivMap with the snitches painted through CanvasLayer.
 *
 * The database is read in the browser with sql.js and never uploaded.
 */

const SnitchMap = dynamic(() => import('./SnitchMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-350px)] min-h-[400px] items-center justify-center rounded-lg bg-[#1a1a1a] text-xs text-ink-3">
      Loading map…
    </div>
  ),
})

/* sql.js and its wasm are fetched only when a database is opened. */
async function readDatabase(file: File): Promise<Snitch[]> {
  const { default: initSqlJs } = await import('sql.js')
  const SQL = await initSqlJs({
    locateFile: () => new URL('sql.js/dist/sql-wasm-browser.wasm', import.meta.url).href,
  })
  const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()))
  try {
    const [result] = db.exec(
      'SELECT world, x, y, z, group_name, type, name, dormant_ts FROM snitches_v2',
    )
    if (!result) return []
    return result.values.map(
      (row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])) as Snitch,
    )
  } finally {
    db.close()
  }
}

const STATUSES: [SnitchStatus, string][] = [
  ['active', 'Active'],
  ['will-dormant', 'Will be dormant'],
  ['dormant', 'Dormant'],
  ['culled', 'Culled'],
]
const ONBOARDED = 'snitch-viewer-onboarded'
const isDatabase = (file: File) => /\.(sqlite3?|db)$/i.test(file.name)

export type SnitchSettings = {
  clickSelect: boolean
  showWillDormant: boolean
  showRange: boolean
  hiddenStatuses: Set<SnitchStatus>
}

export function SnitchViewer() {
  const [snitches, setSnitches] = useState<Snitch[] | null>(null)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState(0)
  const [world, setWorld] = useState<'world' | 'world_nether'>('world')
  const [y, setY] = useState<[number, number]>([-64, 320])
  const [warningDays, setWarningDays] = useState(5)
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<SnitchSettings>({
    clickSelect: true,
    showWillDormant: true,
    showRange: false,
    hiddenStatuses: new Set(),
  })
  const [selected, setSelected] = useState<Map<string, Snitch>>(new Map())
  const [onboarded, setOnboarded] = useState(true)
  const input = useRef<HTMLInputElement>(null)

  const load = async (file: File) => {
    setError('')
    try {
      const rows = await readDatabase(file)
      if (!rows.length) return setError('No snitch data found in that database.')
      setSnitches(rows)
      setLoadedAt(Date.now())
      setHiddenGroups(new Set())
      setSelected(new Map())
      try {
        setOnboarded(!!localStorage.getItem(ONBOARDED))
      } catch {
        /* storage blocked: just skip the hint */
      }
    } catch (e) {
      console.error(e)
      setError(`Could not read that file: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /* Accept a database dropped anywhere on the page, not just the box. */
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (file && isDatabase(file)) load(file)
    }
    document.addEventListener('dragover', over)
    document.addEventListener('drop', drop)
    return () => {
      document.removeEventListener('dragover', over)
      document.removeEventListener('drop', drop)
    }
  }, [])

  const visible = useMemo(
    () =>
      snitches ? filterSnitches(snitches, { world, yMin: y[0], yMax: y[1], hiddenGroups }) : [],
    [snitches, world, y, hiddenGroups],
  )
  const statusOf = useMemo(() => {
    const map = new Map<Snitch, SnitchStatus>()
    for (const s of visible) map.set(s, snitchStatus(s, loadedAt, warningDays))
    return map
  }, [visible, loadedAt, warningDays])
  const counts = useMemo(() => {
    const c: Record<SnitchStatus, number> = { active: 0, 'will-dormant': 0, dormant: 0, culled: 0 }
    for (const status of statusOf.values()) c[status]++
    return c
  }, [statusOf])
  const groups = useMemo(() => (snitches ? groupCounts(snitches) : []), [snitches])

  const toggleStatus = (status: SnitchStatus) => {
    const hidden = new Set(settings.hiddenStatuses)
    if (!hidden.delete(status)) hidden.add(status)
    setSettings({ ...settings, hiddenStatuses: hidden })
    if (!onboarded) {
      setOnboarded(true)
      try {
        localStorage.setItem(ONBOARDED, 'true')
      } catch {
        /* ignore */
      }
    }
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".sqlite,.db,.sqlite3"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) load(file)
        e.target.value = ''
      }}
    />
  )

  if (!snitches)
    return (
      <div className="mx-auto mb-6 max-w-2xl">
        {fileInput}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full cursor-pointer rounded-lg border-2 border-dashed border-[#374151] p-8 text-center transition-colors hover:border-primary-alt hover:bg-primary-alt/10"
        >
          <UploadCloud aria-hidden className="mx-auto mb-3 size-12 text-ink-3" />
          <span className="mb-2 block text-lg text-white">Drop your SnitchMod database here</span>
          <span className="block text-sm text-ink-2">or click to browse (.sqlite, .db)</span>
        </button>
        <p className="mt-3 text-center text-xs text-ink-3">
          The file is read in your browser and never uploaded.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    )

  return (
    <>
      {fileInput}
      {/* ── Stats ── */}
      <div className="mb-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white">Snitch Info</h2>
        {!onboarded && (
          <p className="text-sm font-semibold text-white">Click any box below to toggle it ↓</p>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-2 text-ink-2">
              Total: <span className="font-semibold text-white">{snitches.length}</span>{' '}
              <span className="text-ink-3">({visible.length} visible)</span>
            </span>
            {STATUSES.filter(
              ([status]) => status !== 'will-dormant' || settings.showWillDormant,
            ).map(([status, label]) => {
              const off = settings.hiddenStatuses.has(status)
              const count =
                status === 'active' && !settings.showWillDormant
                  ? counts.active + counts['will-dormant']
                  : counts[status]
              return (
                <ToggleButton
                  key={status}
                  pressed={!off}
                  onClick={() => toggleStatus(status)}
                  size="sm"
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: STATUS_COLOR[status] }}
                  />
                  {label}: <span className="font-bold">{count}</span>
                </ToggleButton>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center gap-2 self-start rounded bg-[#dc2626] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#ef4444] lg:self-auto"
          >
            <Upload aria-hidden className="size-4" /> Load New
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Sidebar ── */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="flex flex-col gap-3 lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold text-white">Settings</h2>
            <div className="flex flex-col gap-4 rounded-lg border border-[#374151] bg-surface p-3">
              <div>
                <div className="mb-1 text-xs text-ink-2">World</div>
                <ButtonGroup
                  label="World"
                  value={world}
                  onChange={setWorld}
                  size="sm"
                  fill
                  options={[
                    ['world', 'Overworld'],
                    ['world_nether', 'Nether'],
                  ]}
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>Y Level</span>
                  <span className="flex items-center gap-1">
                    <YInput
                      label="Minimum Y"
                      value={y[0]}
                      onChange={(v) => setY([Math.min(v, y[1]), y[1]])}
                    />
                    to
                    <YInput
                      label="Maximum Y"
                      value={y[1]}
                      onChange={(v) => setY([y[0], Math.max(v, y[0])])}
                    />
                  </span>
                </div>
                <RangeSlider
                  label="Y level"
                  min={-64}
                  max={320}
                  step={1}
                  value={y}
                  onChange={setY}
                  format={String}
                />
              </div>

              <label className="flex items-center gap-1 text-xs text-ink-2">
                Dormant warning within
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={warningDays}
                  onChange={(e) =>
                    setWarningDays(Math.max(1, Math.min(90, Number(e.target.value) || 5)))
                  }
                  className="w-11 rounded border border-[#374151] bg-ground px-1 text-white"
                />
                days
              </label>

              <Switch
                className="text-xs"
                label="Click to Select"
                checked={settings.clickSelect}
                onChange={(v) => setSettings({ ...settings, clickSelect: v })}
              />
              <Switch
                className="text-xs"
                label="Show will be dormant"
                checked={settings.showWillDormant}
                onChange={(v) => setSettings({ ...settings, showWillDormant: v })}
              />
              <Switch
                className="text-xs"
                label="Show Snitch Range (21×21)"
                checked={settings.showRange}
                onChange={(v) => setSettings({ ...settings, showRange: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Groups</h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setHiddenGroups(new Set())}
                  className="text-primary hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setHiddenGroups(new Set(groups.map(([g]) => g)))}
                  className="text-ink-2 hover:text-white"
                >
                  None
                </button>
              </div>
            </div>
            <GroupList groups={groups} hidden={hiddenGroups} onChange={setHiddenGroups} />
          </div>
        </aside>

        {/* ── Map ── */}
        <div className="h-[calc(100vh-350px)] min-h-[400px] min-w-0 flex-1">
          <SnitchMap
            key={loadedAt}
            snitches={visible}
            statusOf={statusOf}
            settings={settings}
            selected={selected}
            onSelect={(s) =>
              setSelected((current) => {
                const next = new Map(current)
                if (!next.delete(snitchKey(s))) next.set(snitchKey(s), s)
                return next
              })
            }
            onClearSelection={() => setSelected(new Map())}
            now={loadedAt}
          />
        </div>
      </div>
    </>
  )
}

function YInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      min={-64}
      max={320}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(-64, Math.min(320, Number(e.target.value) || 0)))}
      className="w-12 rounded border border-[#374151] bg-ground px-1 text-white"
    />
  )
}

/**
 * Group checkboxes you can drag across to set many at once:
 * the first one pressed decides whether the rest are shown or hidden.
 */
function GroupList({
  groups,
  hidden,
  onChange,
}: {
  groups: [string, number][]
  hidden: Set<string>
  onChange: (hidden: Set<string>) => void
}): ReactNode {
  const drag = useRef<{ show: boolean; hidden: Set<string> } | null>(null)
  /* Mouse presses toggle on pointerdown, so the click that follows must not toggle again. */
  const pointer = useRef('')

  useEffect(() => {
    const end = () => (drag.current = null)
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [])

  const apply = (group: string) => {
    if (!drag.current) return
    const next = new Set(drag.current.hidden)
    if (drag.current.show) next.delete(group)
    else next.add(group)
    drag.current.hidden = next
    onChange(next)
  }

  return (
    <ul className="custom-scroll max-h-[50vh] overflow-y-auto rounded-lg border border-[#374151] bg-surface p-1">
      {groups.map(([group, count]) => (
        <li key={group}>
          <button
            type="button"
            role="checkbox"
            aria-checked={!hidden.has(group)}
            onPointerDown={(e) => {
              pointer.current = e.pointerType
              if (e.pointerType !== 'mouse') return
              e.preventDefault()
              drag.current = { show: hidden.has(group), hidden }
              apply(group)
            }}
            onPointerEnter={() => apply(group)}
            onClick={() => {
              if (pointer.current === 'mouse') return void (pointer.current = '')
              const next = new Set(hidden)
              if (!next.delete(group)) next.add(group)
              onChange(next)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors select-none hover:bg-surface-2"
          >
            <span
              aria-hidden
              className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border text-[10px] ${hidden.has(group) ? 'border-[#4b5563]' : 'border-primary bg-primary text-ground'}`}
            >
              {!hidden.has(group) && '✓'}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink" title={group}>
              {group}
            </span>
            <span className="text-ink-3">{count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

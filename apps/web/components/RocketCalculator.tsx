'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Braces,
  ClipboardPaste,
  GripVertical,
  Link2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DELTA_V,
  ITEM_KINDS,
  ROCKET,
  encodeTrip,
  panelPng,
  itemMassKg,
  parseTripInput,
  planTrip,
  sanitizeTrip,
  DEFAULT_TRIP,
  type ReturnMode,
  type TripConfig,
  type Unit,
  type ItemKind,
  type ItemLine,
  type Leg,
  type PanelLine,
  type PanelSection,
} from '@nara/lib'
import { ButtonGroup, CopyImageButton } from '@/components/ui'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Fuel for a Zorweth rocket trip. The maths lives in @nara/lib (rocket.ts),
 * tested against the server's LaunchHandler; this is only the form around it.
 */

/* `cs` is a compacted stack: 64 compacted items, whatever the item stacks to. */
type Row = { id: string; kind: ItemKind; amount: number; unit: Unit; note: string }
type LoadState = { players: number; rows: Row[] }
/** A split is anchored on whichever field was typed in last; the other is worked out. */
type Split = { anchor: 'bring' | 'have'; items: number }

const CHEST_SLOTS = 27
const DEFAULT_TITLE = 'Zorweth Rocket'
const cap = (place: string) => place[0].toUpperCase() + place.slice(1)
/* Random rather than a counter: a module-level counter restarts on hot reload
   while rows already in state keep their ids, and duplicate keys follow. */
const newId = () => crypto.randomUUID()

function unitsFor(kind: ItemKind): Unit[] {
  const { compactSize, maxStack } = ITEM_KINDS[kind]
  if (maxStack === 1) return ['items', 'chests']
  if (compactSize > 1) return ['items', 'cs', 'chests']
  return ['items', 'stacks', 'chests']
}

/** "1 stack", "2 stacks"; CS never pluralises. */
const unitLabel = (unit: Unit, n = 2) => (unit === 'cs' ? 'CS' : n === 1 ? unit.slice(0, -1) : unit)

function perUnit(kind: ItemKind, unit: Unit) {
  if (unit === 'items') return 1
  if (unit === 'cs') return 64
  if (unit === 'stacks') return ITEM_KINDS[kind].maxStack
  return ITEM_KINDS[kind].maxStack * CHEST_SLOTS
}

/** What the summary calls each kind, so "1 stack" says which stack. */
const KIND_TAG: Record<ItemKind, string> = {
  stack64: '(64)',
  stack16: '(16)',
  unstackable: '(unstackables)',
  compacted64: '',
  compacted16: '(16)',
  compactedUnstackable: '(unstackables)',
  rocketFuel: 'Rocket Fuel',
  crudeOil: 'crude oil',
}

/** "2 stacks (64)", "32 CI", "1 CS (16)", "9 items (unstackables)". */
function rowLabel(row: Row) {
  const compacted = ITEM_KINDS[row.kind].compactSize > 1
  const unit =
    compacted && row.unit === 'items'
      ? 'CI'
      : compacted && row.unit === 'chests'
        ? `${unitLabel(row.unit, row.amount)} of CI`
        : unitLabel(row.unit, row.amount)
  return [count(row.amount), unit, KIND_TAG[row.kind]].filter(Boolean).join(' ')
}

const rowLine = (row: Row): ItemLine => ({
  kind: row.kind,
  count: row.amount * perUnit(row.kind, row.unit),
})
const toLines = (load: LoadState) => load.rows.map(rowLine)

const kg = (n: number) => `${n.toLocaleString('en', { maximumFractionDigits: n < 10 ? 2 : 1 })} kg`
const count = (n: number) => n.toLocaleString('en')

/** "14 stacks + 46" */
function stacksOf(n: number) {
  const stacks = Math.floor(n / 64)
  const rest = n % 64
  if (stacks === 0) return `${count(n)} ${n === 1 ? 'item' : 'items'}`
  return `${stacks} ${stacks === 1 ? 'stack' : 'stacks'}${rest ? ` + ${rest}` : ''}`
}

const STORAGE_KEY = 'rocket-calculator'
const withoutId = ({ kind, amount, unit, note }: Row) => ({ kind, amount, unit, note })

export function RocketCalculator() {
  const [roundTrip, setRoundTrip] = useState(true)
  const [returnMode, setReturnMode] = useState<ReturnMode>('carry')
  const [split, setSplit] = useState<Split>({ anchor: 'bring', items: 0 })
  const [outbound, setOutbound] = useState<LoadState>({ players: 1, rows: [] })
  const [inbound, setInbound] = useState<LoadState>({ players: 1, rows: [] })
  const [fuelInComputer, setFuelInComputer] = useState(0)
  const [start, setStart] = useState<'main' | 'Zorweth'>('main')
  const [deltaToZorweth, setDeltaToZorweth] = useState<number>(DELTA_V.toZorweth)
  const [deltaToMain, setDeltaToMain] = useState<number>(DELTA_V.toMain)
  const [marginPct, setMarginPct] = useState(DEFAULT_TRIP.marginPct)
  const [title, setTitle] = useState('')

  const snapshot = (): TripConfig => ({
    start,
    roundTrip,
    returnMode,
    split,
    outbound: { players: outbound.players, rows: outbound.rows.map(withoutId) },
    inbound: { players: inbound.players, rows: inbound.rows.map(withoutId) },
    fuelInComputer,
    deltaToZorweth,
    deltaToMain,
    marginPct,
    title,
  })
  /* Always sanitized: a config comes from storage, pasted JSON or a shared link. */
  const apply = (raw: unknown) => {
    const c = sanitizeTrip(raw)
    const withIds = (load: TripConfig['outbound']) => ({
      players: load.players,
      rows: load.rows.map((row) => ({ ...row, id: newId() })),
    })
    setStart(c.start)
    setRoundTrip(c.roundTrip)
    setReturnMode(c.returnMode)
    setSplit(c.split)
    setOutbound(withIds(c.outbound))
    setInbound(withIds(c.inbound))
    setFuelInComputer(c.fuelInComputer)
    setDeltaToZorweth(c.deltaToZorweth)
    setDeltaToMain(c.deltaToMain)
    setMarginPct(c.marginPct)
    setTitle(c.title)
  }

  /* After hydration (the page is static): a shared link wins over the last session. The
     hash is then cleared, so later edits are not mistaken for the shared trip. */
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    let alive = true
    const hash = window.location.hash
    ;(async () => {
      const shared = /^#t=[\w-]+$/.test(hash) ? await parseTripInput(hash) : null
      if (!alive) return
      if (shared) {
        apply(shared)
        window.history.replaceState(null, '', window.location.pathname)
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) apply(JSON.parse(saved))
        } catch {
          /* Blocked storage or unreadable JSON: start fresh. */
        }
      }
      setRestored(true)
    })()
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
    } catch {}
    // snapshot() reads exactly these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restored,
    roundTrip,
    returnMode,
    split,
    outbound,
    inbound,
    fuelInComputer,
    start,
    deltaToZorweth,
    deltaToMain,
    marginPct,
    title,
  ])

  const splitKg = split.items * ROCKET.fuelItemKg
  const plan = planTrip({
    outbound: { players: outbound.players, items: toLines(outbound) },
    inbound: roundTrip ? { players: inbound.players, items: toLines(inbound) } : undefined,
    returnFuel:
      returnMode === 'carry'
        ? { atDestinationKg: 0 }
        : returnMode === 'refuel'
          ? { bringKg: 0 }
          : split.anchor === 'bring'
            ? { bringKg: splitKg }
            : { atDestinationKg: splitKg },
    fuelInComputerKg: fuelInComputer,
    deltaV:
      start === 'main'
        ? { out: deltaToZorweth, back: deltaToMain }
        : { out: deltaToMain, back: deltaToZorweth },
    margin: marginPct / 100,
  })

  const [out, back] = plan.legs
  /* Where the trip starts and where it goes; "main" stays lower-case mid-sentence. */
  const away = start === 'main' ? 'Zorweth' : 'main'
  const returnLabels: Record<ReturnMode, string> = {
    carry: 'Bring all',
    split: 'Split',
    refuel: `Fill on ${cap(away)}`,
  }
  const bringItems =
    split.anchor === 'bring' ? split.items : Math.ceil(plan.carriedKg / ROCKET.fuelItemKg)
  const haveItems = split.anchor === 'have' ? split.items : plan.loadAtDestinationItems

  const tripSection: PanelSection = {
    heading: roundTrip
      ? `Round trip · ${returnMode === 'carry' ? 'bring all fuel with you' : returnLabels[returnMode].toLowerCase()}`
      : 'One way',
    stats: [
      ['Total Fuel', `${count(plan.loadAtStartItems + plan.loadAtDestinationItems)} Rocket Fuel`],
      ['Rocket uses', `${plan.legs.length} of ${ROCKET.maxUses}`],
    ],
  }
  const outSection = legSection(
    `${cap(start)} → ${cap(away)} · load on ${start}`,
    plan.loadAtStartItems,
    out,
    outbound,
  )
  const backSection =
    back &&
    legSection(
      `${cap(away)} → ${cap(start)} · fill on ${away}`,
      plan.loadAtDestinationItems,
      back,
      inbound,
      plan.loadAtDestinationItems === 0 ? 'Enough left from the way there.' : undefined,
    )

  return (
    <div className="divide-y divide-edge overflow-clip rounded-xl border border-edge bg-surface">
      {/* ── Trip ── */}
      <RowLayout
        summary={
          <div className="flex flex-col gap-2">
            <label htmlFor="trip-title" className="sr-only">
              Title
            </label>
            <input
              id="trip-title"
              type="text"
              value={title}
              maxLength={60}
              placeholder={DEFAULT_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-edge bg-ground px-2 py-1 text-sm font-semibold text-white placeholder:font-normal placeholder:text-ink-3"
            />
            <Stats stats={tripSection.stats} />
            <CopyImageButton
              label="Copy summary as image"
              name={title.trim() || DEFAULT_TITLE}
              png={() =>
                panelPng(title.trim() || DEFAULT_TITLE, [
                  tripSection,
                  outSection,
                  ...(backSection ? [backSection] : []),
                ])
              }
            />
            <ShareControls
              link={async () =>
                `${window.location.origin}${window.location.pathname}#t=${await encodeTrip(snapshot())}`
              }
              json={() => JSON.stringify(snapshot(), null, 2)}
              onImport={apply}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Trip Options</h2>
          <ButtonGroup
            showLabel
            mobileSelect
            size="sm"
            label="Start"
            value={start}
            onChange={setStart}
            options={[
              ['main', 'Main'],
              ['Zorweth', 'Zorweth'],
            ]}
          />
          <ButtonGroup
            showLabel
            mobileSelect
            size="sm"
            label="Journey"
            value={roundTrip ? 'round' : 'one'}
            onChange={(v) => setRoundTrip(v === 'round')}
            options={[
              ['one', 'One way'],
              ['round', 'Round trip'],
            ]}
          />
          {roundTrip && (
            <ButtonGroup
              showLabel
              mobileSelect
              size="sm"
              label="Fuel home"
              value={returnMode}
              onChange={setReturnMode}
              options={Object.entries(returnLabels) as [ReturnMode, string][]}
            />
          )}
          {roundTrip && returnMode === 'split' && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-28">
              <InlineNumber
                label={`Bring from ${start}`}
                suffix="Rocket Fuel"
                value={bringItems}
                onChange={(items) => setSplit({ anchor: 'bring', items })}
                computed={split.anchor !== 'bring'}
              />
              <InlineNumber
                label={`Fill on ${cap(away)}`}
                suffix="Rocket Fuel"
                value={haveItems}
                onChange={(items) => setSplit({ anchor: 'have', items })}
                computed={split.anchor !== 'have'}
              />
              <span className="text-xs text-ink-2">
                Type in either; the dashed one is worked out.
              </span>
            </div>
          )}
        </div>
      </RowLayout>

      {/* ── Legs ── */}
      <LoadEditor
        title={`${cap(start)} → ${cap(away)}`}
        load={outbound}
        onChange={setOutbound}
        leg={out}
        summary={<LegSummary section={outSection} />}
      />
      {roundTrip && back && (
        <LoadEditor
          title={`${cap(away)} → ${cap(start)}`}
          load={inbound}
          onChange={setInbound}
          leg={back}
          action={
            <button
              type="button"
              onClick={() =>
                setInbound({
                  players: outbound.players,
                  rows: outbound.rows.map((row) => ({ ...row, id: newId() })),
                })
              }
              className="inline-flex items-center gap-1 rounded-full border border-edge px-3 py-1 text-sm text-ink-2 transition-colors hover:border-primary hover:text-white"
            >
              <ArrowRight aria-hidden className="size-3" /> Same as the way there
            </button>
          }
          summary={backSection && <LegSummary section={backSection} />}
        />
      )}

      {/* ── Advanced ── */}
      <details>
        <summary className="cursor-pointer px-5 py-3 text-lg font-bold text-white">
          Advanced
        </summary>
        <div className="flex flex-wrap gap-x-6 gap-y-3 px-5 pb-4">
          <InlineNumber
            label="Fuel already in computer"
            suffix="kg"
            value={fuelInComputer}
            onChange={setFuelInComputer}
            step={0.1}
          />
          <InlineNumber
            label="Safety margin"
            suffix="%"
            value={marginPct}
            onChange={setMarginPct}
          />
          <InlineNumber
            label="Δv to Zorweth"
            suffix="m/s"
            value={deltaToZorweth}
            onChange={setDeltaToZorweth}
            step={100}
          />
          <InlineNumber
            label="Δv to main"
            suffix="m/s"
            value={deltaToMain}
            onChange={setDeltaToMain}
            step={100}
          />
        </div>
      </details>
    </div>
  )
}

/* ── Sharing ──────────────────────────────────────────── */

/** Copy the trip as a link or JSON; load one pasted back in. */
function ShareControls({
  link,
  json,
  onImport,
}: {
  link: () => Promise<string>
  json: () => string
  onImport: (config: TripConfig) => void
}) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  const copy = async (what: string, text: Promise<string> | string) => {
    try {
      await navigator.clipboard.writeText(await text)
      setStatus(`${what} copied`)
    } catch (e) {
      console.warn('[nara] Copying to the clipboard failed.', e)
      setStatus(`Could not copy the ${what.toLowerCase()}`)
    }
    setTimeout(() => setStatus(''), 2000)
  }
  const button =
    'inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-edge px-2 py-1 text-xs text-ink-2 transition-colors hover:border-primary hover:text-white'

  return (
    <>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => copy('Link', link())} className={button}>
          <Link2 aria-hidden className="size-3" /> Link
        </button>
        <button type="button" onClick={() => copy('JSON', json())} className={button}>
          <Braces aria-hidden className="size-3" /> JSON
        </button>
        <button
          type="button"
          onClick={() => {
            setError('')
            dialog.current?.showModal()
          }}
          className={button}
        >
          <ClipboardPaste aria-hidden className="size-3" /> Import
        </button>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs text-ink-2">
        {status}
      </p>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[90%] max-w-md rounded-xl border border-edge bg-surface p-4 text-ink backdrop:bg-black/60"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            const config = await parseTripInput(String(new FormData(form).get('trip') ?? ''))
            if (!config) return setError('That is not a rocket trip link or JSON.')
            onImport(config)
            form.reset()
            dialog.current?.close()
          }}
          className="flex flex-col gap-3"
        >
          <h2 id={`${id}-title`} className="font-bold text-white">
            Import a trip
          </h2>
          <label htmlFor={`${id}-input`} className="text-sm text-ink-2">
            Paste a shared link or JSON. It replaces the current trip.
          </label>
          <textarea
            id={`${id}-input`}
            name="trip"
            rows={6}
            required
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="w-full rounded-md border border-edge bg-ground p-2 font-mono text-xs text-white"
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-md border border-edge px-3 py-1 text-sm text-ink-2 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-ground"
            >
              Load trip
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

/* ── Layout ───────────────────────────────────────────── */

/** Inputs on the left, that row's summary on the right; stacked on phones. */
function RowLayout({ children, summary }: { children: ReactNode; summary: ReactNode }) {
  return (
    <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 px-5 py-4">{children}</div>
      <div className="border-t border-edge bg-ground/40 px-4 py-3 text-sm lg:border-t-0 lg:border-l">
        {summary}
      </div>
    </section>
  )
}

function legSection(
  heading: string,
  fuel: number,
  leg: Leg,
  load: LoadState,
  note?: string,
): PanelSection {
  const players = Math.max(1, load.players)
  return {
    heading,
    figure: [count(fuel), 'Rocket Fuel'],
    sub: note ?? `${stacksOf(fuel)} · ${kg(fuel * ROCKET.fuelItemKg)}`,
    lines: [
      { label: `${players} ${players === 1 ? 'player' : 'players'}`, value: kg(leg.playerKg) },
      ...load.rows
        .filter((row) => row.amount > 0)
        .map((row) => ({
          label: rowLabel(row),
          note: row.note.trim() || undefined,
          value: kg(itemMassKg(rowLine(row))),
        })),
      { label: 'Players + items', value: kg(leg.playerKg + leg.cargoKg), strong: true },
    ],
    stats: [],
  }
}

function LegSummary({ section }: { section: PanelSection }) {
  /* The image carries the leg name; the panel row already shows it on the left. */
  const action = section.heading.split(' · ').at(-1)!
  const [figure, unit] = section.figure ?? []
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-primary">
          {action[0].toUpperCase() + action.slice(1)}
        </span>
        <span
          aria-live="polite"
          className="text-2xl leading-none font-bold text-white tabular-nums"
        >
          {figure}
          <span className="ml-1 text-xs font-medium text-ink-2">{unit}</span>
        </span>
      </div>
      <p className="-mt-1 text-right text-xs text-ink-2">{section.sub}</p>
      {/* text-xs on the li themselves: the site's base `main li` font size would
          otherwise beat an inherited one. */}
      <ul className="flex flex-col gap-0.5 border-t border-edge pt-2 text-ink-2">
        {section.lines?.map((line, i) => (
          <SummaryLine key={i} line={line} />
        ))}
      </ul>
    </div>
  )
}

function Stats({ stats }: { stats: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
      {stats.map(([label, value]) => (
        <Stat key={label} label={label} value={value} />
      ))}
    </dl>
  )
}

function SummaryLine({ line }: { line: PanelLine }) {
  return (
    <li
      className={`flex justify-between gap-2 text-xs leading-snug ${
        line.strong ? 'mt-0.5 border-t border-edge/60 pt-1 font-semibold text-white' : ''
      }`}
    >
      <span className="min-w-0 truncate">
        {line.label}
        {line.note && <span className="text-ink-3"> · {line.note}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{line.value}</span>
    </li>
  )
}

/* ── Load editor ──────────────────────────────────────── */

function LoadEditor({
  title,
  load,
  onChange,
  leg,
  action,
  summary,
}: {
  title: string
  load: LoadState
  onChange: (load: LoadState) => void
  leg: Leg
  action?: ReactNode
  summary: ReactNode
}) {
  const setRow = (id: string, patch: Partial<Row>) =>
    onChange({
      ...load,
      rows: load.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  /* dnd-kit announces ids by default, which here are UUIDs. */
  const name = (id: UniqueIdentifier) => {
    const index = load.rows.findIndex((row) => row.id === id)
    const row = load.rows[index]
    return row ? `${rowLabel(row)}${row.note.trim() ? `, ${row.note.trim()}` : ''}` : 'item'
  }
  const position = (id: UniqueIdentifier) =>
    `position ${load.rows.findIndex((row) => row.id === id) + 1} of ${load.rows.length}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}, ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} moved to ${position(over.id)}.`
        : `${name(active.id)} is not over a row.`,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${name(active.id)} at ${position(over.id)}.` : `Dropped ${name(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelled. ${name(active.id)} stays where it was.`,
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = load.rows.map((row) => row.id)
    onChange({
      ...load,
      rows: arrayMove(load.rows, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    })
  }
  const addRow = () =>
    onChange({
      ...load,
      rows: [...load.rows, { id: newId(), kind: 'stack64', amount: 1, unit: 'stacks', note: '' }],
    })
  const over = leg.slots > leg.slotCapacity

  return (
    <RowLayout summary={summary}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {action}
        </div>
        <Stepper value={load.players} onChange={(players) => onChange({ ...load, players })} />

        {load.rows.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{ announcements }}
          >
            <SortableContext items={load.rows} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {load.rows.map((row) => (
                  <ItemRow
                    key={row.id}
                    row={row}
                    onChange={(patch) => setRow(row.id, patch)}
                    onRemove={() =>
                      onChange({ ...load, rows: load.rows.filter((r) => r.id !== row.id) })
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 self-start rounded-full border border-edge px-3 py-1 text-sm text-ink-2 transition-colors hover:border-primary hover:text-white"
        >
          <Plus aria-hidden className="size-3" /> Add items
        </button>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
          <span>
            Cargo <strong className="text-white">{kg(leg.cargoKg)}</strong>
          </span>
          <span>
            Players <strong className="text-white">{kg(leg.playerKg)}</strong>
          </span>
          <span className={over ? 'flex items-center gap-1 text-danger' : ''}>
            {over && <AlertTriangle aria-hidden className="size-3" />}
            Slots{' '}
            <strong className={over ? 'text-danger' : 'text-white'}>
              {count(leg.slots)} / {count(leg.slotCapacity)}
            </strong>
            {over && ' — more than the chests and inventories hold'}
          </span>
        </div>
      </div>
    </RowLayout>
  )
}

/**
 * Reordered from the grip by @dnd-kit: mouse, touch (which native drag and drop
 * never supported on phones) and the keyboard — Space to lift, arrows to move,
 * Space to drop — with screen-reader announcements.
 */
function ItemRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}) {
  const id = useId()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })
  const control = 'rounded-md border border-edge bg-ground px-2 py-1 text-sm text-white'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex flex-wrap items-center gap-2 rounded-md ${
        isDragging ? 'z-10 opacity-60' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Reorder"
        className="cursor-grab touch-none rounded p-0.5 text-ink-2 transition-colors hover:text-white active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <label htmlFor={`${id}-amount`} className="sr-only">
        Amount
      </label>
      <input
        id={`${id}-amount`}
        type="number"
        min={0}
        value={row.amount}
        onChange={(e) => onChange({ amount: Math.max(0, Number(e.target.value) || 0) })}
        className={`w-16 ${control}`}
      />
      <label htmlFor={`${id}-unit`} className="sr-only">
        Unit
      </label>
      <select
        id={`${id}-unit`}
        value={row.unit}
        onChange={(e) => onChange({ unit: e.target.value as Unit })}
        className={control}
      >
        {unitsFor(row.kind).map((unit) => (
          <option key={unit} value={unit}>
            {unitLabel(unit)}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-kind`} className="sr-only">
        Item type
      </label>
      <select
        id={`${id}-kind`}
        value={row.kind}
        onChange={(e) => {
          const kind = e.target.value as ItemKind
          const units = unitsFor(kind)
          /* Keep "a stack" meaning a stack when switching to or from compacted. */
          const swapped = row.unit === 'stacks' ? 'cs' : row.unit === 'cs' ? 'stacks' : row.unit
          const unit = units.includes(row.unit)
            ? row.unit
            : units.includes(swapped)
              ? swapped
              : 'items'
          onChange({ kind, unit })
        }}
        className={`min-w-0 flex-1 ${control}`}
      >
        {(Object.keys(ITEM_KINDS) as ItemKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {ITEM_KINDS[kind].label}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-note`} className="sr-only">
        Label
      </label>
      <input
        id={`${id}-note`}
        type="text"
        value={row.note}
        maxLength={40}
        placeholder="Label"
        onChange={(e) => onChange({ note: e.target.value })}
        className={`w-32 ${control} placeholder:text-ink-3`}
      />
      <span className="w-20 text-right text-xs text-ink-2 tabular-nums">
        {kg(itemMassKg(rowLine(row)))}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove these items"
        className="rounded p-1 text-ink-2 transition-colors hover:bg-surface-2 hover:text-danger"
      >
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </li>
  )
}

/* ── Controls ─────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] leading-tight text-ink-2">{label}</dt>
      <dd className="text-sm font-semibold text-white tabular-nums">{value}</dd>
    </div>
  )
}

/** Seated players; the pilot always counts, so never below 1. */
function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId()
  const button =
    'rounded-md border border-edge p-1 text-ink transition-colors hover:border-primary disabled:opacity-40'
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="w-24 shrink-0 text-sm text-ink-2 sm:w-28">
        Players
      </label>
      <button
        type="button"
        aria-label="One fewer player"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        <Minus aria-hidden className="size-3.5" />
      </button>
      <input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
        className="w-14 rounded-md border border-edge bg-ground px-1 py-1 text-center text-sm text-white"
      />
      <button
        type="button"
        aria-label="One more player"
        onClick={() => onChange(value + 1)}
        className={button}
      >
        <Plus aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

function InlineNumber({
  label,
  suffix,
  value,
  onChange,
  step = 1,
  computed = false,
}: {
  label: string
  suffix: string
  value: number
  onChange: (value: number) => void
  step?: number
  /** Shown as a worked-out value; typing in it still takes over. */
  computed?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`w-24 rounded-md border px-2 py-1 text-sm text-white ${
          computed ? 'border-dashed border-primary/60 bg-ground/40' : 'border-edge bg-ground'
        }`}
      />
      <span className="text-sm text-ink-2">{suffix}</span>
    </div>
  )
}

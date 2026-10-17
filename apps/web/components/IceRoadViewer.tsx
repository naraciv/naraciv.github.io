'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Braces,
  Code,
  Download,
  FileDown,
  Check,
  Link2,
  Merge,
  PencilRuler,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  decodeLayers,
  encodeLayers,
  layerLength,
  mergeGroups,
  mergeLayers,
  moveSection,
  parseIceFile,
  planImport,
  type IceLayer,
  type IceSection,
  type ImportPlan,
} from '@nara/lib'
import { Switch } from '@/components/ui'
import { MapSidePanel } from '@/components/map/MapSidePanel'

/**
 * Load ice road groups (JSON from the JSMacros mapper, a share link, or another player),
 * merge them, rearrange them, and see them on the map. A group is one road network; in the
 * JSON they sit under "layers". Everything stays in the browser, kept in localStorage.
 */

const IceRoadMap = dynamic(() => import('./IceRoadMap'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center rounded-lg bg-[#1a1a1a] text-xs text-ink-3">
      Loading map…
    </div>
  ),
})

const LAYERS_KEY = 'iceroads-layers'
const HIDDEN_KEY = 'iceroads-hidden'
const PALETTE = [
  '#38bdf8',
  '#f472b6',
  '#facc15',
  '#4ade80',
  '#fb923c',
  '#a78bfa',
  '#f87171',
  '#2dd4bf',
]
const STATUS_LABEL = {
  new: 'New',
  update: 'Update - newer',
  same: 'Already loaded',
  older: 'Older than yours',
} as const

const EXAMPLE = `{
  "version": 2,
  "layers": [
    {
      "id": "nara",
      "name": "Nara Iceroads",
      "updated": 1760486400000,
      "color": "#38bdf8",
      "paths": [
        [[120, 350], [600, 350], [600, 1200]],
        [[600, 350], [600, -900], [1800, -1500]]
      ]
    }
  ]
}`

const LLM_PROMPT = `Convert the data I give you into this JSON format for an ice road network map:

${EXAMPLE}

Rules:
- Each entry in "layers" is a group: one road network. "paths" is an unordered list of polylines that together make up the network; they may join, branch, cross and overlap. Each path is a list of points in order along the road. Split the roads into paths however is convenient.
- Only "paths" is required. Leave out any other field you do not know rather than inventing it.
- "version": 2. "layers" is the array of groups; a single group object (with "paths") or a bare array of paths is also accepted.
- "id": optional stable identifier of the group (lowercase, e.g. a slug of the name). Groups with the same id merge.
- "name": optional display name, max 80 characters. Unnamed groups are called "Imported Group N".
- "updated": optional, when the group was last mapped, in milliseconds since the Unix epoch (an ISO date string is also accepted). Missing means "now".
- "color": optional "#rrggbb". Leave it out to let the map pick one.
- Points are overworld block coordinates [x, z] (or {"x": .., "z": ..}) as whole numbers between -30000 and 30000. A path needs at least 2 points or it is dropped. Only the corners matter: points along a straight line can be left out.
- At most 20000 paths per group and 20000 points per path.

Output only the JSON.`

const button =
  'flex w-full items-center justify-center gap-1.5 rounded-md border border-edge px-2 py-1.5 text-xs text-ink-2 transition-colors hover:border-primary hover:text-white'
/* Dropdowns and text boxes, and small icon buttons: one look everywhere in the panel. */
const field = 'rounded border border-[#374151] bg-ground px-1.5 py-1 text-xs text-white'
const iconButton =
  'rounded p-1 text-ink-2 transition-colors hover:bg-[#374151] hover:text-white disabled:opacity-40'
const dialogClass =
  'm-auto w-[90%] max-w-md rounded-xl border border-edge bg-surface p-4 text-ink backdrop:bg-black/60'

const readStored = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}
const writeStored = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked or full: layers just won't survive a reload */
  }
}
/* Give new groups a colour of their own, so deleting one never repaints the rest. */
const withColors = (groups: IceLayer[]) => {
  const used = new Set(groups.map((l) => l.color))
  return groups.map((l, i) => {
    if (l.color) return l
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[i % PALETTE.length]
    used.add(color)
    return { ...l, color }
  })
}
const merge = (existing: IceLayer[], incoming: IceLayer[]) =>
  withColors(mergeLayers(existing, incoming))
const NEW_GROUP = '\u0000new'
/* "Updated 10/14/26", in the reader's own date order (14/10/26 in the EU). */
const updatedLabel = (ms: number) =>
  `Updated ${new Date(ms).toLocaleDateString(undefined, { year: '2-digit', month: '2-digit', day: '2-digit' })}`
/* The exact moment, in the reader's own time zone. */
const exactTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })
const blocks = (layer: IceLayer) => {
  const n = layerLength(layer)
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k blocks` : `${Math.round(n)} blocks`
}
const copyText = async (text: string) => navigator.clipboard.writeText(text)

export function IceRoadViewer() {
  const [layers, setLayers] = useState<IceLayer[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [claims, setClaims] = useState(true)
  /* Modify mode: click a section on the map, then move it; or merge whole groups. */
  const [modifying, setModifying] = useState(false)
  const [selected, setSelected] = useState<IceSection | null>(null)
  const [moveTo, setMoveTo] = useState(NEW_GROUP)
  const [newName, setNewName] = useState('')
  /* The group whose merge row is open, and the group chosen to merge into it. */
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [mergeWith, setMergeWith] = useState('')
  /* What just happened, and the groups as they were before it, if it can be undone. */
  const [notice, setNotice] = useState<{ text: string; undo?: IceLayer[] } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [error, setError] = useState('')
  const [promptCopied, setPromptCopied] = useState('')
  const [pending, setPending] = useState<ImportPlan | null>(null)
  /* Indexes into pending: one file can hold two versions of the same group id. */
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const input = useRef<HTMLInputElement>(null)
  const importDialog = useRef<HTMLDialogElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  /* The document drop handler and hash import are registered once, so they read this. */
  const layersRef = useRef(layers)
  useEffect(() => {
    layersRef.current = layers
  })

  const notify = (text: string, undo?: IceLayer[]) => {
    setError('')
    setNotice({ text, undo })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), undo ? 8000 : 2500)
  }
  /* Every change to the groups goes through here, so each one can be undone. */
  const change = (next: IceLayer[], text: string) => {
    notify(text, layersRef.current)
    setLayers(next)
  }
  const undo = () => {
    if (!notice?.undo) return
    setLayers(notice.undo)
    setSelected(null)
    setMergingId(null)
    notify('Undone')
  }
  const copied = (text: string) => {
    setPromptCopied(text)
    setTimeout(() => setPromptCopied(''), 2000)
  }

  /* Escape backs out of whatever is half-done in Modify. */
  useEffect(() => {
    if (!modifying) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSelected(null)
      setMergingId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modifying])

  /* Merge straight away when it is one group that changes something, otherwise ask. */
  const startImport = (incoming: IceLayer[]) => {
    setError('')
    const plan = planImport(layersRef.current, incoming)
    if (!plan.length) return setError('No ice roads found in that data.')
    if (plan.length === 1) {
      if (plan[0].status === 'same') return notify('Already loaded')
      return change(merge(layersRef.current, [plan[0].layer]), 'Group imported')
    }
    setChecked(
      new Set(plan.flatMap((p, i) => (p.status === 'new' || p.status === 'update' ? [i] : []))),
    )
    setPending(plan)
  }

  const loadFile = async (file: File) => {
    try {
      startImport(parseIceFile(JSON.parse(await file.text())))
    } catch {
      setError('That file is not valid JSON.')
    }
  }

  /* After hydration: stored layers, then a layer set shared in the URL. */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLayers(parseIceFile(readStored(LAYERS_KEY)))
    const ids = readStored(HIDDEN_KEY)
    if (Array.isArray(ids)) setHidden(new Set(ids.map(String)))
    setLoaded(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    const code = /^#d=(.+)$/.exec(window.location.hash)?.[1]
    if (!code) return
    history.replaceState(null, '', window.location.pathname + window.location.search)
    decodeLayers(code).then((shared) =>
      shared?.length
        ? /* wait a tick so layersRef holds the stored layers */
          setTimeout(() => startImport(shared))
        : setError('That share link could not be read.'),
    )
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded) return
    writeStored(LAYERS_KEY, { version: 2, layers })
    writeStored(HIDDEN_KEY, [...hidden])
  }, [layers, hidden, loaded])

  /* Accept a file dropped anywhere on the page. */
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (file) loadFile(file)
    }
    document.addEventListener('dragover', over)
    document.addEventListener('drop', drop)
    return () => {
      document.removeEventListener('dragover', over)
      document.removeEventListener('drop', drop)
    }
    // Mount only: loadFile reads layers through layersRef, so it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pending) importDialog.current?.showModal()
    else importDialog.current?.close()
  }, [pending])

  const visible = useMemo(() => layers.filter((l) => !hidden.has(l.id)), [layers, hidden])

  const share = async () => {
    try {
      const code = await encodeLayers(visible)
      await copyText(`${window.location.origin}${window.location.pathname}#d=${code}`)
      notify('Link copied')
    } catch (e) {
      console.warn('[nara] Copying to the clipboard failed.', e)
      notify('Could not copy the link')
    }
  }

  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 2, layers }, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'iceroads.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sourceOf = (section: IceSection) => layers.find((l) => l.id === section.id)
  const sectionLength = (section: IceSection) => {
    const path = sourceOf(section)?.paths[section.path]
    const [a, b] = [path?.[section.segment], path?.[section.segment + 1]]
    return a && b ? Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])) : 0
  }
  const move = () => {
    if (!selected) return
    const to = moveTo === NEW_GROUP ? { name: newName } : moveTo
    change(withColors(moveSection(layers, selected, to)), 'Section moved')
    setSelected(null)
    setNewName('')
  }
  const mergeInto = (id: string) => {
    change(mergeGroups(layers, mergeWith, id), 'Groups merged')
    setMergingId(null)
  }

  const statusBar = (notice || error) && (
    <section
      role={error ? 'alert' : 'status'}
      className="flex items-center gap-2 px-3 py-2 text-xs"
    >
      <span className={`flex-1 ${error ? 'text-danger' : 'text-ink-2'}`}>
        {error || notice?.text}
      </span>
      {!error && notice?.undo && (
        <button type="button" onClick={undo} className="font-semibold text-primary hover:underline">
          Undo
        </button>
      )}
    </section>
  )

  const recolor = (id: string, color: string) =>
    setLayers(layers.map((l) => (l.id === id ? { ...l, color } : l)))
  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (!next.delete(id)) next.add(id)
    setHidden(next)
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) loadFile(file)
          e.target.value = ''
        }}
      />

      {/* ── Map, full width, with the panel floating over it (stacked above it on phones) ── */}
      <div className="flex flex-col gap-3 lg:relative lg:block">
        <MapSidePanel label="ice road panel">
          <section className="flex flex-col gap-3 p-3">
            <h2 className="text-sm font-semibold text-white">Settings</h2>
            <Switch className="text-xs" label="Claims map" checked={claims} onChange={setClaims} />
            <div className="grid grid-cols-3 gap-2">
              <Tool
                Icon={Link2}
                label="Share"
                onClick={share}
                disabled={!visible.length}
                why="Show at least one group to share a link"
              />
              <Tool
                Icon={Download}
                label="Export"
                onClick={exportJson}
                disabled={!layers.length}
                why="Nothing to export yet"
              />
              <ConfirmButton
                label={`Delete all ${layers.length} groups`}
                confirmLabel="Sure?"
                disabled={!layers.length}
                onConfirm={() => change([], `Cleared ${layers.length} groups`)}
                className={`${button} disabled:opacity-40`}
              >
                <Trash2 aria-hidden className="size-4" /> Clear
              </ConfirmButton>
            </div>
            {/* Same columns as the row above: script spans two, format sits under Clear. */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href="/iceroads/iceroadMapper.js"
                download
                title="Download JSMacros script"
                className={`${button} col-span-2`}
              >
                <FileDown aria-hidden className="size-4" /> JSMacros script
              </a>
              <button
                type="button"
                title="JSON format"
                onClick={() => helpDialog.current?.showModal()}
                className={`${button} text-center leading-tight`}
              >
                <Braces aria-hidden className="size-4 shrink-0" /> JSON format
              </button>
            </div>
            <button
              type="button"
              aria-pressed={modifying}
              disabled={!layers.length}
              title={layers.length ? undefined : 'Upload a group first'}
              onClick={() => {
                setModifying(!modifying)
                setSelected(null)
                setMergingId(null)
              }}
              className={`${button} disabled:opacity-40 ${modifying ? 'border-primary! text-white!' : ''}`}
            >
              <PencilRuler aria-hidden className="size-4" />
              {modifying ? 'Done modifying' : 'Modify ice roads'}
            </button>
          </section>
          {statusBar}
          {modifying && (
            <section className="flex flex-col gap-3 p-3 text-xs">
              <h2 className="text-sm font-semibold text-white">Modify</h2>
              {selected && sourceOf(selected) ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-ink-2">
                    Selected: {sectionLength(selected)} blocks of{' '}
                    <span className="text-white">{sourceOf(selected)!.name}</span>
                  </p>
                  <label className="flex items-center gap-2 text-ink-2">
                    Move to
                    <select
                      value={moveTo}
                      onChange={(e) => setMoveTo(e.target.value)}
                      className={`${field} min-w-0 flex-1`}
                    >
                      {layers
                        .filter((l) => l.id !== selected.id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      <option value={NEW_GROUP}>New group…</option>
                    </select>
                  </label>
                  {moveTo === NEW_GROUP && (
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="New group name"
                      aria-label="New group name"
                      maxLength={80}
                      className={field}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSelected(null)} className={button}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={move}
                      disabled={moveTo === NEW_GROUP && !newName.trim()}
                      className={`${button} disabled:opacity-40`}
                    >
                      Move section
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-3">
                  Click a straight or diagonal section of road on the map to select it.
                </p>
              )}
            </section>
          )}
          {!modifying && (
            <section className="flex flex-col gap-2 p-3">
              <h2 className="text-sm font-semibold text-white">Upload</h2>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex flex-col items-center gap-1 rounded-md border-2 border-dashed border-[#374151] p-3 text-sm text-ink-2 transition-colors hover:border-primary hover:text-white"
              >
                <Upload aria-hidden className="size-5" />
                Upload groups
                <span className="text-xs text-ink-3">or drop a .json file anywhere</span>
              </button>
            </section>
          )}
          <section className="flex min-h-0 flex-col gap-2 p-3">
            <h2 className="text-sm font-semibold text-white">Groups</h2>
            {layers.length ? (
              <ul className="custom-scroll -mx-1 max-h-[40vh] min-h-0 overflow-y-auto lg:max-h-none">
                {layers.map((layer) => (
                  <li
                    key={layer.id}
                    className="flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-xs"
                  >
                    <input
                      type="color"
                      value={layer.color}
                      aria-label={`Colour of ${layer.name}`}
                      onChange={(e) => recolor(layer.id, e.target.value)}
                      className="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="checkbox"
                      checked={!hidden.has(layer.id)}
                      aria-label={`Show ${layer.name}`}
                      onChange={() => toggle(layer.id)}
                      className="shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <GroupName
                        name={layer.name}
                        onRename={(name) =>
                          setLayers(layers.map((l) => (l.id === layer.id ? { ...l, name } : l)))
                        }
                      />
                      <span className="block text-ink-3">
                        {blocks(layer)} ·{' '}
                        <time
                          dateTime={new Date(layer.updated).toISOString()}
                          title={exactTime(layer.updated)}
                        >
                          {updatedLabel(layer.updated)}
                        </time>
                      </span>
                    </span>
                    {modifying && layers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Merge another group into ${layer.name}`}
                        title="Merge another group into this one"
                        aria-expanded={mergingId === layer.id}
                        onClick={() => {
                          setMergingId(mergingId === layer.id ? null : layer.id)
                          setMergeWith(layers.find((l) => l.id !== layer.id)!.id)
                        }}
                        className={`${iconButton} ${mergingId === layer.id ? 'bg-[#374151] text-white' : ''}`}
                      >
                        <Merge aria-hidden className="size-4" />
                      </button>
                    )}
                    <ConfirmButton
                      label={`Delete ${layer.name}`}
                      confirmLabel="Delete?"
                      onConfirm={() =>
                        change(
                          layers.filter((l) => l.id !== layer.id),
                          `Deleted ${layer.name}`,
                        )
                      }
                      className={`${iconButton} hover:text-danger!`}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </ConfirmButton>
                    {modifying && mergingId === layer.id && (
                      <div className="flex basis-full items-center gap-2 pl-12">
                        <span className="text-ink-3">Merge in</span>
                        <select
                          value={mergeWith}
                          onChange={(e) => setMergeWith(e.target.value)}
                          aria-label={`Group to merge into ${layer.name}`}
                          className={`${field} min-w-0 flex-1`}
                        >
                          {layers
                            .filter((l) => l.id !== layer.id)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Confirm merge into ${layer.name}`}
                          title="Merge"
                          onClick={() => mergeInto(layer.id)}
                          className={`${iconButton} hover:text-primary!`}
                        >
                          <Check aria-hidden className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel merge"
                          title="Cancel"
                          onClick={() => setMergingId(null)}
                          className={iconButton}
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-center text-xs text-ink-3">No ice roads loaded</p>
            )}
          </section>
        </MapSidePanel>

        <div className="h-[calc(100vh-150px)] min-h-[400px]">
          <IceRoadMap
            layers={visible}
            showClaims={claims}
            selected={modifying ? selected : null}
            onPick={
              modifying
                ? (section) => {
                    setSelected(section)
                    setMoveTo(layers.find((l) => l.id !== section.id)?.id ?? NEW_GROUP)
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* ── Import dialog ── */}
      <dialog
        ref={importDialog}
        onClose={() => setPending(null)}
        onClick={(e) => e.target === importDialog.current && setPending(null)}
        aria-labelledby="iceroads-import-title"
        className={dialogClass}
      >
        <div className="flex flex-col gap-3">
          <h2 id="iceroads-import-title" className="font-bold text-white">
            Import ice road groups
          </h2>
          <ul className="flex flex-col gap-1">
            {pending?.map(({ layer, status }, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={status === 'same'}
                    checked={checked.has(i)}
                    onChange={() => {
                      const next = new Set(checked)
                      if (!next.delete(i)) next.add(i)
                      setChecked(next)
                    }}
                    className="accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {layer.name || 'Unnamed group'}
                  </span>
                  <span className="text-xs text-ink-3">{blocks(layer)}</span>
                  <span className="rounded bg-ground px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                    {STATUS_LABEL[status]}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-edge px-3 py-1 text-sm text-ink-2 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked.size}
              onClick={() => {
                const chosen = pending?.filter((_, i) => checked.has(i)).map((p) => p.layer)
                if (chosen?.length) {
                  change(
                    merge(layersRef.current, chosen),
                    `Imported ${chosen.length} group${chosen.length === 1 ? '' : 's'}`,
                  )
                }
                setPending(null)
              }}
              className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-ground disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </div>
      </dialog>

      {/* ── JSON format help ── */}
      <dialog
        ref={helpDialog}
        onClick={(e) => e.target === helpDialog.current && helpDialog.current.close()}
        aria-labelledby="iceroads-help-title"
        className={`${dialogClass} max-w-xl`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="iceroads-help-title" className="font-bold text-white">
              JSON format
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => helpDialog.current?.close()}
              className={iconButton}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <p className="text-sm text-ink-2">Paste this into an LLM along with your file.</p>
          <pre className="custom-scroll max-h-80 overflow-auto rounded-md border border-edge bg-ground p-2 font-mono text-xs whitespace-pre-wrap text-white">
            {LLM_PROMPT}
          </pre>
          <button
            type="button"
            onClick={() =>
              copyText(LLM_PROMPT).then(
                () => copied('Copied'),
                () => copied('Could not copy'),
              )
            }
            className={button}
          >
            <Code aria-hidden className="size-4" /> {promptCopied || 'Copy for LLM'}
          </button>
        </div>
      </dialog>
    </div>
  )
}

/* why: shown on hover when the button is disabled, so it is clear what would enable it. */
function Tool({
  Icon,
  label,
  onClick,
  disabled,
  why,
}: {
  Icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  why?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? why : undefined}
      className={`${button} disabled:opacity-40`}
    >
      <Icon aria-hidden className="size-4" /> {label}
    </button>
  )
}

/* Click the name to rename: Enter or blur commits, Escape cancels, empty reverts. */
function GroupName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (!editing)
    return (
      <button
        type="button"
        title="Click to rename"
        onClick={() => setEditing(true)}
        className="block w-full truncate text-left text-ink hover:text-white"
      >
        {name}
      </button>
    )
  const commit = (value: string) => {
    const next = value.trim()
    if (next) onRename(next)
    setEditing(false)
  }
  return (
    <input
      autoFocus
      defaultValue={name}
      aria-label="Group name"
      maxLength={80}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(e.currentTarget.value)
        else if (e.key === 'Escape') setEditing(false)
      }}
      className={`${field} w-full`}
    />
  )
}

/* Two clicks to fire: the first arms it and shows `confirmLabel`; leaving it disarms. */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  className,
  children,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  className: string
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      aria-label={armed ? `Confirm: ${label}` : label}
      title={armed ? 'Click again to confirm' : label}
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onMouseLeave={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        onConfirm()
      }}
      className={`${className} ${armed ? 'border-danger! text-danger!' : ''}`}
    >
      {armed ? <span className="text-xs font-semibold">{confirmLabel}</span> : children}
    </button>
  )
}

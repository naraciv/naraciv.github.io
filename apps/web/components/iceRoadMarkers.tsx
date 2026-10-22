import type { ReactNode } from 'react'
import { itemIconUrlFor, type IceMarker, type IceMarkerType } from '@nara/lib'
import { ItemIcon } from './ItemIcon'

const item = (name: string) => <ItemIcon src={itemIconUrlFor(name)} />
// eslint-disable-next-line @next/next/no-img-element
const image = (src: string) => <img src={src} alt="" className="size-6" />
/* Doors are mostly see-through: on a black tile they read on any map. */
const door = (wood: string) => ({
  label: `${wood.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} door`,
  icon: <div className="rounded-sm bg-black">{item(`${wood}_door`)}</div>,
})

/**
 * Each marker type's name, and the symbols it can show on the map. A marker's `mk` is its
 * index in `symbols`, stored in files and links: only ever append.
 */
export const MARKERS: Record<
  IceMarkerType,
  { label: string; symbols: { label: string; icon: ReactNode }[] }
> = {
  portal: { label: 'Portal', symbols: [{ label: 'Portal', icon: image('/iceroads/portal.png') }] },
  bunker: { label: 'Bunker', symbols: [{ label: 'Obsidian', icon: item('obsidian') }] },
  vault: { label: 'Vault', symbols: [{ label: 'Obsidian', icon: item('obsidian') }] },
  exit: {
    label: 'Exit',
    symbols: ['oak', 'spruce', 'dark_oak', 'birch', 'copper', 'iron'].map(door),
  },
  potbunk: { label: 'Potbunk', symbols: [{ label: 'Potion', icon: item('potion') }] },
  trap: {
    label: 'Trap',
    symbols: [
      { label: 'Cave', icon: image('/iceroads/cave.svg') },
      { label: 'Diamond sword', icon: item('diamond_sword') },
      { label: 'Note block', icon: item('note_block') },
    ],
  },
}

/** The marker's symbol on the map; an unknown one (from a newer file) shows the first. */
export const markerIcon = (m: IceMarker) =>
  (MARKERS[m.type].symbols[m.mk ?? 0] ?? MARKERS[m.type].symbols[0]).icon

/** "Name (Type)", or just the type when unnamed. */
export const markerLabel = (m: IceMarker) =>
  m.name ? `${m.name} (${MARKERS[m.type].label})` : MARKERS[m.type].label

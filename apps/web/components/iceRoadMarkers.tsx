import type { ReactNode } from 'react'
import { Target } from 'lucide-react'
import { itemIconUrlFor, type IceMarker, type IceMarkerType } from '@nara/lib'
import { ItemIcon } from './ItemIcon'

/** Each marker type's name, and its icon on the map (24px: lucide's and ItemIcon's size). */
export const MARKERS: Record<IceMarkerType, { label: string; icon: ReactNode }> = {
  portal: {
    label: 'Portal',
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/iceroads/portal.png" alt="" className="size-6 object-contain" />,
  },
  bunker: { label: 'Bunker', icon: <ItemIcon src={itemIconUrlFor('obsidian')} /> },
  vault: { label: 'Vault', icon: <ItemIcon src={itemIconUrlFor('obsidian')} /> },
  exit: { label: 'Exit', icon: <ItemIcon src={itemIconUrlFor('oak_door')} /> },
  potbunk: { label: 'Potbunk', icon: <ItemIcon src={itemIconUrlFor('potion')} /> },
  trap: { label: 'Trap', icon: <Target aria-hidden /> },
}

/** "Name (Type)", or just the type when unnamed. */
export const markerLabel = (m: IceMarker) =>
  m.name ? `${m.name} (${MARKERS[m.type].label})` : MARKERS[m.type].label

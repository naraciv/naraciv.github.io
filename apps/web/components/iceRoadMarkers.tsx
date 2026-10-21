import type { ReactNode } from 'react'
import { createLucideIcon, Target } from 'lucide-react'
import { itemIconUrlFor, type IceMarker, type IceMarkerType } from '@nara/lib'
import { ItemIcon } from './ItemIcon'

/* Not in the installed lucide-react; the same paths as lucide's square-arrow-right-exit. */
const SquareArrowRightExit = createLucideIcon('square-arrow-right-exit', [
  ['path', { d: 'M10 12h11', key: 'a' }],
  ['path', { d: 'm17 16 4-4-4-4', key: 'b' }],
  [
    'path',
    {
      d: 'M21 6.344V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.344',
      key: 'c',
    },
  ],
])

/** Each marker type's name, and its icon on the map (24px: lucide's and ItemIcon's size). */
export const MARKERS: Record<IceMarkerType, { label: string; icon: ReactNode }> = {
  portal: {
    label: 'Portal',
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/iceroads/portal.png" alt="" className="size-6 object-contain" />,
  },
  bunker: { label: 'Bunker', icon: <ItemIcon src={itemIconUrlFor('obsidian')} /> },
  vault: { label: 'Vault', icon: <ItemIcon src={itemIconUrlFor('obsidian')} /> },
  exit: { label: 'Exit', icon: <SquareArrowRightExit aria-hidden /> },
  potbunk: { label: 'Potbunk', icon: <ItemIcon src={itemIconUrlFor('potion')} /> },
  trap: { label: 'Trap', icon: <Target aria-hidden /> },
}

/** "Name (Type)", or just the type when unnamed. */
export const markerLabel = (m: IceMarker) =>
  m.name ? `${m.name} (${MARKERS[m.type].label})` : MARKERS[m.type].label

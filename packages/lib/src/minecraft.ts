/**
 * Minecraft item names → icon URLs.
 *
 * Shop rows name items the way a player writes them in a chest sign — "3 Iron
 * Ingot", `1 Music Disc "mellohi"`, "1 Barrel \"Repair Kit\"" — and the icon
 * host addresses them by registry id. Shared by /shops and /heads.
 *
 * Three cases that 404 if handled naively, each checked against the icon host:
 *   - the item is `lapis_lazuli`; only the ores and blocks made of it drop the
 *     "lazuli".
 *   - the music disc id carries the track, `music_disc_pigstep`. All 21
 *     tracks in the data resolve.
 *   - an unbalanced quote in the source data must not survive into the id
 *     (`music_disc_"chirp`).
 */

const ICON_BASE = 'https://mc.nerothe.com/img/1.21.8/minecraft_'

/** Any potion renders as the generic potion icon; there is no per-effect one. */
const POTION_WORDS = [
  'strength',
  'healing',
  'regeneration',
  'water breathing',
  'resistance',
  'fire resistance',
  'invisibility',
  'swiftness',
  'night vision',
  'leaping',
  'slowness',
  'poison',
  'weakness',
  'turtle master',
  'slow falling',
]

/** Item names that are not their registry id. */
const ALIASES: Record<string, string> = {
  'book and quill': 'writable_book',
  slimeball: 'slime_ball',
  'netherite upgrade': 'netherite_upgrade_smithing_template',
  'nether quartz': 'quartz',
  'eye of ender': 'ender_eye',
}

const slug = (name: string) =>
  name
    .replace(/[()"']/g, '')
    .trim()
    .replace(/\s+/g, '_')

/**
 * The registry id for a shop row's item text, or null if there is nothing to
 * look up. `lore` is read only for the one case that needs it: a book with an
 * author is a written book, not a blank one.
 */
export function itemRegistryName(item: string | undefined, lore = ''): string | null {
  if (!item) return null

  const quotedVariant = item.match(/"([^"]*)"?\s*$/)?.[1]
  const cleaned = item
    .trim()
    /* A leading count, including ranges: "42-62 Iron Ingot". */
    .replace(/^\d+(-\d+)?\s*/, '')
    /* A quoted name is a player's label, not part of the item: '1 Barrel "Repair Kit"'. */
    .replace(/"[^"]*"/g, '')
    .trim()
  if (!cleaned) return null

  let name = cleaned.toLowerCase()

  if (lore.toLowerCase().includes('author')) return 'written_book'
  if (POTION_WORDS.some((word) => name.includes(word))) return 'potion'
  /* Banners are per-colour and per-pattern; white stands in for all of them. */
  if (name.includes('banner')) return 'white_banner'
  if (name.includes('shield')) return 'shield'
  if (ALIASES[name]) return ALIASES[name]

  /* The track is the item: `Music Disc "Creator (Music Box)"` is
     music_disc_creator_music_box. Falls back to the bare disc if unnamed. */
  if (name.startsWith('music disc'))
    return quotedVariant ? `music_disc_${slug(quotedVariant.toLowerCase())}` : 'music_disc'

  /* The dye item is `lapis_lazuli`; every block and ore made of it drops the
     "lazuli", `deepslate_lapis_ore`. */
  if (name !== 'lapis lazuli') name = name.replace('lapis lazuli', 'lapis')

  /* "bucket of axolotl" → axolotl_bucket, "block of iron" → iron_block. */
  const of = name.match(/^(bucket|block) of\s+(.+)$/)
  if (of) return `${slug(of[2])}_${of[1]}`

  return slug(name)
}

export const itemIconUrlFor = (name: string) => `${ICON_BASE}${name}.png`

export function itemIconUrl(item: string | undefined, lore = ''): string | null {
  const name = itemRegistryName(item, lore)
  return name && itemIconUrlFor(name)
}

/** The same icon through this site's /api/item-icon proxy, for canvas drawing. */
export const sameOriginIconUrl = (iconUrl: string) =>
  iconUrl.replace(ICON_BASE, '/api/item-icon/').replace(/\.png$/, '')

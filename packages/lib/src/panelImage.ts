/**
 * Page content as PNGs, for pasting into Discord: a summary panel (the rocket
 * calculator's results) and a shop trade card.
 *
 * Drawn on a canvas from the same data the panel renders, rather than
 * screenshotting the DOM: no browser exposes DOM-to-image, and the libraries
 * that fake it (html-to-image and friends) re-implement CSS to get there.
 *
 * Browser-only. Nothing touches `document` until a function is called, so the
 * @nara/lib barrel stays safe to import on the server.
 */

import type { Shop, ShopItem } from './shops.ts'
import { formatCoordinates } from './coords.ts'
import { sameOriginIconUrl } from './minecraft.ts'

export type PanelLine = { label: string; note?: string; value: string; strong?: boolean }

export type PanelSection = {
  heading: string
  /** The big figure on the right of the heading and its unit: ["1,014", "fuel"]. */
  figure?: [value: string, unit: string]
  sub?: string
  lines?: PanelLine[]
  stats: [string, string][]
}

const WIDTH = 380
const PAD = 18
/**
 * The NARA.rocks mark sits in its own band across the top of every export,
 * pinned to the corner rather than to the content's padding, with a rule under it.
 */
const MARK = { inset: 12, size: 18, band: 40 }
const COLOR = {
  ground: '#0b1120',
  edge: '#1f2937',
  primary: '#4fc3f7',
  ink: '#e2e8f0',
  muted: '#8ea0b8',
  white: '#ffffff',
}

export function panelPng(title: string, sections: PanelSection[]): Promise<Blob> {
  const font = getComputedStyle(document.body).fontFamily

  /* Two passes over one routine: the first only measures height, so the
     canvas can be sized before anything is drawn onto it. */
  const draw = (ctx: CanvasRenderingContext2D, paint: boolean) => {
    const text = (
      s: string,
      x: number,
      y: number,
      size: number,
      color: string,
      opts: { bold?: boolean; right?: boolean } = {},
    ) => {
      if (!paint) return
      ctx.font = `${opts.bold ? 700 : 400} ${size}px ${font}`
      ctx.fillStyle = color
      ctx.textAlign = opts.right ? 'right' : 'left'
      ctx.fillText(s, x, y)
    }
    const rule = (y: number, color = COLOR.edge) => {
      if (!paint) return
      ctx.fillStyle = color
      ctx.fillRect(PAD, y, WIDTH - PAD * 2, 1)
    }
    const right = WIDTH - PAD

    if (paint) drawMark(ctx, font, WIDTH)
    let y = MARK.band + PAD + 14
    text(title, PAD, y, 16, COLOR.white, { bold: true })
    y += 12

    for (const section of sections) {
      rule(y)
      y += 22
      text(section.heading, PAD, y, 12, COLOR.primary, { bold: true })
      if (section.figure) {
        /* As on the page: a big number, its unit small and muted beside it. Measured in both
           passes, so the height is right: it drops below the heading when they would collide. */
        const [value, unit] = section.figure
        ctx.font = `700 12px ${font}`
        const headingWidth = ctx.measureText(section.heading).width
        ctx.font = `600 12px ${font}`
        const unitWidth = ctx.measureText(unit).width
        ctx.font = `700 22px ${font}`
        const figureWidth = ctx.measureText(value).width + 4 + unitWidth
        if (PAD + headingWidth + 12 > right - figureWidth) y += 24
        text(unit, right, y + 2, 12, COLOR.muted, { right: true })
        text(value, right - unitWidth - 4, y + 2, 22, COLOR.white, { bold: true, right: true })
        y += 16
      }
      if (section.sub) {
        text(section.sub, right, y, 11, COLOR.muted, { right: true })
        y += 6
      }

      if (section.lines?.length) {
        y += 8
        rule(y)
        for (const line of section.lines) {
          y += line.strong ? 22 : 17
          if (line.strong) rule(y - 14, '#334155')
          const color = line.strong ? COLOR.white : COLOR.muted
          text(line.value, right, y, 12, color, { bold: line.strong, right: true })
          if (paint) {
            ctx.font = `${line.strong ? 700 : 400} 12px ${font}`
            const valueWidth = ctx.measureText(line.value).width
            const label = line.note ? `${line.label} · ${line.note}` : line.label
            text(fit(ctx, label, WIDTH - PAD * 2 - valueWidth - 12), PAD, y, 12, color, {
              bold: line.strong,
            })
          }
        }
      }

      if (section.stats.length) {
        y += 10
        rule(y)
        section.stats.forEach(([label, value], i) => {
          const x = i % 2 === 0 ? PAD : WIDTH / 2
          const rowY = y + Math.floor(i / 2) * 34
          text(label, x, rowY + 15, 10, COLOR.muted)
          text(value, x, rowY + 31, 13, COLOR.white, { bold: true })
        })
        y += Math.ceil(section.stats.length / 2) * 34 + 6
      } else y += 10
    }
    return y + PAD
  }

  const scale = 2
  const canvas = document.createElement('canvas')
  const height = draw(canvas.getContext('2d')!, false)
  canvas.width = WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = COLOR.ground
  ctx.fillRect(0, 0, WIDTH, height)
  draw(ctx, true)

  return toPng(canvas)
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas is empty'))),
      'image/png',
    ),
  )

/** Trims to a pixel width with an ellipsis, for long item labels. */
function fit(ctx: CanvasRenderingContext2D, s: string, width: number) {
  if (ctx.measureText(s).width <= width) return s
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Puts a PNG on the clipboard, or downloads it where the browser will not
 * accept images there (older Firefox, a refused permission).
 *
 * Takes the blob as a promise, not a blob: Safari only allows the write inside
 * the click, and waiting for the canvas first would step outside it.
 */
export async function copyPng(png: Promise<Blob>, name: string): Promise<'copied' | 'saved'> {
  const filename = `${
    name
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'image'
  }.png`
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    return 'copied'
  } catch (error) {
    console.warn('[nara] Copying the image failed, downloading it instead.', error)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await png)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    return 'saved'
  }
}

/* ── Shop trade card ───────────────────────────────────── */

const TRADE = {
  width: 640,
  pad: 24,
  icon: 48,
  gap: 12,
  arrow: 44,
  titleLine: 20,
  loreLine: 16,
}

/** The navbar wordmark's gradient, from .nav-logo in globals.css. */
const NARA_GRADIENT = ['#ff6b35', '#e040fb', '#00bcd4']

/**
 * One exchange as a card:
 *
 *   NARA
 *   [icon] 3 Iron Ingot   →   [icon] 1 Nara Shield
 *          lore                      lore
 *   3183, 70, 4854 · Shiroyama
 *   Contact: _BaniShed
 *
 * Each item's name and lore are one block centred on its icon. Icons come
 * through /api/item-icon, because the icon host's lack of CORS headers would
 * otherwise stop the canvas from exporting at all.
 */
export async function tradePng(shop: Shop): Promise<Blob> {
  const font = getComputedStyle(document.body).fontFamily
  const titleFont = `700 16px ${font}`
  const loreFont = `400 12px ${font}`
  const { width, pad, icon, gap, arrow } = TRADE
  const side = (width - pad * 2 - arrow) / 2
  const textWidth = side - icon - gap

  const [inputIcon, outputIcon] = await Promise.all([loadIcon(shop.input), loadIcon(shop.output)])

  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!

  /* Measure first: the card's height depends on how the names and lore wrap. */
  const block = (item: ShopItem) => {
    ctx.font = titleFont
    const title = wrap(ctx, item.label, textWidth)
    ctx.font = loreFont
    const lore = item.lore
      ? item.lore.split('\n').flatMap((line) => wrap(ctx, line, textWidth))
      : []
    const height =
      title.length * TRADE.titleLine + (lore.length ? 4 + lore.length * TRADE.loreLine : 0)
    return { title, lore, height }
  }
  const left = block(shop.input)
  const right = block(shop.output)
  const rowHeight = Math.max(icon, left.height, right.height)
  const rowTop = MARK.band + pad
  const height = rowTop + rowHeight + 20 + 17 + 26 + 20 + pad - 4

  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.textBaseline = 'top'
  ctx.fillStyle = COLOR.ground
  ctx.fillRect(0, 0, width, height)

  const drawSide = (x: number, image: HTMLImageElement | null, b: ReturnType<typeof block>) => {
    const iconY = rowTop + (rowHeight - icon) / 2
    if (image) {
      /* Pixel art: scale without smoothing, or the 16px textures blur. */
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, x, iconY, icon, icon)
    } else {
      ctx.fillStyle = COLOR.edge
      ctx.fillRect(x, iconY, icon, icon)
    }

    let y = rowTop + (rowHeight - b.height) / 2
    ctx.fillStyle = COLOR.white
    ctx.font = titleFont
    for (const line of b.title) {
      ctx.fillText(line, x + icon + gap, y + 2)
      y += TRADE.titleLine
    }
    if (b.lore.length) y += 4
    ctx.fillStyle = COLOR.muted
    ctx.font = loreFont
    for (const line of b.lore) {
      ctx.fillText(line, x + icon + gap, y + 2)
      y += TRADE.loreLine
    }
  }

  drawMark(ctx, font, width)
  drawSide(pad, inputIcon, left)
  drawSide(pad + side + arrow, outputIcon, right)

  ctx.fillStyle = COLOR.primary
  ctx.font = `700 24px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('→', pad + side + arrow / 2, rowTop + rowHeight / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  let y = rowTop + rowHeight + 20
  ctx.fillStyle = COLOR.edge
  ctx.fillRect(pad, y, width - pad * 2, 1)
  y += 17

  /* Every shop on the sheet is in Nara. */
  const place = shop.city ? `${shop.city}, Nara` : 'Nara'
  const where = [shop.position ? formatCoordinates(shop.position) : shop.coordinates, place]
    .filter(Boolean)
    .join(' · ')
  ctx.fillStyle = COLOR.ink
  ctx.font = `400 15px ${font}`
  ctx.fillText(where, pad, y)
  y += 26

  ctx.font = `400 14px ${font}`
  ctx.fillStyle = COLOR.muted
  ctx.fillText('Contact:', pad, y + 1)
  const contactX = pad + ctx.measureText('Contact:').width + 6
  ctx.font = `700 15px ${font}`
  ctx.fillStyle = COLOR.white
  ctx.fillText(shop.contact || 'Unknown', contactX, y)

  return toPng(canvas)
}

/**
 * The site mark on every exported image: `NARA.rocks` in the navbar wordmark's
 * orange → purple → cyan gradient, running across the whole mark, in a band in
 * the top-left corner with a rule beneath. NARA is heavy and letter-spaced as in
 * the navbar; `.rocks` is lighter and smaller. Returns nothing: callers start
 * their content below `MARK.band`.
 */
export function drawMark(ctx: CanvasRenderingContext2D, font: string, width: number) {
  const { inset, size, band } = MARK
  const spacing = Math.round(size / 8)
  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const baseline = band / 2 + size * 0.36

  ctx.font = `900 ${size}px ${font}`
  ctx.letterSpacing = `${spacing}px`
  const nara = ctx.measureText('NARA').width - spacing
  const rocksFont = `700 ${Math.round(size * 0.72)}px ${font}`
  ctx.font = rocksFont
  ctx.letterSpacing = '0px'
  const rocks = ctx.measureText('.rocks').width

  const gradient = ctx.createLinearGradient(inset, 0, inset + nara + rocks, 0)
  NARA_GRADIENT.forEach((color, i) => gradient.addColorStop(i / (NARA_GRADIENT.length - 1), color))
  ctx.fillStyle = gradient

  ctx.font = `900 ${size}px ${font}`
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText('NARA', inset, baseline)
  ctx.font = rocksFont
  ctx.letterSpacing = '0px'
  ctx.fillText('.rocks', inset + nara + 1, baseline)

  ctx.fillStyle = COLOR.edge
  ctx.fillRect(0, band, width, 1)
  ctx.restore()
}

function loadIcon(item: ShopItem): Promise<HTMLImageElement | null> {
  if (!item.icon) return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = sameOriginIconUrl(item.icon!)
  })
}

/** Word-wraps to a pixel width; a single word wider than that is left whole. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  return line ? [...lines, line] : lines
}

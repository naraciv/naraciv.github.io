'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Switch } from '@/components/ui'
import {
  ChevronDown,
  ChevronsRight,
  Minus,
  Plus,
  RotateCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import {
  byCategoryPriority,
  floorName,
  headCost,
  headRenderUrl,
  itemIconUrl,
  type Head,
} from '@nara/lib'
import { ItemIcon } from './ItemIcon'
import { HeadPreview } from './HeadPreview'

/**
 * The head shop: search, a category or flat view, a cart that totals the
 * price, and a rotatable 3D preview.
 *
 * Worth knowing:
 *   - Each card renders once; one list lays itself out as a scroller on phones
 *     and a grid from `sm` up.
 *   - The cart is keyed by row, not texture: one texture is on two listings.
 *   - Collapsing uses <details>, the cart a popover and the preview a <dialog>,
 *     so Escape, focus and the top layer come from the browser rather than from
 *     body-appended nodes and document-level click handlers.
 *   - No "Tags" search: the column is empty on every row.
 */

type Field = 'all' | 'name' | 'category'

/** Category dot colours, from heads.css. */
const CATEGORY_COLOR: Record<string, string> = {
  food: '#f59e0b',
  'lasers/arrows': '#ef4444',
  decoration: '#8b5cf6',
  nature: '#10b981',
  blocks: '#6b7280',
  misc: '#3b82f6',
  animal: '#f97316',
  emoji: '#eab308',
  plants: '#22c55e',
  indoor: '#06b6d4',
  letters: '#a855f7',
  halloween: '#f97316',
  christmas: '#dc2626',
  fish: '#0ea5e9',
  mob: '#84cc16',
  nation: '#ec4899',
  player: '#14b8a6',
}

const where = (head: Head) =>
  head.position
    ? `${head.position.x}, ${head.position.z} (${floorName(head.position.y ?? 0)})`
    : head.coordinates

export function HeadShop({ heads }: { heads: Head[] }) {
  const [query, setQuery] = useState('')
  const [field, setField] = useState<Field>('all')
  const [byCategory, setByCategory] = useState(true)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<Head | null>(null)
  /* Until the URL has been read, writing it back would erase what it holds. */
  const [urlRead, setUrlRead] = useState(false)
  const cartRef = useRef<HTMLDivElement>(null)

  /*
   * The page is static, so the URL is read after hydration rather than on the
   * server. A shared link such as ?q=pumpkin narrows one frame late; the
   * alternative, reading searchParams, would re-render all 446 cards per
   * request instead of serving one cached page.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const f = params.get('field')
    setQuery(params.get('q') ?? '')
    if (f === 'name' || f === 'category') setField(f)
    if (params.get('view') === 'flat') setByCategory(false)
    setUrlRead(true)
  }, [])

  useEffect(() => {
    if (!urlRead) return
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (field !== 'all') params.set('field', field)
    if (!byCategory) params.set('view', 'flat')
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [urlRead, query, field, byCategory])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return heads
    return heads.filter((head) => {
      const name = head.name.toLowerCase().includes(q)
      const category = head.category.toLowerCase().includes(q)
      return field === 'name' ? name : field === 'category' ? category : name || category
    })
  }, [heads, query, field])

  const groups = useMemo(() => {
    const map = new Map<string, Head[]>()
    for (const head of visible) map.set(head.category, [...(map.get(head.category) ?? []), head])
    return [...map].sort(([a], [b]) => byCategoryPriority(a, b))
  }, [visible])

  const outOfStock = heads.filter((head) => !head.inStock).length
  const cartLines = heads.filter((head) => cart[head.id])
  const cartCount = cartLines.reduce((n, head) => n + cart[head.id], 0)
  const totals = cartLines.reduce(
    (sum, head) => {
      const cost = headCost(head.price)
      return {
        diamonds: sum.diamonds + cost.diamonds * cart[head.id],
        iron: sum.iron + cost.iron * cart[head.id],
      }
    },
    { diamonds: 0, iron: 0 },
  )

  const add = (head: Head) => {
    /* The first add opens the cart; showPopover throws if it already is. */
    if (cartCount === 0 && !cartRef.current?.matches(':popover-open'))
      cartRef.current?.showPopover()
    setCart((c) => ({ ...c, [head.id]: (c[head.id] ?? 0) + 1 }))
  }
  const change = (id: string, delta: number) =>
    setCart(({ [id]: qty = 0, ...rest }) =>
      qty + delta > 0 ? { ...rest, [id]: qty + delta } : rest,
    )

  const card = (head: Head) => (
    <HeadCard
      key={head.id}
      head={head}
      onAdd={() => add(head)}
      onPreview={() => setPreview(head)}
    />
  )

  return (
    <>
      {/* ── Sticky search, cart and view toggle ── */}
      <div className="sticky top-[74px] z-40 bg-black/80 pt-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 sm:gap-3">
          <div className="flex h-10 max-w-2xl min-w-0 flex-1 items-center gap-2 rounded-full border border-edge bg-surface pr-2 pl-3 transition-colors focus-within:border-primary sm:h-11 sm:pl-4">
            <Search aria-hidden className="size-4 shrink-0 text-ink-3 sm:size-5" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search heads"
              className="h-full min-w-0 grow bg-transparent text-xs text-white placeholder-ink-2 focus:outline-none sm:text-sm"
            />
            <label htmlFor="head-field" className="sr-only">
              Search in
            </label>
            <select
              id="head-field"
              value={field}
              onChange={(e) => setField(e.target.value as Field)}
              className="shrink-0 cursor-pointer bg-surface text-xs text-white focus:outline-none sm:text-sm"
            >
              <option value="all">All Fields</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </div>

          <button
            type="button"
            popoverTarget="head-cart"
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'head' : 'heads'}`}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-edge bg-surface px-3 transition-colors hover:border-primary sm:h-11 sm:gap-2 sm:px-4"
          >
            <ShoppingCart aria-hidden className="size-4 text-ink-3 sm:size-5" />
            <span className="text-xs font-semibold text-white sm:text-sm">{cartCount}</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center border-b border-edge pb-2 sm:mt-4 sm:pb-3">
          <Switch
            label="Sort by Category"
            checked={byCategory}
            onChange={setByCategory}
            className="justify-center text-xs sm:text-sm"
          />
        </div>
      </div>

      <p aria-live="polite" className="py-3 text-center text-sm text-ink-3">
        <span className="font-semibold text-white">{heads.length - outOfStock}</span> heads
        available
        {outOfStock > 0 && ` (${outOfStock} out of stock)`}
        {query.trim() && ` · ${visible.length} matching`}
      </p>

      {/* ── Heads ── */}
      <div className="mt-2">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-ink-3">No heads found matching your search.</p>
        ) : byCategory ? (
          groups.map(([category, list]) => (
            <details key={category} open className="group mb-2 open:mb-6">
              <summary className="mb-2 flex cursor-pointer items-center gap-2 rounded-lg bg-surface-2 p-2 transition-colors select-none hover:bg-edge">
                <ChevronDown
                  aria-hidden
                  className="size-4 text-ink-3 transition-transform group-[:not([open])]:-rotate-90"
                />
                <CategoryTag category={category} className="text-white" />
                <span className="text-xs text-ink-2">({list.length})</span>
                <ChevronsRight aria-hidden className="ml-auto size-4 text-ink-3 sm:hidden" />
              </summary>
              {/* One list: a snap scroller on phones, a grid from sm up. */}
              <div className="flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto pb-2 sm:grid sm:[scrollbar-width:auto] sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:pb-0 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 [&>*]:w-28 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
                {list.map(card)}
              </div>
            </details>
          ))
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {visible.map(card)}
          </div>
        )}
      </div>

      {/* ── Cart ── */}
      <div
        ref={cartRef}
        id="head-cart"
        popover="manual"
        onKeyDown={(e) => e.key === 'Escape' && cartRef.current?.hidePopover()}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[70vh] w-full overflow-y-auto rounded-t-xl border border-edge bg-surface p-4 text-ink shadow-2xl sm:inset-x-auto sm:top-[150px] sm:right-4 sm:bottom-auto sm:w-80 sm:rounded-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <ShoppingCart aria-hidden className="size-5" /> Cart
          </h2>
          <button
            type="button"
            popoverTarget="head-cart"
            popoverTargetAction="hide"
            aria-label="Close cart"
            className="rounded p-1 text-ink-3 transition-colors hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        {cartLines.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">Your cart is empty</p>
        ) : (
          <>
            <ul className="custom-scroll flex max-h-80 flex-col gap-2 overflow-y-auto">
              {cartLines.map((head) => (
                <li key={head.id} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
                  <span className="flex shrink-0 items-center gap-1">
                    <QtyButton label={`One fewer ${head.name}`} onClick={() => change(head.id, -1)}>
                      <Minus aria-hidden className="size-3" />
                    </QtyButton>
                    <span className="w-5 text-center text-xs text-white">{cart[head.id]}</span>
                    <QtyButton label={`One more ${head.name}`} onClick={() => change(head.id, 1)}>
                      <Plus aria-hidden className="size-3" />
                    </QtyButton>
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={headRenderUrl(head.textureId, 64)}
                    alt=""
                    className="size-7 shrink-0 rounded"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-white">
                      {head.name}
                    </span>
                    <span className="block truncate text-[0.65rem] text-ink-3">{where(head)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
              <span className="flex items-center gap-3 text-sm">
                <span className="text-xs text-ink-3">Total:</span>
                {totals.diamonds > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-cyan">
                    <ItemIcon src={itemIconUrl('Diamond')!} className="size-4" />
                    {totals.diamonds}
                  </span>
                )}
                {totals.iron > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    <ItemIcon src={itemIconUrl('Iron Ingot')!} className="size-4" />
                    {totals.iron}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setCart({})}
                className="flex items-center gap-1 rounded border border-edge px-2 py-1 text-xs text-ink-2 transition-colors hover:border-danger hover:text-danger"
              >
                <Trash2 aria-hidden className="size-3" /> Clear
              </button>
            </div>
            <p className="mt-2 text-center text-[0.6rem] text-ink-3">Online Ordering Soon™</p>
          </>
        )}
      </div>

      <HeadPreview head={preview} onClose={() => setPreview(null)} />
    </>
  )
}

function HeadCard({
  head,
  onAdd,
  onPreview,
}: {
  head: Head
  onAdd: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-edge bg-surface p-2 transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-[#171f2a] hover:shadow-lg ${
        head.inStock ? '' : 'opacity-40 grayscale-[60%]'
      }`}
    >
      {/* Hidden on phones; a wrapper, since the tag sets its own display. */}
      <div className="mb-1 hidden sm:block">
        <CategoryTag category={head.category} className="text-ink-2" />
      </div>
      <div className="relative flex justify-center sm:pb-6">
        <button
          type="button"
          onClick={onPreview}
          aria-label={`3D preview of ${head.name}`}
          className="flex size-[70px] items-center justify-center sm:size-[100px]"
        >
          {/* Not next/image: 446 renders from a third-party service, already sized. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={headRenderUrl(head.textureId, 256)}
            alt=""
            loading="lazy"
            className="size-[60px] [image-rendering:pixelated] sm:size-[90px]"
          />
        </button>
        <button
          type="button"
          onClick={onPreview}
          tabIndex={-1}
          aria-hidden
          className="absolute right-0 bottom-0 flex items-center gap-1 rounded border border-[#4b5563] bg-[rgba(55,65,81,0.95)] p-1 text-[0.55rem] whitespace-nowrap text-ink transition-[transform,background-color,border-color] hover:scale-105 hover:border-danger hover:bg-danger hover:text-white sm:px-1.5 sm:py-0.5"
        >
          <RotateCw className="size-3" />
          {/* Icon only on phones: the label does not fit a 112px card. */}
          <span className="hidden sm:inline">Live Preview</span>
        </button>
      </div>
      <div className="mt-1 flex flex-1 items-end justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="line-clamp-2 text-[0.65rem] leading-tight font-semibold text-white sm:mb-1 sm:min-h-8 sm:text-xs">
            {head.name}
          </h3>
          <p className="truncate text-[0.5rem] text-ink-2 sm:text-[0.65rem]">{head.price}</p>
          <p className="hidden text-[0.65rem] text-ink-3 sm:block">{where(head)}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!head.inStock}
          aria-label={`Add ${head.name} to cart`}
          className="flex shrink-0 items-center gap-0.5 rounded bg-surface-2 p-1.5 text-ink-3 transition-colors hover:bg-primary hover:text-ground disabled:pointer-events-none"
        >
          <Plus aria-hidden className="size-2" />
          <ShoppingCart aria-hidden className="size-3" />
        </button>
      </div>
    </div>
  )
}

function CategoryTag({ category, className = '' }: { category: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[#374151] bg-surface-2/50 py-px pr-1.5 pl-0.5 text-[0.6rem] ${className}`}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: CATEGORY_COLOR[category.toLowerCase()] ?? '#9ca3af' }}
      />
      {category}
    </span>
  )
}

function QtyButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded bg-edge text-ink transition-colors hover:bg-primary hover:text-ground"
    >
      {children}
    </button>
  )
}

import { itemIconUrlFor } from '@nara/lib'

/**
 * Item icons, re-served from this origin.
 *
 * The icon host sends no CORS headers. Drawing its images onto a canvas marks
 * the canvas cross-origin, and the browser then refuses to export it, so the
 * "Copy Trade Img" button on /shops loads icons through here instead.
 *
 * Only registry-shaped names are accepted, so this can only ever fetch an icon,
 * never an arbitrary URL.
 */
export async function GET(_request: Request, { params }: RouteContext<'/api/item-icon/[name]'>) {
  const { name } = await params
  if (!/^[a-z0-9_]{1,64}$/.test(name)) return new Response('Bad item name', { status: 400 })

  const upstream = await fetch(itemIconUrlFor(name), { next: { revalidate: 604800 } })
  /* Misses are cached at the edge for a day, so a bad name cannot keep waking the function. */
  if (!upstream.ok)
    return new Response('No such icon', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    })

  /* `max-age` is the browser's week; `s-maxage` is what lets Vercel's edge cache serve
     repeat requests without invoking this function at all. */
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
    },
  })
}

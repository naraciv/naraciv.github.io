import type { Point } from './grid'

/**
 * Point clustering for the map marker layers.
 *
 * `/homes` and `/shops` each hand-rolled this inline with the same algorithm
 * and different radii — homes a flat 5 blocks, shops a zoom-scaled one. This is
 * that algorithm, once.
 */

export type Cluster<T> = Point & { items: T[] }

/**
 * Greedy first-fit: each point joins the first existing cluster within `radius`,
 * or seeds a new one.
 *
 * The cluster's position stays the **seed** point and is never recentred, which
 * matters — a marker sits on a real listing
 * rather than on an averaged position with nothing there. Order-dependent by
 * nature: feed it a stable order or markers will jump between renders.
 *
 * O(n·k) in the number of clusters. Fine for the few hundred rows these pages
 * carry; if a page ever plots tens of thousands, grid-bucket it instead.
 */
export function clusterByRadius<T>(
  items: T[],
  radius: number,
  position: (item: T) => Point | null,
): Cluster<T>[] {
  const clusters: Cluster<T>[] = []

  for (const item of items) {
    const point = position(item)
    if (!point) continue

    const existing = clusters.find((c) => Math.hypot(c.x - point.x, c.z - point.z) <= radius)
    if (existing) existing.items.push(item)
    else clusters.push({ x: point.x, z: point.z, items: [item] })
  }

  return clusters
}

/**
 * The zoom-scaled cluster radius `/shops` uses: about 30 blocks at zoom 2,
 * widening to ~25,000 at zoom -6, so distant shops merge as you zoom out.
 */
export function zoomScaledRadius(zoom: number): number {
  return 13 * 3 ** (2 - zoom)
}

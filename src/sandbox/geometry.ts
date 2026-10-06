import type { SimNode } from '../types'

/** puck radius in the sandbox; node x/y is the puck centre */
export const R = 36

export interface Geom {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** a straight wire between two pucks, trimmed to their rims; `lane` nudges it sideways for two‑way pairs */
export function edgeGeom(a: { x: number; y: number }, b: { x: number; y: number }, lane = 0, trimEnd = R + 12): Geom {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.max(1, Math.hypot(dx, dy))
  const ux = dx / d
  const uy = dy / d
  const ox = -uy * lane
  const oy = ux * lane
  return { x1: a.x + ux * (R + 8) + ox, y1: a.y + uy * (R + 8) + oy, x2: b.x - ux * trimEnd + ox, y2: b.y - uy * trimEnd + oy }
}

export function pointAt(g: Geom, t: number) {
  return { x: g.x1 + (g.x2 - g.x1) * t, y: g.y1 + (g.y2 - g.y1) * t }
}

export function laneOf(e: { from: string; to: string }, edges: { from: string; to: string }[]) {
  return edges.some((o) => o.from === e.to && o.to === e.from) ? 7 : 0
}

export type { SimNode }

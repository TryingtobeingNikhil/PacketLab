import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { OverlayCtx } from './LessonCanvas'

type Side = 'right' | 'left' | 'below' | 'above' | 'park'

const GAP = 18
const TOP_SAFE = 76
const BOTTOM_SAFE = 84

interface Props {
  ctx: OverlayCtx
  anchor: string
  /** nodes that packets cross in this step: covering them hides the action */
  busy?: string[]
  /** links, so the wires packets travel along stay visible too */
  links?: [string, string][]
  width?: number
  children: ReactNode
}

/**
 * A speech bubble that sits beside the device the step is about. It tries each side of that
 * device and each free corner of the canvas, and keeps whichever hides the least of the action.
 */
export function StepBubble({ ctx, anchor, busy = [], links = [], width = 360, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(160)
  useLayoutEffect(() => {
    if (ref.current && Math.abs(ref.current.offsetHeight - h) > 2) setH(ref.current.offsetHeight)
  })

  const a = ctx.screen[anchor]
  if (!a) return null
  const W = Math.min(width, ctx.w - 24)
  const r = ctx.r
  const busySet = new Set(busy)

  // what must stay visible, and how much it matters
  const points: { x: number; y: number; w: number }[] = []
  for (const [id, p] of Object.entries(ctx.screen)) points.push({ ...p, w: id === anchor ? 6 : busySet.has(id) ? 4 : 1 })
  for (const [x, y] of links) {
    const p = ctx.screen[x]
    const q = ctx.screen[y]
    if (!p || !q || !busySet.has(x) || !busySet.has(y)) continue
    for (const f of [0.25, 0.5, 0.75]) points.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, w: 2 })
  }

  const minTop = TOP_SAFE
  const maxTop = Math.max(minTop, ctx.h - h - BOTTOM_SAFE)
  const clamp = (p: { left: number; top: number }) => ({
    left: Math.max(12, Math.min(ctx.w - W - 12, p.left)),
    top: Math.max(minTop, Math.min(maxTop, p.top)),
  })
  const near = a.y - Math.min(60, h / 2)
  const candidates: { side: Side; raw: { left: number; top: number } }[] = [
    { side: 'right', raw: { left: a.x + r + GAP, top: near } },
    { side: 'left', raw: { left: a.x - r - GAP - W, top: near } },
    { side: 'below', raw: { left: a.x - W / 2, top: a.y + r + 46 } },
    { side: 'above', raw: { left: a.x - W / 2, top: a.y - r - GAP - h } },
    // the clear lane the canvas leaves on the right of wide screens
    { side: 'right', raw: { left: ctx.w - W - 24, top: near } },
    { side: 'park', raw: { left: 12, top: minTop } },
    { side: 'park', raw: { left: ctx.w - W - 12, top: minTop } },
    { side: 'park', raw: { left: 12, top: maxTop } },
    { side: 'park', raw: { left: ctx.w - W - 12, top: maxTop } },
  ]
  let best: { side: Side; pos: { left: number; top: number }; score: number } | null = null
  for (const c of candidates) {
    const pos = clamp(c.raw)
    const moved = Math.abs(pos.left - c.raw.left) + Math.abs(pos.top - c.raw.top)
    const pad = r * 0.8
    const hit = points.reduce((s, p) => s + (p.x > pos.left - pad && p.x < pos.left + W + pad && p.y > pos.top - pad && p.y < pos.top + h + pad + 30 ? p.w : 0), 0)
    const cx = pos.left + W / 2
    const cy = pos.top + h / 2
    const dist = Math.hypot(cx - a.x, cy - a.y)
    // a bubble beside its device reads best; a parked one only wins when it hides less
    const score = hit * 1000 + dist * 0.6 + (c.side === 'park' ? 250 : moved * 0.5)
    const side: Side = c.side === 'right' && pos.left > a.x ? 'right' : moved > 40 && c.side !== 'park' ? 'park' : c.side
    if (!best || score < best.score) best = { side, pos, score }
  }
  const { side, pos } = best!
  const far = side === 'right' ? pos.left - a.x > r + 150 : side === 'left' ? a.x - (pos.left + W) > r + 150 : false
  const tail = far
    ? undefined
    : side === 'right' || side === 'left'
      ? { top: Math.max(16, Math.min(h - 16, a.y - pos.top)) }
      : side === 'below' || side === 'above'
        ? { left: Math.max(20, Math.min(W - 20, a.x - pos.left)) }
        : undefined

  return (
    <div ref={ref} className={`bubble side-${side}`} style={{ left: pos.left, top: pos.top, width: W }}>
      {tail && <span className="tail" style={tail} />}
      {children}
    </div>
  )
}

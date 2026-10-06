import type { Lesson, Msg, Step, Table } from '../types'

export interface TMsg {
  idx: number
  msg: Msg
  path: string[]
  /** cumulative times (ms, relative to start) at which each path node is reached */
  at: number[]
  start: number
  travel: number
  end: number
}

export interface Timeline {
  msgs: TMsg[]
  total: number
}

const BURST_GAP = 150
const SELF_MS = 1100
const BOOM_MS = 700
const GROUP_GAP = 260

export function bfs(lesson: Lesson, from: string, to: string): string[] {
  if (from === to) return [from]
  const adj: Record<string, string[]> = {}
  for (const [a, b] of lesson.links) {
    ;(adj[a] ??= []).push(b)
    ;(adj[b] ??= []).push(a)
  }
  const prev: Record<string, string | null> = { [from]: null }
  const q = [from]
  while (q.length) {
    const n = q.shift()!
    if (n === to) break
    for (const m of adj[n] ?? []) if (!(m in prev)) { prev[m] = n; q.push(m) }
  }
  if (!(to in prev)) return [from, to]
  const path: string[] = []
  for (let c: string | null = to; c; c = prev[c]) path.unshift(c)
  return path
}

export function buildTimeline(lesson: Lesson, step: Step | undefined): Timeline {
  const pos: Record<string, { x: number; y: number }> = {}
  lesson.nodes.forEach((n) => (pos[n.id] = n))
  const msgs: TMsg[] = []
  let groupStart = 400
  let groupEnd = 400
  let firstHops: string[] = []
  ;(step?.msgs ?? []).forEach((msg, idx) => {
    if (!msg.par && idx > 0) {
      groupStart = groupEnd + GROUP_GAP
      firstHops = []
    }
    const path = msg.via ?? bfs(lesson, msg.from, msg.to)
    // parallel packets that leave over the same link would sit on top of each other: stagger them
    const hop = path.slice(0, 2).join('>')
    const stagger = firstHops.filter((h) => h === hop).length * 380
    firstHops.push(hop)
    const at = [0]
    let t = 0
    for (let i = 1; i < path.length; i++) {
      const a = pos[path[i - 1]]
      const b = pos[path[i]]
      const d = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 300
      t += Math.min(1500, Math.max(520, 260 + d * 1.15))
      at.push(t)
    }
    let travel = path.length === 1 ? SELF_MS : t
    if (msg.drop) travel = travel * 0.6
    const extra = ((msg.burst ?? 1) - 1) * BURST_GAP + (msg.drop ? BOOM_MS : 0)
    const tm: TMsg = { idx, msg, path, at, start: groupStart + stagger, travel, end: groupStart + stagger + travel + extra }
    msgs.push(tm)
    groupEnd = Math.max(groupEnd, tm.end)
  })
  return { msgs, total: msgs.length ? groupEnd + 300 : 0 }
}

/** position (in world coords) of a packet `e` ms after it left */
export function positionAt(tm: TMsg, e: number, pos: Record<string, { x: number; y: number }>) {
  const { path, at } = tm
  if (path.length === 1) {
    const p = pos[path[0]]
    return { x: p.x, y: p.y - 46 - Math.sin(Math.min(1, e / SELF_MS) * Math.PI) * 18, hop: 0 }
  }
  const t = Math.max(0, Math.min(e, tm.travel))
  let i = 1
  while (i < at.length - 1 && at[i] < t) i++
  const a = pos[path[i - 1]]
  const b = pos[path[i]]
  const f = (t - at[i - 1]) / Math.max(1, at[i] - at[i - 1])
  const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2
  return { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease, hop: i }
}

/** tables carry forward from earlier steps unless a later step replaces them */
export function tablesAt(lesson: Lesson, stepIdx: number): Record<string, Table> {
  const out: Record<string, Table> = {}
  for (let i = 0; i <= Math.min(stepIdx, lesson.steps.length - 1); i++) {
    const t = lesson.steps[i].tables
    if (!t) continue
    for (const [k, v] of Object.entries(t)) out[k] = i === stepIdx ? v : { ...v, fresh: undefined }
  }
  return out
}

export const COLORS: Record<NonNullable<Msg['c']>, string> = {
  blue: 'var(--c-blue)',
  teal: 'var(--c-teal)',
  violet: 'var(--c-violet)',
  amber: 'var(--c-amber)',
  pink: 'var(--c-pink)',
  green: 'var(--c-green)',
  red: 'var(--c-red)',
  gray: 'var(--c-gray)',
}

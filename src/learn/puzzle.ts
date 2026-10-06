import { KINDS } from '../catalog'
import type { Kind, Lesson, LNode } from '../types'

const ENDPOINTS: Kind[] = ['host', 'client', 'mobile', 'botnet']
const POOL: Kind[] = ['switch', 'router', 'firewall', 'dns', 'lb', 'cdn', 'nat', 'server', 'database', 'wifi', 'gpu', 'ibswitch', 'vpn', 'cache']

/** the device the lesson revolves around: the best-connected thing that is not an end host */
export function hubOf(lesson: Lesson): LNode | null {
  const deg: Record<string, number> = {}
  for (const [a, b] of lesson.links) {
    deg[a] = (deg[a] ?? 0) + 1
    deg[b] = (deg[b] ?? 0) + 1
  }
  let best: LNode | null = null
  for (const n of lesson.nodes) {
    if (ENDPOINTS.includes(n.kind)) continue
    if ((deg[n.id] ?? 0) < 2) continue
    if (!best || deg[n.id] > deg[best.id]) best = n
  }
  return best
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** three choices for the empty slot: the right kind and two plausible wrong ones, in a stable order */
export function choicesFor(lesson: Lesson, hub: LNode): Kind[] {
  const label = KINDS[hub.kind].label
  const others = POOL.filter((k) => k !== hub.kind && KINDS[k].label !== label)
  let h = hash(lesson.id)
  const picks: Kind[] = []
  while (picks.length < 2) {
    const k = others[h % others.length]
    if (!picks.includes(k)) picks.push(k)
    h = Math.imul(h, 1103515245) + 12345
    h >>>= 0
  }
  const all = [hub.kind, ...picks]
  const rot = hash(lesson.id + ':order') % 3
  return [...all.slice(rot), ...all.slice(0, rot)]
}

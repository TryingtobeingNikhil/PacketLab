import { DEFAULT_LINK, defaultParams, KINDS } from './catalog'
import { useStore } from './store'
import type { Kind, Note, SimEdge, SimNode } from './types'

interface Shared {
  v: 1
  o: number
  p: number
  n: [string, Kind, string, number, number, Partial<SimNode['params']>][]
  e: [string, string, Partial<SimEdge['params']>][]
  t: [number, number, string][]
}

function diff<T extends object>(a: T, base: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(a) as (keyof T)[]) if (a[k] !== base[k]) out[k] = a[k]
  return out
}

const enc = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const dec = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function shareUrl() {
  const { graph, offered, payloadKB } = useStore.getState()
  const data: Shared = {
    v: 1,
    o: offered,
    p: payloadKB,
    n: graph.nodes.map((n) => [n.id, n.kind, n.label, Math.round(n.x), Math.round(n.y), diff(n.params, defaultParams(n.kind))]),
    e: graph.edges.map((e) => [e.from, e.to, diff(e.params, DEFAULT_LINK)]),
    t: graph.notes.map((n) => [Math.round(n.x), Math.round(n.y), n.text]),
  }
  return `${location.origin}${location.pathname}#d=${enc(JSON.stringify(data))}`
}

export function loadFromHash(): boolean {
  const m = location.hash.match(/#d=([\w-]+)/)
  if (!m) return false
  try {
    const d = JSON.parse(dec(m[1])) as Shared
    if (d.v !== 1) return false
    const nodes: SimNode[] = d.n
      .filter(([, kind]) => KINDS[kind])
      .map(([id, kind, label, x, y, p]) => ({ id, kind, label, x, y, params: { ...defaultParams(kind), ...p } }))
    const ids = new Set(nodes.map((n) => n.id))
    const edges: SimEdge[] = d.e
      .filter(([a, b]) => ids.has(a) && ids.has(b))
      .map(([from, to, p]) => ({ id: `${from}->${to}`, from, to, params: { ...DEFAULT_LINK, ...p } }))
    const notes: Note[] = d.t.map(([x, y, text], i) => ({ id: `t${i}`, x, y, text, w: 480 }))
    useStore.getState().loadGraph({ nodes, edges, notes }, d.o, d.p)
    return true
  } catch {
    return false
  }
}

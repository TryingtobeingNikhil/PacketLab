import { useEffect, useRef, useState } from 'react'
import { CAT_COLOR, KINDS } from '../catalog'
import { useStore } from '../store'
import { edgeGeom, laneOf, pointAt, R } from './geometry'

interface P {
  kind: 'flow' | 'drop'
  edge?: string
  x?: number
  y?: number
  age: number
  dur: number
  bad: boolean
  color: string
  dx?: number
}

/**
 * Visual only: little diamonds ride the wires at a rate that grows with log(flow);
 * anything dropping work sheds red ✕ marks, a firewall sheds amber ones.
 */
export function Particles() {
  const ps = useRef<P[]>([])
  const acc = useRef<Record<string, number>>({})
  const [, force] = useState(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dtMs = Math.min(64, now - last)
      last = now
      const s = useStore.getState()
      if (s.running && s.mode === 'sandbox' && s.metrics) {
        const dt = dtMs / 1000
        const byId = Object.fromEntries(s.graph.nodes.map((n) => [n.id, n]))
        for (const e of s.graph.edges) {
          const m = s.metrics.edges[e.id]
          const a = byId[e.from]
          if (!m || !a || !byId[e.to]) continue
          const rate = m.flow > 0.05 ? Math.min(14, 1.2 + 2.6 * Math.log10(1 + m.flow)) : 0
          acc.current[e.id] = (acc.current[e.id] ?? 0) + rate * dt
          while (acc.current[e.id] >= 1) {
            acc.current[e.id] -= 1
            ps.current.push({
              kind: 'flow', edge: e.id, age: 0, bad: Math.random() < m.bad,
              dur: Math.min(3200, 700 + e.params.latencyMs * 5 + m.queueMs * 1.5),
              color: CAT_COLOR[KINDS[a.kind].cat],
            })
          }
          if (m.dropRate > 0.05) {
            const k = `d:${e.id}`
            acc.current[k] = (acc.current[k] ?? 0) + Math.min(9, 2 + 2 * Math.log10(1 + m.dropRate)) * dt
            while (acc.current[k] >= 1) {
              acc.current[k] -= 1
              const p = pointAt(edgeGeom(a, byId[e.to]), 0.5)
              ps.current.push({ kind: 'drop', x: p.x, y: p.y, age: 0, dur: 900, bad: true, color: 'var(--bad)', dx: (Math.random() - 0.5) * 34 })
            }
          }
        }
        for (const n of s.graph.nodes) {
          const m = s.metrics.nodes[n.id]
          if (!m) continue
          const lost = m.dropRate + m.blocked
          if (lost > 0.05) {
            const k = `n:${n.id}`
            acc.current[k] = (acc.current[k] ?? 0) + Math.min(10, 2 + 2.2 * Math.log10(1 + lost)) * dt
            while (acc.current[k] >= 1) {
              acc.current[k] -= 1
              const ang = Math.PI * (0.15 + Math.random() * 0.7)
              ps.current.push({
                kind: 'drop', x: n.x + Math.cos(ang) * (R + 4), y: n.y + Math.sin(ang) * (R + 4), age: 0, dur: 1000, bad: true,
                color: m.blocked > m.dropRate ? 'var(--c-amber)' : 'var(--bad)', dx: Math.cos(ang) * 30,
              })
            }
          }
        }
        for (const p of ps.current) p.age += dtMs
        ps.current = ps.current.filter((p) => p.age < p.dur)
        if (ps.current.length > 800) ps.current.splice(0, ps.current.length - 800)
      }
      force((x) => (x + 1) % 1e6)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const { graph } = useStore.getState()
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const edges = Object.fromEntries(graph.edges.map((e) => [e.id, e]))
  return (
    <g>
      {ps.current.map((p, i) => {
        if (p.kind === 'flow') {
          const e = edges[p.edge!]
          if (!e || !byId[e.from] || !byId[e.to]) return null
          const pt = pointAt(edgeGeom(byId[e.from], byId[e.to], laneOf(e, graph.edges)), p.age / p.dur)
          return <rect key={i} x={pt.x - 4} y={pt.y - 4} width={8} height={8} rx={1.5} transform={`rotate(45 ${pt.x} ${pt.y})`} fill={p.bad ? 'var(--bad)' : p.color} />
        }
        const f = p.age / p.dur
        const x = p.x! + p.dx! * f
        const y = p.y! + f * 40
        return (
          <path key={i} d={`M${x - 3.5},${y - 3.5} L${x + 3.5},${y + 3.5} M${x + 3.5},${y - 3.5} L${x - 3.5},${y + 3.5}`} stroke={p.color} strokeWidth={2} strokeLinecap="round" opacity={1 - f} />
        )
      })}
    </g>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ViewportApi } from '../components/Viewport'
import { DT, step } from '../sim/engine'
import { challengeOf, useStore } from '../store'
import type { Kind } from '../types'
import { Commentary } from './Commentary'
import { Inspector } from './Inspector'
import { Palette } from './Palette'
import { SandboxCanvas } from './SandboxCanvas'
import { Scope, type Sample } from './Scope'

const MAX_HIST = 300

export function SandboxView() {
  const { leftOpen, rightOpen, graph, set, fitKey } = useStore()
  const vp = useRef<ViewportApi | null>(null)
  const [hold, setHold] = useState(0)
  const hist = useRef<Sample[]>([])
  const held = useRef(0)

  const tick = () => {
    const s = useStore.getState()
    const r = step(s.graph.nodes, s.graph.edges, s.runtime, s.offered, s.payloadKB)
    hist.current.push({ offered: s.offered, goodput: r.global.goodput, p99: r.global.p99, err: r.global.errorPct, drop: r.global.dropped })
    if (hist.current.length > MAX_HIST) hist.current.shift()
    useStore.setState({ metrics: r })

    // challenges: goals must hold for 5 s of simulated time
    const ch = challengeOf(s.challengeId)
    if (ch && !s.progress.challenges[ch.id] && r.global.t > 3) {
      const ok = ch.goals.every((g) => {
        const v = r.global[g.metric]
        return (g.max === undefined || v <= g.max) && (g.min === undefined || v >= g.min)
      })
      held.current = ok ? held.current + DT : 0
      if (held.current >= 5) {
        s.completeChallenge(ch.id)
        held.current = 0
      }
      setHold(held.current)
    } else if (held.current) {
      held.current = 0
      setHold(0)
    }
    return r
  }

  // new scenario or reset: start the traces over
  useEffect(() => {
    hist.current = []
  }, [fitKey])
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (prev.metrics && !s.metrics) hist.current = []
      }),
    [],
  )

  // the simulation clock: 10 ticks of 100 ms per real second
  useEffect(() => {
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.running && s.mode === 'sandbox') tick()
    }, DT * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      if (s.mode !== 'sandbox') return
      const t = e.target as HTMLElement
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.selection) {
          e.preventDefault()
          s.removeSelected()
        }
      } else if (e.key === ' ') {
        e.preventDefault()
        s.set({ running: !s.running })
      } else if (e.key === 'f' || e.key === 'F') vp.current?.fit()
      else if (e.key === 'Escape') s.set({ selection: null })
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const addAtCenter = (k: Kind) => {
    const el = vp.current?.el()
    if (!el || !vp.current) return
    const r = el.getBoundingClientRect()
    const p = vp.current.toWorld(r.left + r.width / 2, r.top + r.height / 2)
    const jitter = (graph.nodes.length % 5) * 33
    useStore.getState().addNode(k, Math.round(p.x + jitter), Math.round(p.y + jitter))
    if (innerWidth <= 1000) set({ leftOpen: false })
  }

  return (
    <div className="body">
      {leftOpen && (
        <aside className="sidebar" aria-label="Components and scenarios">
          <Palette onAdd={addAtCenter} />
        </aside>
      )}
      <main className="main">
        <div className="canvas-wrap">
          <SandboxCanvas ref={vp} />
          <Commentary />
        </div>
        <Scope hist={hist.current} onStep={() => { for (let i = 0; i < 10; i++) tick() }} />
      </main>
      {rightOpen && (
        <aside className="inspector" aria-label="Inspector">
          <Inspector hold={hold} />
        </aside>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { Viewport, type View, type ViewportApi } from '../components/Viewport'
import { Puck } from '../components/Puck'
import type { Lesson } from '../types'
import { COLORS, positionAt, tablesAt, type Timeline } from './timeline'

interface Props {
  lesson: Lesson
  stepIdx: number
  timeline: Timeline
  paused: boolean
  speed: number
  replay: number
  /** the scrubber fill for the current step, driven directly to avoid re-rendering the dock every frame */
  progressEl: React.RefObject<HTMLElement>
  onActive: (idx: number) => void
  onDone: () => void
  /** draw this node as an empty slot (the missing-piece puzzle) */
  ghostId?: string | null
  /** screen-space overlay that can anchor itself next to nodes */
  overlay?: (ctx: OverlayCtx) => ReactNode
}

export interface OverlayCtx {
  /** node centres in canvas pixels */
  screen: Record<string, { x: number; y: number }>
  /** puck radius in canvas pixels */
  r: number
  w: number
  h: number
}

const R = 30
const INSETS = { left: 40, right: 70, top: 96, bottom: 96 }

export function LessonCanvas({ lesson, stepIdx, timeline, paused, speed, replay, progressEl, onActive, onDone, ghostId, overlay }: Props) {
  const step = lesson.steps[stepIdx]
  const [t, setT] = useState(0)
  const vp = useRef<ViewportApi>(null)
  const cb = useRef({ onActive, onDone, paused, speed, total: timeline.total })
  cb.current = { onActive, onDone, paused, speed, total: timeline.total }

  // the clock: resets for each step / replay
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let time = 0
    let done = false
    let active = -1
    setT(0)
    const loop = (now: number) => {
      const c = cb.current
      if (!c.paused) time += (now - last) * c.speed
      last = now
      if (time <= c.total + 1000) setT(time)
      if (progressEl.current) progressEl.current.style.width = `${c.total ? Math.min(100, (time / c.total) * 100) : 100}%`
      let a = -1
      for (const m of timeline.msgs) if (m.start <= time) a = m.idx
      if (a !== active) {
        active = a
        c.onActive(a)
      }
      if (!done && time >= c.total) {
        done = true
        c.onDone()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [timeline, replay, progressEl])

  // on a tall, narrow canvas (phones) lay the diagram out top‑to‑bottom instead of left‑to‑right
  const wrap = useRef<HTMLDivElement>(null)
  const [portrait, setPortrait] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View | null>(null)
  useEffect(() => {
    const el = wrap.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
      setPortrait(el.clientHeight > el.clientWidth * 0.9 && el.clientWidth < 700)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const flip = <T extends { x: number; y: number }>(p: T): T => (portrait ? { ...p, x: p.y, y: p.x } : p)

  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {}
    lesson.nodes.forEach((n) => (p[n.id] = portrait ? { x: n.y, y: n.x } : { x: n.x, y: n.y }))
    return p
  }, [lesson, portrait])

  const bounds = useMemo(() => {
    const xs = lesson.nodes.map((n) => pos[n.id].x)
    const ys = lesson.nodes.map((n) => pos[n.id].y)
    const tables = lesson.steps.some((s) => s.tables)
    return {
      minX: Math.min(...xs) - 90,
      maxX: Math.max(...xs) + 90,
      minY: Math.min(...ys) - R - 40,
      maxY: Math.max(...ys) + R + (tables ? 170 : 70),
    }
  }, [lesson, pos])

  const tables = useMemo(() => tablesAt(lesson, stepIdx), [lesson, stepIdx])

  const hot = new Set<string>()
  const arriving = new Set<string>()
  const packets: JSX.Element[] = []
  for (const tm of timeline.msgs) {
    const color = COLORS[tm.msg.c ?? 'blue']
    const burst = tm.msg.burst ?? 1
    for (let k = 0; k < burst; k++) {
      const e = t - tm.start - k * 150
      if (e < 0) continue
      if (e <= tm.travel) {
        const p = positionAt(tm, e, pos)
        if (tm.path.length > 1) {
          hot.add(`${tm.path[p.hop - 1]}|${tm.path[p.hop]}`)
          hot.add(`${tm.path[p.hop]}|${tm.path[p.hop - 1]}`)
        }
        packets.push(
          <div key={`${tm.idx}-${k}`} className={`env${k ? ' ghost' : ''}`} style={{ left: p.x, top: p.y, ['--pc' as string]: color }}>
            <span>{k === 0 ? tm.msg.label : ''}</span>
          </div>,
        )
      } else if (tm.msg.drop && k === 0 && e <= tm.travel + 800) {
        const p = positionAt(tm, tm.travel, pos)
        const f = (e - tm.travel) / 800
        packets.push(
          <div key={`${tm.idx}-lost`} className="lost" style={{ left: p.x, top: p.y + f * 26, opacity: 1 - f * 0.8 }}>
            ✕ lost
          </div>,
        )
      } else if (!tm.msg.drop && k === 0 && e <= tm.travel + 500) {
        arriving.add(tm.path[tm.path.length - 1])
      }
    }
  }

  // no spotlight while the missing-piece puzzle is up
  const focus = ghostId ? undefined : step?.focus
  const involved = new Set<string>(focus ?? [])
  if (focus) for (const tm of timeline.msgs) tm.path.forEach((n) => involved.add(n))

  return (
    <>
      <div ref={wrap} style={{ display: 'none' }} />
      <Viewport ref={vp} bounds={bounds} insets={portrait ? { left: 20, right: 20, top: 70, bottom: 80 } : size.w > 1050 ? { ...INSETS, right: 430 } : INSETS} fitKey={`${lesson.id}:${portrait}:${size.w > 1050}`} maxFitZoom={1.05} onView={setView}>
        <svg className="wires" width="1" height="1">
          {lesson.links.map(([a, b, label]) => {
            const p = pos[a]
            const q = pos[b]
            if (!p || !q) return null
            const on = hot.has(`${a}|${b}`)
            const mx = (p.x + q.x) / 2
            const my = (p.y + q.y) / 2
            const w = label ? label.length * 6.6 + 14 : 0
            return (
              <g key={`${a}-${b}`}>
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={on ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={on ? 3.5 : 2.5} strokeLinecap="round" style={{ transition: 'stroke .2s' }} />
                {label && (
                  <g transform={`translate(${mx},${my})`}>
                    <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill="var(--surface)" stroke="var(--line)" />
                    <text y={4} textAnchor="middle" className="edge-chip" fill="var(--muted)">{label}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        {lesson.nodes.map((n) => (
          <Puck
            key={n.id + (arriving.has(n.id) ? '-a' : '')}
            kind={n.kind}
            x={pos[n.id].x}
            y={pos[n.id].y}
            r={R}
            label={n.label}
            sub={n.sub}
            ghost={ghostId === n.id}
            className={`${focus && !involved.has(n.id) ? 'dim' : ''} ${focus?.includes(n.id) ? 'focus' : ''} ${arriving.has(n.id) ? 'ping' : ''}`}
          />
        ))}
        {Object.entries(tables).map(([id, tb]) => {
          const p = pos[id]
          if (!p) return null
          return (
            <div key={id} className="receipt" style={{ left: p.x, top: p.y + R + (lesson.nodes.find((n) => n.id === id)?.sub ? 52 : 36) }} data-scroll>
              <div className="tt">{tb.title}</div>
              {tb.rows.length ? (
                <table>
                  <thead>
                    <tr>{tb.cols.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((r, i) => (
                      <tr key={i} className={tb.fresh?.includes(i) ? 'fresh' : ''}>
                        {r.map((c, j) => <td key={j}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty">— empty —</div>
              )}
            </div>
          )
        })}
        {step?.note && (
          <div className="annot" style={{ left: flip(step.note).x, top: flip(step.note).y }}>
            {step.note.text}
          </div>
        )}
        {packets}
      </Viewport>
      {overlay && view && size.w > 0 &&
        overlay({
          screen: Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, { x: p.x * view.k + view.x, y: p.y * view.k + view.y }])),
          r: R * view.k,
          w: size.w,
          h: size.h,
        })}
      <div className="canvas-tools">
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1.2)} aria-label="Zoom in"><Plus size={15} /></button>
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1 / 1.2)} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="ibtn sm" onClick={() => vp.current?.fit()} aria-label="Fit"><Maximize2 size={14} /></button>
      </div>
    </>
  )
}

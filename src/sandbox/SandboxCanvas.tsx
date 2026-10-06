import { forwardRef, useMemo, useRef, useState } from 'react'
import { Maximize2, Minus, Plus, StickyNote } from 'lucide-react'
import { KINDS } from '../catalog'
import { Puck, utilColor } from '../components/Puck'
import { Viewport, type ViewportApi } from '../components/Viewport'
import { fmtMs, fmtPct, fmtRate } from '../format'
import { useStore } from '../store'
import type { Kind, NodeMetrics, SimNode } from '../types'
import { edgeGeom, laneOf, pointAt, R } from './geometry'
import { Particles } from './Particles'

const INSETS = { left: 40, right: 80, top: 40, bottom: 40 }

/** pointer capture is best-effort: it throws for pointers the browser no longer tracks */
function capture(e: React.PointerEvent, el: Element = e.currentTarget as Element) {
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

export const SandboxCanvas = forwardRef<ViewportApi, object>(function SandboxCanvas(_props, ref) {
  const { graph, metrics, selection, set, fitKey } = useStore()
  const vp = useRef<ViewportApi | null>(null)
  const [wire, setWire] = useState<{ from: string; x: number; y: number; over: string | null } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const bounds = useMemo(() => {
    const xs = graph.nodes.flatMap((n) => [n.x - 90, n.x + 90]).concat(graph.notes.flatMap((n) => [n.x, n.x + (n.w ?? 400)]))
    const ys = graph.nodes.flatMap((n) => [n.y - R - 10, n.y + R + 70]).concat(graph.notes.flatMap((n) => [n.y, n.y + 120]))
    if (!xs.length) return { minX: -400, maxX: 400, minY: -200, maxY: 200 }
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    // refit on preset load only, not on every drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, graph.nodes.length === 0])

  const byId = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph.nodes])

  const setRefs = (v: ViewportApi | null) => {
    vp.current = v
    if (typeof ref === 'function') ref(v)
    else if (ref) ref.current = v
  }

  const onDrop = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData('application/x-kind') as Kind
    if (!kind || !KINDS[kind] || !vp.current) return
    e.preventDefault()
    const p = vp.current.toWorld(e.clientX, e.clientY)
    useStore.getState().addNode(kind, Math.round(p.x), Math.round(p.y))
  }

  /* --- dragging pucks and memos --- */
  const drag = useRef<{ id: string; type: 'node' | 'note'; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const startDrag = (e: React.PointerEvent, id: string, type: 'node' | 'note', x: number, y: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    drag.current = { id, type, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false }
    set({ selection: { type, id } })
  }
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !vp.current) return
    const k = vp.current.view.k
    const dx = (e.clientX - d.sx) / k
    const dy = (e.clientY - d.sy) / k
    if (!d.moved && Math.hypot(dx, dy) < 3) return
    if (!d.moved) useStore.getState().commit()
    d.moved = true
    const nx = Math.round((d.ox + dx) / 11) * 11
    const ny = Math.round((d.oy + dy) / 11) * 11
    if (d.type === 'node') useStore.getState().moveNode(d.id, nx, ny)
    else useStore.getState().moveNote(d.id, nx, ny)
  }
  const endDrag = () => (drag.current = null)

  /* --- wiring from a puck's port --- */
  const startWire = (e: React.PointerEvent, from: string) => {
    e.stopPropagation()
    capture(e)
    const p = vp.current!.toWorld(e.clientX, e.clientY)
    setWire({ from, x: p.x, y: p.y, over: null })
  }
  const moveWire = (e: React.PointerEvent) => {
    if (!wire) return
    const p = vp.current!.toWorld(e.clientX, e.clientY)
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]') as HTMLElement | null
    const over = el?.dataset.node && el.dataset.node !== wire.from ? el.dataset.node : null
    setWire({ ...wire, x: p.x, y: p.y, over })
  }
  const endWire = () => {
    if (wire?.over) useStore.getState().connect(wire.from, wire.over)
    setWire(null)
  }

  const nm = metrics?.nodes ?? {}
  const em = metrics?.edges ?? {}

  return (
    <>
      <Viewport
        ref={setRefs}
        bounds={bounds}
        insets={INSETS}
        fitKey={fitKey}
        maxFitZoom={1.1}
        onBackgroundDown={() => {
          set({ selection: null })
          setEditing(null)
        }}
        onDrop={onDrop}
        onView={(v) => setZoom(v.k)}
      >
        <svg className="wires" width="1" height="1">
          {graph.edges.map((e) => {
            const a = byId[e.from]
            const b = byId[e.to]
            if (!a || !b) return null
            const g = edgeGeom(a, b, laneOf(e, graph.edges))
            const m = em[e.id]
            const sel = selection?.type === 'edge' && selection.id === e.id
            const u = m?.util ?? 0
            const stroke = u >= 0.75 ? utilColor(u) : sel ? 'var(--accent)' : 'var(--line-strong)'
            const mid = pointAt(g, 0.5)
            const label = m ? `${fmtRate(m.flow)}/s${u >= 0.5 ? ` · ${fmtPct(Math.min(u, 9.99))}` : ''}` : ''
            const tags = [e.params.bandwidthMbps < 1000 ? `${e.params.bandwidthMbps} Mb/s` : '', e.params.latencyMs >= 10 ? `${e.params.latencyMs} ms` : '', e.params.lossPct > 0 ? `${e.params.lossPct}% loss` : ''].filter(Boolean).join(' · ')
            const w = label.length * 6.7 + 16
            return (
              <g key={e.id}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={stroke} strokeWidth={sel ? 3.5 : 2.5} strokeLinecap="round" />
                <path d={arrowHead(g)} fill={stroke} />
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="edge-hit" onPointerDown={(ev) => { ev.stopPropagation(); set({ selection: { type: 'edge', id: e.id } }) }} />
                {label && (
                  <g transform={`translate(${mid.x},${mid.y - 16})`} style={{ pointerEvents: 'none' }}>
                    <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill="var(--surface)" stroke={u >= 0.75 ? stroke : 'var(--line)'} />
                    <text y={4} textAnchor="middle" className="edge-chip" fill={u >= 0.75 ? stroke : 'var(--ink-2)'}>{label}</text>
                  </g>
                )}
                {tags && (
                  <text x={mid.x} y={mid.y + 20} textAnchor="middle" className="edge-chip" fill="var(--muted)" style={{ fontSize: 10.5, pointerEvents: 'none' }}>{tags}</text>
                )}
              </g>
            )
          })}
          <Particles />
          {wire && byId[wire.from] && (
            <line {...(() => { const g = edgeGeom(byId[wire.from], { x: wire.x, y: wire.y }, 0, 0); return { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 } })()} stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
          )}
        </svg>

        {graph.notes.map((n) => {
          const sel = selection?.type === 'note' && selection.id === n.id
          return (
            <div
              key={n.id}
              className={`memo${sel ? ' sel' : ''}`}
              style={{ left: n.x, top: n.y, width: n.w ?? 400 }}
              onPointerDown={(e) => editing !== n.id && startDrag(e, n.id, 'note', n.x, n.y)}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onDoubleClick={() => setEditing(n.id)}
            >
              <div className="eyebrow"><StickyNote size={12} /> note</div>
              {editing === n.id ? (
                <textarea
                  autoFocus
                  defaultValue={n.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    useStore.getState().updateNote(n.id, e.target.value)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Escape' && (e.target as HTMLTextAreaElement).blur()}
                />
              ) : (
                n.text
              )}
            </div>
          )
        })}

        {graph.nodes.map((n) => (
          <Device
            key={n.id}
            node={n}
            m={nm[n.id]}
            selected={selection?.type === 'node' && selection.id === n.id}
            target={wire?.over === n.id}
            onDown={(e) => startDrag(e, n.id, 'node', n.x, n.y)}
            onMove={(e) => (wire ? moveWire(e) : onDragMove(e))}
            onUp={() => (wire ? endWire() : endDrag())}
            onWireDown={(e) => startWire(e, n.id)}
          />
        ))}
      </Viewport>

      <div className="canvas-tools">
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1.2)} aria-label="Zoom in"><Plus size={15} /></button>
        <span className="z">{Math.round(zoom * 100)}%</span>
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1 / 1.2)} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="ibtn sm" onClick={() => vp.current?.fit()} aria-label="Fit" title="Fit (F)"><Maximize2 size={14} /></button>
        <button
          className="ibtn sm"
          aria-label="Add a note"
          title="Add a note"
          onClick={() => {
            const el = vp.current?.el()
            if (!el || !vp.current) return
            const r = el.getBoundingClientRect()
            const p = vp.current.toWorld(r.left + r.width / 2, r.top + r.height / 2)
            useStore.getState().addNote(Math.round(p.x - 180), Math.round(p.y))
          }}
        >
          <StickyNote size={14} />
        </button>
      </div>
      {!graph.nodes.length && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>An empty bench</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>Drag a Client and a Server in from the left, then drag from the ＋ port to wire them.</div>
          </div>
        </div>
      )}
    </>
  )
})

function arrowHead(g: { x1: number; y1: number; x2: number; y2: number }) {
  const a = Math.atan2(g.y2 - g.y1, g.x2 - g.x1)
  const L = 11
  const W = 6
  const bx = g.x2 + Math.cos(a) * 4
  const by = g.y2 + Math.sin(a) * 4
  const p1 = [bx - Math.cos(a) * L - Math.sin(a) * W, by - Math.sin(a) * L + Math.cos(a) * W]
  const p2 = [bx - Math.cos(a) * L + Math.sin(a) * W, by - Math.sin(a) * L - Math.cos(a) * W]
  return `M${bx},${by} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z`
}

interface DeviceProps {
  node: SimNode
  m?: NodeMetrics
  selected: boolean
  target: boolean
  onDown: (e: React.PointerEvent) => void
  onMove: (e: React.PointerEvent) => void
  onUp: () => void
  onWireDown: (e: React.PointerEvent) => void
}

function Device({ node, m, selected, target, onDown, onMove, onUp, onWireDown }: DeviceProps) {
  const info = KINDS[node.kind]
  const src = info.cat === 'traffic'
  const util = m?.util ?? 0
  const hot = !!m && (m.dropRate > 0.5 || (!src && util > 1.02) || (src && node.kind !== 'botnet' && m.failPct > 0.05))
  const isCache = node.params.hitRate > 0 && ['cache', 'cdn', 'dns', 'kvcache'].includes(node.kind)

  let chip: React.ReactNode
  let chipBad = false
  if (!m) chip = src ? 'idle' : `${fmtRate((node.params.concurrency * 1000) / node.params.serviceMs)}/s max`
  else if (node.kind === 'botnet') chip = `${fmtRate(m.out)}/s junk`
  else if (src) {
    chip = m.failPct > 0.005 ? `${fmtRate(m.out)}/s · ${fmtPct(m.failPct)} fail` : `${fmtRate(m.out)}/s · ${fmtMs(m.p99)}`
    chipBad = m.failPct > 0.01
  } else if (node.kind === 'firewall' && m.blocked > 0.5) chip = `${fmtPct(Math.min(util, 9.99))} · ${fmtRate(m.blocked)}/s blocked`
  else if (isCache) chip = `${fmtPct(Math.min(util, 9.99))} · ${fmtPct(node.params.hitRate)} hit`
  else {
    const q = Math.round(m.backlog)
    chip = `${util > 9.99 ? '>999%' : fmtPct(util)} · ${fmtMs(m.p99)}${q >= 1 ? ` · ${fmtRate(q)} queued` : ''}`
    chipBad = util > 1
  }

  return (
    <Puck
      kind={node.kind}
      x={node.x}
      y={node.y}
      r={R}
      label={node.label}
      chip={chip}
      chipBad={chipBad}
      ring={src ? undefined : util}
      nodeId={node.id}
      className={`${selected ? 'sel' : ''} ${hot ? 'hot' : ''} ${target ? 'target' : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <span className="port" onPointerDown={onWireDown} onPointerMove={onMove} onPointerUp={onUp} title="Drag to connect">
        <Plus size={12} strokeWidth={2.6} />
      </span>
    </Puck>
  )
}

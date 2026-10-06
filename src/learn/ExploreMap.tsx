import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Blocks, Check, Compass, Maximize2, Minus, Plus, X } from 'lucide-react'
import { KINDS } from '../catalog'
import { Puck } from '../components/Puck'
import { Viewport, type View, type ViewportApi } from '../components/Viewport'
import { LESSON_BY_ID, LESSONS } from '../lessons'
import { useStore } from '../store'
import { AMBIENT_ROUTE, CONNECTION, MAP_LINKS, MAP_NODES, ZONES } from './mapData'

const R = 40
const byId = Object.fromEntries(MAP_NODES.map((n) => [n.id, n]))
const BOUNDS = {
  minX: Math.min(...ZONES.map((z) => z.x)) - 20,
  maxX: Math.max(...ZONES.map((z) => z.x + z.w)) + 20,
  minY: Math.min(...ZONES.map((z) => z.y)) - 20,
  maxY: Math.max(...ZONES.map((z) => z.y + z.h)) + 20,
}
const INSETS = { left: 30, right: 30, top: 150, bottom: 30 }
const ARC_Y = -150

/** a little request that keeps travelling laptop → web server and back, so the map feels alive */
function useAmbient() {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      setT(now - start)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}

function along(route: string[], f: number) {
  const segs = route.length - 1
  const x = Math.min(segs - 1e-6, Math.max(0, f * segs))
  const i = Math.floor(x)
  const a = byId[route[i]]
  const b = byId[route[i + 1]]
  const u = x - i
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
}

function Ambient() {
  const t = useAmbient()
  // three requests in flight, staggered; responses come back the other way
  const CYCLE = 9000
  const dots = [0, 3000, 6000].map((off) => {
    const p = ((t + off) % CYCLE) / CYCLE
    const fwd = p < 0.5
    return { ...along(AMBIENT_ROUTE, fwd ? p * 2 : 1 - (p - 0.5) * 2), fwd }
  })
  const q = (t % 4500) / 4500
  const dns = along(['net', 'dns'], q < 0.5 ? q * 2 : 1 - (q - 0.5) * 2)
  return (
    <g style={{ pointerEvents: 'none' }}>
      {dots.map((d, i) => (
        <rect key={i} x={d.x - 5} y={d.y - 5} width={10} height={10} rx={2} transform={`rotate(45 ${d.x} ${d.y})`} fill={d.fwd ? 'var(--c-blue)' : 'var(--c-green)'} />
      ))}
      <rect x={dns.x - 4} y={dns.y - 4} width={8} height={8} rx={2} transform={`rotate(45 ${dns.x} ${dns.y})`} fill="var(--c-amber)" />
    </g>
  )
}

type Sel = { kind: 'node'; id: string } | { kind: 'conn' } | null

export function ExploreMap() {
  const { progress, openLesson, loadPreset } = useStore()
  const vp = useRef<ViewportApi>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [sel, setSel] = useState<Sel>(null)

  const doneOf = (ids: string[]) => ids.filter((id) => progress.done[id]).length
  const total = LESSONS.length
  const explored = LESSONS.filter((l) => progress.done[l.id]).length

  const toScreen = (x: number, y: number) => ({ x: x * view.k + view.x, y: y * view.k + view.y })
  const card = useMemo(() => {
    if (!sel) return null
    if (sel.kind === 'conn') {
      const a = byId[CONNECTION.from]
      const b = byId[CONNECTION.to]
      return { title: CONNECTION.label, teaser: CONNECTION.teaser, lessons: CONNECTION.lessons, kind: null, at: { x: (a.x + b.x) / 2, y: ARC_Y - 10 } }
    }
    const n = byId[sel.id]
    return { title: n.label, teaser: n.teaser, lessons: n.lessons, kind: n.kind, at: { x: n.x, y: n.y } }
  }, [sel])

  const cardPos = card ? toScreen(card.at.x, card.at.y) : null
  const arcMid = { x: (byId.lap.x + byId.web.x) / 2, y: ARC_Y }

  return (
    <>
      <Viewport ref={vp} bounds={{ ...BOUNDS, minY: ARC_Y - 70 }} insets={INSETS} fitKey="explore-map" maxFitZoom={1} onView={setView} onBackgroundDown={() => setSel(null)}>
        {ZONES.map((z) => (
          <div key={z.label} className="zone" style={{ left: z.x, top: z.y, width: z.w, height: z.h }}>
            <span>{z.label}</span>
          </div>
        ))}
        <svg className="wires" width="1" height="1">
          {MAP_LINKS.map(([a, b]) => (
            <line key={a + b} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y} stroke="var(--line-strong)" strokeWidth={2.5} strokeLinecap="round" />
          ))}
          <path
            d={`M${byId.lap.x},${byId.lap.y - R - 10} C${byId.lap.x + 120},${ARC_Y - 60} ${byId.web.x - 120},${ARC_Y - 60} ${byId.web.x},${byId.web.y - R - 10}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="7 7"
            opacity={0.7}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={() => setSel({ kind: 'conn' })}
          />
          <Ambient />
        </svg>
        <button className={`conn-chip${sel?.kind === 'conn' ? ' on' : ''}`} style={{ left: arcMid.x, top: arcMid.y - 46 }} onClick={() => setSel({ kind: 'conn' })}>
          {doneOf(CONNECTION.lessons) === CONNECTION.lessons.length ? <Check size={13} /> : null}
          {CONNECTION.label}
          <small>{doneOf(CONNECTION.lessons)}/{CONNECTION.lessons.length}</small>
        </button>
        {MAP_NODES.map((n) => {
          const d = doneOf(n.lessons)
          return (
            <Puck
              key={n.id}
              kind={n.kind}
              x={n.x}
              y={n.y}
              r={R}
              label={n.label}
              ring={d / n.lessons.length}
              ringColor="var(--accent)"
              chip={d === n.lessons.length ? '✓ explored' : `${n.lessons.length} ${n.lessons.length === 1 ? 'lesson' : 'lessons'}`}
              className={`clickable map-puck${sel?.kind === 'node' && sel.id === n.id ? ' sel' : ''}`}
              onClick={() => setSel({ kind: 'node', id: n.id })}
            />
          )
        })}
      </Viewport>

      <div className="map-hero">
        <span className="eyebrow"><Compass size={12} /> Explore</span>
        <h1>This is the Internet. <em>Click anything</em> to see how it works.</h1>
        <p>Every box hides a short animated lesson. Start wherever you are curious; the rings fill as you explore.</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => openLesson('what-is-a-network')}>Start with the basics <ArrowRight size={15} /></button>
          <button className="btn" onClick={() => loadPreset('m-online', { mission: 'online' })}><Blocks size={15} /> Learn by building</button>
          <span className="mono muted" style={{ fontSize: 12 }}>{explored} / {total} explored</span>
        </div>
      </div>

      <div className="canvas-tools">
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1.2)} aria-label="Zoom in"><Plus size={15} /></button>
        <button className="ibtn sm" onClick={() => vp.current?.zoomBy(1 / 1.2)} aria-label="Zoom out"><Minus size={15} /></button>
        <button className="ibtn sm" onClick={() => vp.current?.fit()} aria-label="Fit"><Maximize2 size={14} /></button>
      </div>

      {card && cardPos && (
        <MapCard
          x={cardPos.x}
          y={cardPos.y}
          r={R * view.k}
          title={card.title}
          teaser={card.teaser}
          kindDesc={card.kind ? KINDS[card.kind].desc : null}
          lessons={card.lessons}
          done={progress.done}
          onOpen={openLesson}
          onClose={() => setSel(null)}
        />
      )}
    </>
  )
}

function MapCard(props: {
  x: number
  y: number
  r: number
  title: string
  teaser: string
  kindDesc: string | null
  lessons: string[]
  done: Record<string, boolean>
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: props.x + props.r + 16, top: props.y - 40 })
  // keep the card inside the canvas: prefer the right of the device, flip left when there is no room
  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const W = parent.clientWidth
    const H = parent.clientHeight
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = props.x + props.r + 16
    if (left + w > W - 12) left = props.x - props.r - 16 - w
    left = Math.max(12, Math.min(W - w - 12, left))
    const top = Math.max(12, Math.min(H - h - 12, props.y - 40))
    setPos({ left, top })
  }, [props.x, props.y, props.r, props.title])
  return (
    <div className="map-card" ref={ref} style={pos} role="dialog" aria-label={props.title}>
      <div className="mc-head">
        <b>{props.title}</b>
        <button className="ibtn sm" onClick={props.onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <p className="mc-teaser">{props.teaser}</p>
      <div className="mc-list">
        {props.lessons.map((id) => {
          const l = LESSON_BY_ID[id]
          if (!l) return null
          return (
            <button key={id} className="mc-lesson" onClick={() => props.onOpen(id)}>
              <span className={`dotc${props.done[id] ? ' done' : ''}`}>{props.done[id] && <Check size={9} strokeWidth={3.5} />}</span>
              <span className="mc-title">{l.title}<small>{l.blurb}</small></span>
              <span className={`lvl ${l.level}`}>{l.level === 'beginner' ? 'beg' : 'int'}</span>
              <ArrowRight size={14} className="mc-go" />
            </button>
          )
        })}
      </div>
      {props.kindDesc && <p className="mc-desc">{props.kindDesc}</p>}
    </div>
  )
}

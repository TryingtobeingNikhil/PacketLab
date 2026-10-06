import { useMemo, useState } from 'react'
import { fmtMs } from '../format'
import { LogSlider } from './basic'

/* ------------------------------ HTTP versions ------------------------------ */
interface Bar { row: string; from: number; to: number; kind: 'setup' | 'html' | 'res' }

function httpPlan(v: 1 | 2 | 3, n: number): { bars: Bar[]; total: number } {
  const bars: Bar[] = []
  const setup = v === 3 ? 1 : 2 // TCP + TLS1.3 vs QUIC
  if (v === 1) {
    bars.push({ row: 'conn 1', from: 0, to: setup, kind: 'setup' })
    bars.push({ row: 'conn 1', from: setup, to: setup + 1, kind: 'html' })
    const conns = Math.min(6, n)
    const per = Array.from({ length: conns }, (_, i) => (i === 0 ? setup + 1 : setup + 1 + setup))
    for (let i = 1; i < conns; i++) bars.push({ row: `conn ${i + 1}`, from: setup + 1, to: setup + 1 + setup, kind: 'setup' })
    for (let r = 0; r < n; r++) {
      let best = 0
      for (let c = 1; c < conns; c++) if (per[c] < per[best]) best = c
      bars.push({ row: `conn ${best + 1}`, from: per[best], to: per[best] + 1, kind: 'res' })
      per[best] += 1
    }
    return { bars, total: Math.max(...per) }
  }
  bars.push({ row: 'conn 1', from: 0, to: setup, kind: 'setup' })
  bars.push({ row: 'conn 1', from: setup, to: setup + 1, kind: 'html' })
  bars.push({ row: `conn 1`, from: setup + 1, to: setup + 2, kind: 'res' })
  return { bars, total: setup + 2 }
}

export function HttpWidget() {
  const [n, setN] = useState(18)
  const [rtt, setRtt] = useState(80)
  const plans = useMemo(() => ([1, 2, 3] as const).map((v) => ({ v, ...httpPlan(v, n) })), [n])
  const maxT = Math.max(...plans.map((p) => p.total))
  const colors = { setup: 'var(--c-amber)', html: 'var(--c-violet)', res: 'var(--c-blue)' }
  return (
    <div className="widget">
      <h4>Loading a page: HTTP/1.1 vs 2 vs 3</h4>
      <div className="knob">
        <div className="row"><span className="name">Resources on the page</span><span className="val">{n}</span></div>
        <input type="range" min={1} max={40} value={n} onChange={(e) => setN(+e.target.value)} style={{ ['--pct' as string]: `${((n - 1) / 39) * 100}%` }} aria-label="resources" />
      </div>
      <LogSlider label="Round‑trip time" v={rtt} set={setRtt} min={5} max={400} show={fmtMs(rtt)} />
      {plans.map((p) => {
        const rows = [...new Set(p.bars.map((b) => b.row))]
        return (
          <div key={p.v} style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 12.5 }}>{p.v === 1 ? 'HTTP/1.1 (6 connections)' : p.v === 2 ? 'HTTP/2 (1 connection, multiplexed)' : 'HTTP/3 (QUIC)'}</b>
              <span className="mono" style={{ fontSize: 12.5 }}>{fmtMs(p.total * rtt)}</span>
            </div>
            <div style={{ position: 'relative', marginTop: 4 }}>
              {rows.map((r) => (
                <div key={r} style={{ position: 'relative', height: 9, margin: '2px 0', background: 'var(--panel)', borderRadius: 3 }}>
                  {p.bars.filter((b) => b.row === r).map((b, i) => (
                    <div key={i} title={b.kind} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(b.from / maxT) * 100}%`, width: `calc(${((b.to - b.from) / maxT) * 100}% - 1px)`, background: colors[b.kind], borderRadius: 2, opacity: b.kind === 'res' ? 0.85 : 1 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
        <span style={{ color: 'var(--c-amber)' }}>■</span> handshakes &nbsp;<span style={{ color: 'var(--c-violet)' }}>■</span> HTML &nbsp;<span style={{ color: 'var(--c-blue)' }}>■</span> other resources · each block = 1 RTT, no packet loss
      </div>
    </div>
  )
}

/* ------------------------------ Collectives ------------------------------ */
export function CollectiveWidget() {
  const [n, setN] = useState(64)
  const [gb, setGb] = useState(14) // gradient size in GB (7B params in bf16)
  const [bw, setBw] = useState(50) // GB/s per GPU (400 Gb/s)
  const alpha = 0.008 // ms per hop
  const ring = ((2 * (n - 1)) / n) * (gb / bw) * 1000 + 2 * (n - 1) * alpha
  const ps = ((2 * n * gb) / bw) * 1000
  const tree = 2 * Math.log2(n) * alpha + ((2 * (n - 1)) / n) * (gb / bw) * 1000 * 1.05
  const max = Math.max(ring, ps, tree)
  const rows = [
    { k: 'Central parameter server', v: ps, c: 'var(--c-red)' },
    { k: 'Ring all‑reduce', v: ring, c: 'var(--c-blue)' },
    { k: 'Tree / hierarchical', v: tree, c: 'var(--c-teal)' },
  ]
  return (
    <div className="widget">
      <h4>How long does one all‑reduce take?</h4>
      <LogSlider label="GPUs" v={n} set={(v) => setN(Math.max(2, Math.round(v)))} min={2} max={32768} show={n.toLocaleString()} />
      <LogSlider label="Gradient size" v={gb} set={setGb} min={0.1} max={400} show={`${gb.toFixed(gb < 10 ? 1 : 0)} GB`} />
      <LogSlider label="Network per GPU" v={bw} set={setBw} min={3} max={900} show={`${bw.toFixed(0)} GB/s (${Math.round(bw * 8)} Gb/s)`} />
      <div style={{ marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.k} className="lat-row">
            <div>
              <div className="lat-label"><span>{r.k}</span></div>
              <div className="lat-bar" style={{ width: `${Math.max(1, (Math.log10(r.v + 1) / Math.log10(max + 1)) * 100)}%`, background: r.c }} />
            </div>
            <span className="mono" style={{ textAlign: 'right' }}>{fmtMs(r.v)}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '6px 2px 0' }}>
        Ring sends {((2 * (n - 1)) / n).toFixed(2)}× the gradient per GPU no matter how many GPUs; the parameter server’s link carries {n}× in and out. (log‑scale bars; tree assumes latency‑optimal reduction.)
      </p>
    </div>
  )
}

/* ------------------------------ Parallelism ------------------------------ */
const PAR = {
  data: { name: 'Data', split: 'The batch', when: 'Once per step', pattern: 'All‑reduce of gradients', volume: '≈2× model size per GPU per step', fabric: 'Scale‑out (IB / RoCE)' },
  tensor: { name: 'Tensor', split: 'Each layer’s matrices', when: 'Every layer, forward and backward', pattern: 'All‑reduce / all‑gather inside a group', volume: 'Activations, many times per step', fabric: 'Scale‑up (NVLink)' },
  pipeline: { name: 'Pipeline', split: 'Groups of layers (stages)', when: 'Each micro‑batch, between stages', pattern: 'Point‑to‑point send/recv', volume: 'Activations at stage boundaries', fabric: 'Scale‑out is fine' },
  expert: { name: 'Expert (MoE)', split: 'The experts of each MoE layer', when: 'Every MoE layer', pattern: 'All‑to‑all (token dispatch + combine)', volume: 'Tokens × hidden size, twice per layer', fabric: 'Both — the hardest pattern' },
} as const
type ParK = keyof typeof PAR

export function ParallelismWidget() {
  const [k, setK] = useState<ParK>('data')
  const p = PAR[k]
  const gpus = Array.from({ length: 8 }, (_, i) => ({ i, x: 30 + (i % 4) * 80, y: i < 4 ? 40 : 130 }))
  const arrows: [number, number][] = []
  if (k === 'data') for (let i = 0; i < 8; i++) arrows.push([[0, 1, 2, 3, 7, 6, 5, 4][i], [1, 2, 3, 7, 6, 5, 4, 0][i]])
  if (k === 'tensor') for (const g of [[0, 1, 2, 3], [4, 5, 6, 7]]) for (const a of g) for (const b of g) if (a < b) arrows.push([a, b])
  if (k === 'pipeline') arrows.push([0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7])
  if (k === 'expert') for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) arrows.push([a, b])
  return (
    <div className="widget">
      <h4>Traffic pattern by parallelism</h4>
      <div className="seg small" style={{ flexWrap: 'wrap' }}>
        {(Object.keys(PAR) as ParK[]).map((x) => (
          <button key={x} className={x === k ? 'on' : ''} onClick={() => setK(x)}>{PAR[x].name}</button>
        ))}
      </div>
      <svg viewBox="0 0 330 170" width="100%" style={{ display: 'block', marginTop: 8 }} role="img" aria-label={`${p.name} parallelism traffic`}>
        {k === 'tensor' && (
          <>
            <rect x={10} y={20} width={310} height={42} rx={10} fill="none" stroke="var(--c-pink)" strokeDasharray="4 4" />
            <rect x={10} y={110} width={310} height={42} rx={10} fill="none" stroke="var(--c-pink)" strokeDasharray="4 4" />
          </>
        )}
        {arrows.map(([a, b], i) => {
          const A = gpus[a]
          const B = gpus[b]
          const bend = k === 'tensor' || k === 'expert' ? 18 * (Math.abs(a - b) > 1 ? 1 : 0) : 0
          const mx = (A.x + B.x) / 2
          const my = (A.y + B.y) / 2 - bend
          return <path key={i} d={`M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`} fill="none" stroke={k === 'expert' ? 'var(--c-amber)' : k === 'tensor' ? 'var(--c-pink)' : k === 'data' ? 'var(--c-teal)' : 'var(--c-blue)'} strokeWidth={1.6} opacity={0.75} />
        })}
        {gpus.map((g) => (
          <g key={g.i}>
            <rect x={g.x - 22} y={g.y - 14} width={44} height={28} rx={7} fill="var(--panel)" stroke="var(--border-strong)" />
            <text x={g.x} y={g.y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--text)">GPU{g.i}</text>
          </g>
        ))}
        <text x={4} y={12} fontSize="9.5" fill="var(--muted)" fontFamily="var(--mono)">server 1</text>
        <text x={4} y={168} fontSize="9.5" fill="var(--muted)" fontFamily="var(--mono)">server 2</text>
      </svg>
      <dl className="kv">
        <dt>Splits</dt><dd>{p.split}</dd>
        <dt>Talks</dt><dd>{p.when}</dd>
        <dt>Pattern</dt><dd>{p.pattern}</dd>
        <dt>Volume</dt><dd>{p.volume}</dd>
        <dt>Best on</dt><dd>{p.fabric}</dd>
      </dl>
    </div>
  )
}

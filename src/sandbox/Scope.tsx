import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { fmtMs, fmtPct, fmtRate, logToVal, valToLog } from '../format'
import { useStore } from '../store'

export interface Sample {
  offered: number
  goodput: number
  p99: number
  err: number
  drop: number
}

function Trace({ series, colors, log }: { series: number[][]; colors: string[]; log?: boolean }) {
  const n = 300
  const f = (v: number) => (log ? Math.log10(1 + Math.max(0, v)) : Math.max(0, v))
  const max = Math.max(1e-9, ...series.flat().map(f)) * 1.15
  return (
    <svg className="chart" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" role="img" aria-hidden>
      {[25, 50, 75].map((y) => <line key={y} x1={0} x2={n} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />)}
      {series.map((s, i) => {
        const off = n - s.length
        const pts = s.map((v, j) => `${off + j},${100 - (f(v) / max) * 94}`).join(' ')
        return (
          <g key={i}>
            {i === series.length - 1 && s.length > 1 && (
              <polygon points={`${off},100 ${pts} ${n - 1},100`} fill={colors[i]} opacity={0.1} />
            )}
            <polyline points={pts} fill="none" stroke={colors[i]} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        )
      })}
    </svg>
  )
}

export function Scope({ hist, onStep }: { hist: Sample[]; onStep: () => void }) {
  const { offered, set, metrics, running, resetSim } = useStore()
  const g = metrics?.global
  const pos = valToLog(offered, 1, 10000)
  const p99Cls = !g ? '' : g.p99 > 1000 ? 'bad' : g.p99 > 300 ? 'warn' : ''
  return (
    <section className="scope" aria-label="Live measurements">
      <div className="throttle">
        <span className="eyebrow">Offered load</span>
        <div className="big">{fmtRate(offered)}<small>req/s</small></div>
        <input
          type="range"
          min={0}
          max={1000}
          value={pos}
          onChange={(e) => {
            const v = logToVal(+e.target.value, 1, 10000)
            set({ offered: v < 10 ? Math.round(v * 2) / 2 : v < 1000 ? Math.round(v) : Math.round(v / 10) * 10 })
          }}
          style={{ ['--pct' as string]: `${pos / 10}%` }}
          aria-label="Offered load"
        />
        <div className="ticks"><span>1</span><span>10</span><span>100</span><span>1k</span><span>10k</span></div>
        <div className="transport">
          <button className="btn sm primary" onClick={() => set({ running: !running })} title="Run / pause (space)" style={{ minWidth: 76 }}>
            {running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Run</>}
          </button>
          <button className="ibtn sm" onClick={onStep} disabled={running} aria-label="Step one second" title="Advance 1 s (while paused)"><StepForward size={15} /></button>
          <button className="ibtn sm" onClick={resetSim} aria-label="Reset" title="Empty every queue and start over"><RotateCcw size={14} /></button>
          <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 11 }}>t = {g ? g.t.toFixed(0) : 0}s</span>
        </div>
      </div>
      <div>
        <div className="chart-head">
          <span className="eyebrow">Throughput</span>
          <span className="v">{g ? `${fmtRate(g.goodput)}/s` : '—'}</span>
        </div>
        <Trace series={[hist.map((h) => h.offered), hist.map((h) => h.goodput)]} colors={['var(--faint)', 'var(--c-teal)']} />
        <div className="legend"><span><i style={{ background: 'var(--faint)' }} />offered</span><span><i style={{ background: 'var(--c-teal)' }} />goodput</span></div>
      </div>
      <div className="c-lat">
        <div className="chart-head">
          <span className="eyebrow">p99 latency</span>
          <span className={`v ${p99Cls}`}>{g ? fmtMs(g.p99) : '—'}</span>
        </div>
        <Trace series={[hist.map((h) => h.p99)]} colors={['var(--accent)']} log />
        <div className="legend"><span>slowest 1 in 100 requests · log scale</span></div>
      </div>
      <div className="c-err">
        <div className="chart-head">
          <span className="eyebrow">Errors</span>
          <span className={`v ${g && g.errorPct > 0.05 ? 'bad' : g && g.errorPct > 0.005 ? 'warn' : ''}`}>{g ? fmtPct(g.errorPct) : '—'}</span>
        </div>
        <Trace series={[hist.map((h) => h.drop), hist.map((h) => h.err * 100)]} colors={['var(--c-amber)', 'var(--bad)']} />
        <div className="legend"><span><i style={{ background: 'var(--bad)' }} />error %</span><span><i style={{ background: 'var(--c-amber)' }} />drops/s {g ? fmtRate(g.dropped) : ''}</span></div>
      </div>
    </section>
  )
}

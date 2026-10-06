import { CheckCircle2, Circle, FlaskConical, Lightbulb, Trash2, Trophy } from 'lucide-react'
import { CAT_COLOR, KINDS, KNOB_META } from '../catalog'
import { fmtBits, fmtBytes, fmtMs, fmtPct, fmtRate, logToVal, nice, valToLog } from '../format'
import { capacityOf, linkCapacity } from '../sim/engine'
import { PRESET_BY_ID } from '../sim/presets'
import type { Goal } from '../sim/challenges'
import { MissionPanel } from '../build/MissionPanel'
import { challengeOf, useStore } from '../store'
import type { EdgeMetrics, LinkParams, NodeMetrics, NodeParams, SimEdge, SimNode } from '../types'

export function Inspector({ hold }: { hold: number }) {
  const { selection, graph, metrics } = useStore()
  if (selection?.type === 'node') {
    const n = graph.nodes.find((x) => x.id === selection.id)
    if (n) return <NodeInspector n={n} m={metrics?.nodes[n.id]} />
  }
  if (selection?.type === 'edge') {
    const e = graph.edges.find((x) => x.id === selection.id)
    if (e) return <EdgeInspector e={e} m={metrics?.edges[e.id]} />
  }
  return <Overview hold={hold} />
}

function Knob({ label, value, show, hint, min, max, log, onChange, onStart }: { label: string; value: number; show: string; hint?: string; min: number; max: number; log?: boolean; onChange: (v: number) => void; onStart: () => void }) {
  const pos = log ? valToLog(Math.max(value, min), Math.max(min, 1e-3), max) : ((value - min) / (max - min)) * 1000
  return (
    <div className="knob">
      <div className="row">
        <span className="name">{label}</span>
        <span className="val">{show}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={pos}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={(e) => {
          const p = +e.target.value
          onChange(log ? logToVal(p, Math.max(min, 1e-3), max) : min + (p / 1000) * (max - min))
        }}
        style={{ ['--pct' as string]: `${pos / 10}%` }}
        aria-label={label}
      />
      {hint && <div className="h">{hint}</div>}
    </div>
  )
}

function NodeInspector({ n, m }: { n: SimNode; m?: NodeMetrics }) {
  const { updateNode, removeSelected, commit, offered } = useStore()
  const info = KINDS[n.kind]
  const Icon = info.icon
  const src = info.cat === 'traffic'
  const cap = capacityOf(n)

  const fmtKnob = (k: keyof NodeParams, v: number) => {
    const meta = KNOB_META[k]
    if (meta.unit === '%') return fmtPct(v)
    if (meta.unit === 'ms') return fmtMs(v)
    if (meta.unit === '×') return `${v.toFixed(2)}× → ${fmtRate(offered * v)}/s`
    if (meta.unit === '/s') return `${fmtRate(v)}/s`
    return Math.round(v).toLocaleString()
  }
  const setKnob = (k: keyof NodeParams, v: number) => {
    const meta = KNOB_META[k]
    let val = meta.unit === '%' ? Math.round(v * 1000) / 1000 : meta.unit === '×' ? Math.round(v * 20) / 20 : nice(v)
    if (k === 'concurrency' || k === 'queueLimit' || k === 'attackRate') val = Math.round(val)
    if (k === 'concurrency') val = Math.max(1, val)
    updateNode(n.id, { [k]: val })
  }

  let verdict: { cls: string; text: string } | null = null
  if (m) {
    if (src && n.kind !== 'botnet') {
      verdict = m.failPct > 0.01
        ? { cls: 'bad', text: `${fmtPct(m.failPct)} of requests are failing: something downstream is dropping them. Look for a red box or a red link.` }
        : { cls: 'good', text: `All requests are succeeding. The slowest 1% take ${fmtMs(m.p99)}.` }
    } else if (!src) {
      if (m.util > 1.02)
        verdict = { cls: 'bad', text: `Overloaded. ${fmtRate(m.in)}/s arrive but it can finish only ${fmtRate(cap)}/s. The queue grows until it hits the limit (${n.params.queueLimit}), then new requests are dropped.` }
      else if (m.util > 0.8)
        verdict = { cls: '', text: `Running hot at ${fmtPct(m.util)} busy. Past ~80% small bursts start to queue, and waiting time climbs steeply.` }
      else if (n.kind === 'firewall' && m.bad > 0.05 && n.params.blockRate < 0.5)
        verdict = { cls: 'bad', text: `${fmtPct(m.bad)} of the traffic arriving here is malicious, but the block rate is only ${fmtPct(n.params.blockRate)}. It is waving the attack straight through to your servers.` }
      else if (n.kind === 'queue')
        verdict = { cls: 'good', text: `Accepting work instantly. ${Math.round(m.backlog).toLocaleString()} jobs waiting for workers.` }
      else verdict = { cls: 'good', text: `Comfortable at ${fmtPct(m.util)} busy. Requests rarely wait.` }
    }
  }

  return (
    <>
      <div className="insp-top" style={{ ['--cat' as string]: CAT_COLOR[info.cat] }}>
        <span className="disc"><Icon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={n.label} onFocus={commit} onChange={(e) => updateNode(n.id, {}, e.target.value)} aria-label="Name" />
          <div className="muted" style={{ fontSize: 11.5, paddingLeft: 5 }}>{info.label}</div>
        </div>
        <button className="ibtn sm" onClick={removeSelected} title="Delete (Backspace)" aria-label="Delete"><Trash2 size={15} /></button>
      </div>
      <div className="scroll insp-body" data-scroll>
        <div className="desc">{info.desc}</div>
        {verdict && <div className={`verdict ${verdict.cls}`}>{verdict.text}</div>}
        {m && (
          <div className="readout">
            {src ? (
              <>
                <Stat k="Sending" v={`${fmtRate(m.out)}/s`} />
                <Stat k="Succeeding" v={`${fmtRate(m.okRate)}/s`} />
                <Stat k="p99 latency" v={fmtMs(m.p99)} />
                <Stat k="Failing" v={fmtPct(m.failPct)} bad={m.failPct > 0.01} />
              </>
            ) : (
              <>
                <Stat k="Arriving" v={`${fmtRate(m.in)}/s`} />
                <Stat k="Capacity" v={`${fmtRate(cap)}/s`} />
                <Stat k="Busy" v={fmtPct(Math.min(m.util, 9.99))} bad={m.util > 1} />
                <Stat k="Waiting" v={Math.round(m.backlog).toLocaleString()} />
                <Stat k="Queue wait" v={fmtMs(m.waitMs)} />
                <Stat k="p99 from here" v={fmtMs(m.p99)} />
                {m.dropRate > 0.01 && <Stat k="Dropping" v={`${fmtRate(m.dropRate)}/s`} bad />}
                {m.blocked > 0.01 && <Stat k="Blocked" v={`${fmtRate(m.blocked)}/s`} />}
                {m.hits > 0.01 && <Stat k="Served here (hits)" v={`${fmtRate(m.hits)}/s`} />}
              </>
            )}
          </div>
        )}
        {!!info.knobs.length && <div className="sect">Settings</div>}
        {info.knobs.map((k) => {
          const meta = KNOB_META[k]
          return (
            <Knob
              key={k}
              label={meta.label}
              value={n.params[k]}
              show={fmtKnob(k, n.params[k])}
              hint={meta.hint}
              min={meta.log ? Math.max(meta.min, k === 'queueLimit' ? 1 : meta.min) : meta.min}
              max={meta.max}
              log={meta.log}
              onStart={commit}
              onChange={(v) => setKnob(k, v)}
            />
          )
        })}
        {!src && (
          <p className="muted" style={{ fontSize: 12, margin: '12px 4px 0' }}>
            Capacity = concurrency × 1000 ÷ service time = {n.params.concurrency} × 1000 ÷ {fmtMs(n.params.serviceMs)} ≈ <b className="mono">{fmtRate(cap)}/s</b>
          </p>
        )}
      </div>
    </>
  )
}

function EdgeInspector({ e, m }: { e: SimEdge; m?: EdgeMetrics }) {
  const { updateEdge, removeSelected, commit, graph, payloadKB } = useStore()
  const a = graph.nodes.find((n) => n.id === e.from)
  const b = graph.nodes.find((n) => n.id === e.to)
  const cap = linkCapacity(e, payloadKB)
  const pkts = Math.max(1, Math.ceil(payloadKB / 1.4))
  const pLoss = 1 - Math.pow(1 - e.params.lossPct / 100, pkts)
  const set = (p: Partial<LinkParams>) => updateEdge(e.id, p)

  let verdict: { cls: string; text: string } | null = null
  if (m) {
    if (m.util > 1.02) verdict = { cls: 'bad', text: `Saturated. ${fmtRate(m.flow)}/s × ${fmtBytes(payloadKB * 1024)} needs ${fmtBits(m.util * e.params.bandwidthMbps * 1e6)} but the link carries ${fmtBits(e.params.bandwidthMbps * 1e6)}. Packets queue in the ${fmtBytes(e.params.bufferKB * 1024)} buffer (${fmtMs(m.queueMs)} of delay), then drop.` }
    else if (pLoss >= 0.01) verdict = { cls: '', text: `${fmtPct(pLoss)} of responses lose at least one of their ${pkts} packets and wait for a retransmit timeout (≥200 ms). That puts the timeout inside your p99.` }
    else if (m.util > 0.75) verdict = { cls: '', text: `Busy at ${fmtPct(m.util)}. Bursts will start to queue in the buffer.` }
    else verdict = { cls: 'good', text: `Plenty of room: ${fmtPct(m.util)} of the link in use.` }
  }

  return (
    <>
      <div className="insp-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>Link</div>
          <div className="muted" style={{ fontSize: 12 }}>{a?.label} → {b?.label}</div>
        </div>
        <button className="ibtn sm" onClick={removeSelected} title="Delete (Backspace)" aria-label="Delete link"><Trash2 size={15} /></button>
      </div>
      <div className="scroll insp-body" data-scroll>
        <div className="desc">A network path. Bandwidth decides how many requests fit through per second; latency is added to every round trip; loss forces TCP to retransmit.</div>
        {verdict && <div className={`verdict ${verdict.cls}`}>{verdict.text}</div>}
        {m && (
          <div className="readout">
            <Stat k="Carrying" v={`${fmtRate(m.flow)}/s`} />
            <Stat k="Fits" v={`${fmtRate(cap)}/s`} />
            <Stat k="Utilisation" v={fmtPct(Math.min(m.util, 9.99))} bad={m.util > 1} />
            <Stat k="Queueing delay" v={fmtMs(m.queueMs)} />
            {m.dropRate > 0.01 && <Stat k="Dropping" v={`${fmtRate(m.dropRate)}/s`} bad />}
          </div>
        )}
        <div className="sect">Settings</div>
        <Knob label="Bandwidth" value={e.params.bandwidthMbps} show={fmtBits(e.params.bandwidthMbps * 1e6)} min={1} max={800000} log onStart={commit} onChange={(v) => set({ bandwidthMbps: nice(v) })} hint="Bits per second the link can carry." />
        <Knob label="Latency (one way)" value={e.params.latencyMs} show={fmtMs(e.params.latencyMs)} min={0.001} max={300} log onStart={commit} onChange={(v) => set({ latencyMs: v < 0.01 ? +v.toPrecision(1) : nice(v) })} hint="~1 ms per 200 km of fibre, plus every hop in between." />
        <Knob label="Packet loss" value={e.params.lossPct} show={`${e.params.lossPct}%`} min={0} max={10} onStart={commit} onChange={(v) => set({ lossPct: v < 0.1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10 })} hint="Wi‑Fi and mobile links lose packets; data‑centre links almost never do." />
        <Knob label="Buffer" value={e.params.bufferKB} show={fmtBytes(e.params.bufferKB * 1024)} min={16} max={262144} log onStart={commit} onChange={(v) => set({ bufferKB: Math.round(v) })} hint="Bigger buffers drop less but delay more (bufferbloat)." />
      </div>
    </>
  )
}

function Stat({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v" style={bad ? { color: 'var(--bad)' } : undefined}>{v}</div>
    </div>
  )
}

const metricLabel = (g: Goal) => (g.metric === 'p99' ? 'p99 latency' : g.metric === 'errorPct' ? 'Error rate' : 'Goodput')
const metricFmt = (g: Goal, v: number) => (g.metric === 'p99' ? fmtMs(v) : g.metric === 'errorPct' ? fmtPct(v) : `${fmtRate(v)}/s`)

function Overview({ hold }: { hold: number }) {
  const { presetId, challengeId, missionId, metrics, hintsShown, set, progress, graph } = useStore()
  const preset = presetId ? PRESET_BY_ID[presetId] : null
  const ch = challengeOf(challengeId)
  if (missionId) return <MissionPanel id={missionId} />

  if (ch) {
    const g = metrics?.global
    const done = progress.challenges[ch.id]
    return (
      <>
        <div className="insp-top">
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Challenge <span className={`lvl ${ch.level}`}>{ch.level}</span></div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{ch.title}</div>
          </div>
        </div>
        <div className="scroll insp-body" data-scroll>
          <div className="desc" style={{ fontSize: 14, color: 'var(--ink)' }}>{ch.brief}</div>
          <div className="sect">Goals · hold for 5 s</div>
          {ch.goals.map((goal, i) => {
            const v = g ? g[goal.metric] : NaN
            const met = g && (goal.max === undefined || v <= goal.max) && (goal.min === undefined || v >= goal.min)
            return (
              <div key={i} className={`goal ${met ? 'met' : 'miss'}`}>
                {met ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                {metricLabel(goal)} {goal.max !== undefined ? `≤ ${metricFmt(goal, goal.max)}` : `≥ ${metricFmt(goal, goal.min!)}`}
                <span className="cur">{g ? metricFmt(goal, v) : '—'}</span>
              </div>
            )
          })}
          {!done && (
            <div className="holdbar" title={`Holding ${hold.toFixed(1)} of 5 s`}><i style={{ width: `${(hold / 5) * 100}%` }} /></div>
          )}
          {done ? (
            <div className="verdict good" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, color: 'var(--ok)', marginBottom: 4 }}><Trophy size={15} /> Solved</div>
              {ch.lesson}
            </div>
          ) : (
            <>
              <div className="sect"><Lightbulb size={12} /> Hints</div>
              {ch.hints.slice(0, hintsShown).map((h, i) => (
                <div key={i} className="hint"><b className="mono" style={{ color: 'var(--accent)' }}>{i + 1}.</b> {h}</div>
              ))}
              {hintsShown < ch.hints.length && (
                <button className="btn sm" onClick={() => set({ hintsShown: hintsShown + 1 })}>
                  {hintsShown ? 'Another hint' : 'Show a hint'}
                </button>
              )}
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="insp-top">
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{preset ? 'Scenario' : 'Your design'} {preset && <span className={`lvl ${preset.level}`}>{preset.level}</span>}</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{preset?.title ?? 'Blank canvas'}</div>
        </div>
      </div>
      <div className="scroll insp-body" data-scroll>
        {preset ? (
          <>
            <div className="desc" style={{ fontSize: 14, color: 'var(--ink)' }}>{preset.blurb}</div>
            <div className="sect"><FlaskConical size={12} /> Things to try</div>
            <ol className="tryit">{preset.tryIt.map((t) => <li key={t}>{t}</li>)}</ol>
          </>
        ) : (
          <div className="desc" style={{ fontSize: 14, color: 'var(--ink)' }}>
            {graph.nodes.length ? 'Your own system. Click any box or link to inspect and tune it.' : 'Add a Client from the Components tab, then something for it to talk to, and wire them together.'}
          </div>
        )}
        <div className="sect">How to read the bench</div>
        <ul className="tryit" style={{ listStyle: 'disc' }}>
          <li><b>Busy</b> is arrivals ÷ capacity. Past ~80%, waiting time climbs fast; past 100%, the queue grows until requests are dropped.</li>
          <li><b>p99</b> is the time the slowest 1 in 100 requests take. It is what your unluckiest users feel.</li>
          <li><b>Goodput</b> counts only successful responses. Junk traffic and drops do not count.</li>
          <li>The <b>ring</b> around each device fills with load: green, then amber past 75%, red near 100%.</li>
          <li>Diamonds on the wires are requests; <span style={{ color: 'var(--bad)' }}>red ✕ marks</span> shed by a device are drops, <span style={{ color: 'var(--c-amber)' }}>amber</span> ones are blocked by a firewall.</li>
          <li>Click a link to change its bandwidth, latency and loss. That is where the networking happens.</li>
        </ul>
      </div>
    </>
  )
}

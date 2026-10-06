import { useMemo, useState } from 'react'
import { fmtBytes, fmtBits, fmtMs, logToVal, valToLog } from '../format'

/* ------------------------------ OSI ------------------------------ */
const OSI = [
  { n: 7, name: 'Application', what: 'What the program actually wants to say: a web request, a DNS query, an email.', ex: 'HTTP · DNS · SSH', hdr: 'DATA', c: 'var(--c-violet)' },
  { n: 6, name: 'Presentation', what: 'Encoding and encryption. In TCP/IP this is folded into the application (think TLS, JSON, gzip).', ex: 'TLS · JSON', hdr: 'DATA', c: 'var(--c-violet)' },
  { n: 5, name: 'Session', what: 'Keeping a conversation going. Also folded into applications in practice.', ex: '(sockets)', hdr: 'DATA', c: 'var(--c-violet)' },
  { n: 4, name: 'Transport', what: 'Process‑to‑process delivery with ports. TCP adds reliability and ordering; UDP does not.', ex: 'TCP · UDP · QUIC', hdr: 'TCP', c: 'var(--c-blue)' },
  { n: 3, name: 'Network', what: 'Host‑to‑host delivery across networks, using IP addresses and routers.', ex: 'IP · ICMP · BGP', hdr: 'IP', c: 'var(--c-teal)' },
  { n: 2, name: 'Data link', what: 'Delivery to the next device on the same link, using MAC addresses. Switches live here.', ex: 'Ethernet · Wi‑Fi · ARP', hdr: 'ETH', c: 'var(--c-amber)' },
  { n: 1, name: 'Physical', what: 'Bits as light, voltage or radio waves on a medium.', ex: 'fibre · copper · radio', hdr: 'bits', c: 'var(--c-gray)' },
]

export function OsiWidget() {
  const [sel, setSel] = useState(4)
  const cur = OSI.find((l) => l.n === sel)!
  const frame = [
    { k: 'ETH', w: 14, c: 'var(--c-amber)', min: 2 },
    { k: 'IP', w: 20, c: 'var(--c-teal)', min: 3 },
    { k: 'TCP', w: 20, c: 'var(--c-blue)', min: 4 },
    { k: 'DATA', w: 40, c: 'var(--c-violet)', min: 5 },
    { k: 'FCS', w: 6, c: 'var(--c-amber)', min: 2 },
  ]
  return (
    <div className="widget">
      <h4>The layer stack — click a layer</h4>
      <div className="osi-stack">
        {OSI.map((l) => (
          <button key={l.n} className={`osi-row${l.n === sel ? ' on' : ''}`} onClick={() => setSel(l.n)}>
            <span className="n">L{l.n}</span>
            <span className="nm" style={{ color: l.c }}>{l.name}</span>
            <span className="ex">{l.ex}</span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '10px 2px 0' }}>{cur.what}</p>
      <div className="frame">
        {frame.map((f) => {
          const on = sel === 1 || (f.k === 'DATA' ? sel >= 5 : f.k === cur.hdr || (f.k === 'FCS' && cur.hdr === 'ETH'))
          return (
            <span key={f.k} style={{ flex: f.w, background: f.c, opacity: on ? 1 : 0.28 }}>
              {f.k}
            </span>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: '6px 2px 0' }}>An Ethernet frame on the wire: each layer’s header wraps everything to its right.</p>
    </div>
  )
}

/* ------------------------------ Subnet ------------------------------ */
const toInt = (ip: string) => {
  const p = ip.trim().split('.').map(Number)
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]
}
const toIp = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')

export function SubnetWidget() {
  const [ip, setIp] = useState('192.168.1.20')
  const [len, setLen] = useState(24)
  const [other, setOther] = useState('192.168.1.200')
  const r = useMemo(() => {
    const n = toInt(ip)
    if (n === null) return null
    const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0
    const net = (n & mask) >>> 0
    const bc = (net | (~mask >>> 0)) >>> 0
    const size = 2 ** (32 - len)
    const usable = len >= 31 ? (len === 32 ? 1 : 2) : size - 2
    const o = toInt(other)
    return { n, mask, net, bc, size, usable, same: o === null ? null : ((o & mask) >>> 0) === net }
  }, [ip, len, other])
  const bits = r ? r.n.toString(2).padStart(32, '0') : ''
  return (
    <div className="widget">
      <h4>Subnet calculator</h4>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} aria-label="IP address" />
        <span className="mono" style={{ fontSize: 15 }}>/{len}</span>
      </div>
      <input type="range" min={8} max={32} value={len} onChange={(e) => setLen(+e.target.value)} style={{ ['--pct' as string]: `${((len - 8) / 24) * 100}%`, marginTop: 6 }} aria-label="Prefix length" />
      {r ? (
        <>
          <div className="bits">
            {bits.split('').flatMap((b, i) => [
              ...(i > 0 && i % 8 === 0 ? [<span className="sep" key={`s${i}`} />] : []),
              <span key={i} className={i < len ? 'n' : 'h'}>{b}</span>,
            ])}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            <span style={{ color: 'var(--c-blue)' }}>■</span> network bits &nbsp; <span style={{ color: 'var(--c-amber)' }}>■</span> host bits
          </div>
          <dl className="kv">
            <dt>Network</dt><dd>{toIp(r.net)}/{len}</dd>
            <dt>Mask</dt><dd>{toIp(r.mask)}</dd>
            <dt>First host</dt><dd>{len >= 31 ? toIp(r.net) : toIp(r.net + 1)}</dd>
            <dt>Last host</dt><dd>{len >= 31 ? toIp(r.bc) : toIp(r.bc - 1)}</dd>
            <dt>Broadcast</dt><dd>{len >= 31 ? '—' : toIp(r.bc)}</dd>
            <dt>Usable hosts</dt><dd>{r.usable.toLocaleString()}</dd>
          </dl>
          <div className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
            <input type="text" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Other IP" />
            <span className="pill" style={{ color: r.same ? 'var(--ok)' : 'var(--warn)', borderColor: 'currentColor' }}>
              {r.same === null ? '?' : r.same ? 'same subnet' : 'via gateway'}
            </span>
          </div>
        </>
      ) : (
        <p className="muted">Enter a valid IPv4 address.</p>
      )}
    </div>
  )
}

/* ------------------------------ Latency numbers ------------------------------ */
const LAT = [
  { k: 'GPU ↔ GPU over NVLink', ms: 0.0008 },
  { k: 'RDMA write, same rack', ms: 0.002 },
  { k: 'SSD random read', ms: 0.1 },
  { k: 'Round trip inside a data centre', ms: 0.25 },
  { k: 'Wi‑Fi hop', ms: 3 },
  { k: 'Same city, fibre', ms: 2 },
  { k: '4G last mile', ms: 40 },
  { k: 'US coast to coast', ms: 65 },
  { k: 'New York ↔ London', ms: 70 },
  { k: 'Mumbai ↔ Virginia', ms: 210 },
  { k: 'TCP retransmit timeout (min)', ms: 200 },
  { k: 'Geostationary satellite', ms: 600 },
]

export function LatencyWidget() {
  const [km, setKm] = useState(5570)
  const lo = Math.log10(0.0005)
  const hi = Math.log10(1000)
  return (
    <div className="widget">
      <h4>Latency numbers (round trip, log scale)</h4>
      {[...LAT].sort((a, b) => a.ms - b.ms).map((l) => (
        <div key={l.k} className="lat-row">
          <div>
            <div className="lat-label"><span>{l.k}</span></div>
            <div className="lat-bar" style={{ width: `${((Math.log10(l.ms) - lo) / (hi - lo)) * 100}%`, background: l.ms > 50 ? 'var(--c-amber)' : l.ms > 1 ? 'var(--c-teal)' : 'var(--c-pink)' }} />
          </div>
          <span className="mono" style={{ textAlign: 'right' }}>{fmtMs(l.ms)}</span>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Distance</span>
          <span className="mono" style={{ fontSize: 12.5 }}>{km.toLocaleString()} km</span>
        </div>
        <input type="range" min={0} max={1000} value={valToLog(km, 1, 20000)} onChange={(e) => setKm(Math.round(logToVal(+e.target.value, 1, 20000)))} style={{ ['--pct' as string]: `${valToLog(km, 1, 20000) / 10}%` }} aria-label="Distance" />
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
          Light in fibre needs at least <b className="mono">{fmtMs((km / 200000) * 1000 * 2)}</b> for a round trip. No amount of money makes it faster.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------ BDP ------------------------------ */
export function LogSlider({ label, v, set, min, max, show }: { label: string; v: number; set: (n: number) => void; min: number; max: number; show: string }) {
  return (
    <div className="knob">
      <div className="row"><span className="name">{label}</span><span className="val">{show}</span></div>
      <input type="range" min={0} max={1000} value={valToLog(v, min, max)} onChange={(e) => set(logToVal(+e.target.value, min, max))} style={{ ['--pct' as string]: `${valToLog(v, min, max) / 10}%` }} aria-label={label} />
    </div>
  )
}
const Slider = LogSlider

export function BdpWidget() {
  const [bw, setBw] = useState(1000) // Mb/s
  const [rtt, setRtt] = useState(100) // ms
  const [win, setWin] = useState(64) // KB
  const bdpBytes = (bw * 1e6 * (rtt / 1000)) / 8
  const achieved = Math.min(bw, (win * 1024 * 8) / (rtt / 1000) / 1e6)
  const util = achieved / bw
  return (
    <div className="widget">
      <h4>Bandwidth‑delay product</h4>
      <Slider label="Bandwidth" v={bw} set={setBw} min={1} max={400000} show={fmtBits(bw * 1e6)} />
      <Slider label="Round‑trip time" v={rtt} set={setRtt} min={0.01} max={600} show={fmtMs(rtt)} />
      <Slider label="Window (in flight)" v={win} set={setWin} min={4} max={1024 * 1024} show={fmtBytes(win * 1024)} />
      <dl className="kv">
        <dt>BDP (needed in flight)</dt><dd>{fmtBytes(bdpBytes)}</dd>
        <dt>Throughput you get</dt><dd style={{ color: util < 0.5 ? 'var(--bad)' : util < 0.95 ? 'var(--warn)' : 'var(--ok)' }}>{fmtBits(achieved * 1e6)} ({(util * 100).toFixed(util < 0.1 ? 1 : 0)}%)</dd>
      </dl>
      <div style={{ marginTop: 10, height: 26, borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${util * 100}%`, height: '100%', background: 'repeating-linear-gradient(90deg, var(--c-blue) 0 10px, color-mix(in srgb, var(--c-blue) 70%, transparent) 10px 12px)', transition: 'width .3s' }} />
        <span className="mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11 }}>pipe {Math.round(util * 100)}% full</span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>Throughput ≤ window ÷ RTT. A 64 KB window across the Atlantic tops out near 5 Mb/s, whatever the link speed.</p>
    </div>
  )
}

/* ------------------------------ cwnd ------------------------------ */
export function CwndWidget() {
  const [cap, setCap] = useState(60)
  const [initSs, setInitSs] = useState(64)
  const [timeout, setTimeoutMode] = useState(false)
  const data = useMemo(() => {
    let cwnd = 1
    let ss = initSs
    const out: { t: number; c: number; ss: number; loss: boolean }[] = []
    for (let t = 0; t <= 48; t++) {
      let loss = false
      if (cwnd > cap) {
        loss = true
        ss = Math.max(2, Math.floor(cwnd / 2))
        cwnd = timeout ? 1 : ss
      }
      out.push({ t, c: cwnd, ss, loss })
      if (cwnd < ss) cwnd = Math.min(cwnd * 2, Math.max(ss, cwnd + 1))
      else cwnd += 1
    }
    return out
  }, [cap, initSs, timeout])
  const W = 340
  const H = 170
  const maxY = Math.max(cap * 1.25, initSs * 1.1, 20)
  const x = (t: number) => 24 + (t / 48) * (W - 34)
  const y = (v: number) => H - 20 - (v / maxY) * (H - 34)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t)},${y(d.c)}`).join(' ')
  return (
    <div className="widget">
      <h4>Congestion window over time</h4>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="cwnd chart">
        <line x1={24} x2={W - 10} y1={y(cap)} y2={y(cap)} stroke="var(--c-red)" strokeDasharray="4 4" />
        <text x={W - 12} y={y(cap) - 4} textAnchor="end" fontSize="10" fill="var(--c-red)" fontFamily="var(--mono)">pipe + buffer</text>
        <path d={path} fill="none" stroke="var(--c-blue)" strokeWidth={2.2} strokeLinejoin="round" />
        {data.filter((d) => d.loss).map((d) => (
          <circle key={d.t} cx={x(d.t)} cy={y(d.c)} r={3.5} fill="var(--c-red)" />
        ))}
        <line x1={24} x2={W - 10} y1={H - 20} y2={H - 20} stroke="var(--border-strong)" />
        <text x={24} y={H - 6} fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">0</text>
        <text x={W - 10} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end" fontFamily="var(--mono)">48 RTTs</text>
        <text x={4} y={14} fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">cwnd (segments)</text>
      </svg>
      <div className="knob">
        <div className="row"><span className="name">Path capacity (segments)</span><span className="val">{cap}</span></div>
        <input type="range" min={10} max={120} value={cap} onChange={(e) => setCap(+e.target.value)} style={{ ['--pct' as string]: `${((cap - 10) / 110) * 100}%` }} aria-label="capacity" />
      </div>
      <div className="knob">
        <div className="row"><span className="name">Initial slow‑start threshold</span><span className="val">{initSs}</span></div>
        <input type="range" min={4} max={128} value={initSs} onChange={(e) => setInitSs(+e.target.value)} style={{ ['--pct' as string]: `${((initSs - 4) / 124) * 100}%` }} aria-label="ssthresh" />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="seg small">
          <button className={!timeout ? 'on' : ''} onClick={() => setTimeoutMode(false)}>Loss via 3 dup ACKs</button>
          <button className={timeout ? 'on' : ''} onClick={() => setTimeoutMode(true)}>Loss via timeout</button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>Doubling (slow start) until the threshold, then +1 per RTT. Each red dot is a loss: the window halves, or drops to 1 after a timeout.</p>
    </div>
  )
}

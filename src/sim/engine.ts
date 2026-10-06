import { KINDS } from '../catalog'
import type { EdgeMetrics, GlobalMetrics, NodeMetrics, SimEdge, SimNode } from '../types'

/**
 * A fluid queueing model, ticked at a fixed dt.
 *
 * Every node is a c-server queue: capacity = concurrency × 1000 / serviceMs.
 * Every link is a pipe: capacity = bandwidth / payload, with a finite buffer,
 * propagation delay and random loss (which costs a TCP retransmit timeout).
 *
 * Flows are pushed through the graph in topological order; latency and
 * success probability are then pulled back from the leaves to the clients.
 */

export const DT = 0.1 // seconds of simulated time per tick
const MIN_RTO_MS = 200
const MSS_KB = 1.4

export interface SimRuntime {
  nb: Record<string, { backlog: number; badFrac: number; prevIn: number; dropEma: number }>
  eb: Record<string, { backlog: number; prevFlow: number; dropEma: number }>
  carry: Record<string, { rate: number; bad: number }>
  tick: number
  hist: Record<string, number[]>
}

export function newRuntime(): SimRuntime {
  return { nb: {}, eb: {}, carry: {}, tick: 0, hist: {} }
}

export interface SimResult {
  nodes: Record<string, NodeMetrics>
  edges: Record<string, EdgeMetrics>
  global: GlobalMetrics
}

const isSource = (k: SimNode['kind']) => KINDS[k].cat === 'traffic'

export function capacityOf(n: SimNode) {
  return (n.params.concurrency * 1000) / Math.max(0.001, n.params.serviceMs)
}

export function linkCapacity(e: SimEdge, payloadKB: number) {
  return (e.params.bandwidthMbps * 1e6) / 8 / (payloadKB * 1024)
}

/** Sakasegawa's approximation for mean wait in an M/M/c queue, in ms. */
function mmcWait(rho: number, c: number, s: number) {
  const r = Math.min(rho, 0.985)
  if (r <= 0) return 0
  return (Math.pow(r, Math.sqrt(2 * (c + 1)) - 1) / (c * (1 - r))) * s
}

function topoOrder(nodes: SimNode[], edges: SimEdge[]) {
  const indeg: Record<string, number> = {}
  nodes.forEach((n) => (indeg[n.id] = 0))
  edges.forEach((e) => indeg[e.to] !== undefined && indeg[e.from] !== undefined && indeg[e.to]++)
  const q = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id)
  const out: string[] = []
  const seen = new Set<string>()
  while (q.length) {
    const id = q.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    for (const e of edges) if (e.from === id && indeg[e.to] !== undefined) if (--indeg[e.to] === 0) q.push(e.to)
  }
  // cycles: append the rest in insertion order
  nodes.forEach((n) => !seen.has(n.id) && out.push(n.id))
  return out
}

export function step(
  nodes: SimNode[],
  edges: SimEdge[],
  rt: SimRuntime,
  offered: number,
  payloadKB: number,
): SimResult {
  const byId: Record<string, SimNode> = {}
  nodes.forEach((n) => (byId[n.id] = n))
  const outEdges: Record<string, SimEdge[]> = {}
  nodes.forEach((n) => (outEdges[n.id] = []))
  edges.forEach((e) => byId[e.from] && byId[e.to] && outEdges[e.from].push(e))

  const order = topoOrder(nodes, edges)
  const pos: Record<string, number> = {}
  order.forEach((id, i) => (pos[id] = i))

  const inRate: Record<string, number> = {}
  const inBad: Record<string, number> = {}
  nodes.forEach((n) => {
    const c = rt.carry[n.id]
    inRate[n.id] = c?.rate ?? 0
    inBad[n.id] = c?.bad ?? 0
  })
  rt.carry = {}

  const nm: Record<string, NodeMetrics> = {}
  const em: Record<string, EdgeMetrics> = {}
  const nodeDropFrac: Record<string, number> = {}
  const edgeDropFrac: Record<string, number> = {}
  const share: Record<string, number> = {} // fraction of node output sent on edge
  const hitFrac: Record<string, number> = {}
  let totalDrops = 0

  for (const id of order) {
    const n = byId[id]
    const info = KINDS[n.kind]
    const p = n.params
    const st = (rt.nb[id] ??= { backlog: 0, badFrac: 0, prevIn: 0, dropEma: 0 })

    let arr = inRate[id]
    let bad = arr > 0 ? inBad[id] / arr : 0
    if (n.kind === 'botnet') {
      arr = p.attackRate
      bad = 1
    } else if (isSource(n.kind)) {
      arr = offered * p.weight
      bad = 0
    }

    let served: number
    let drop = 0
    let util = 0
    let waitMs = 0
    const mu = capacityOf(n)

    if (isSource(n.kind)) {
      served = arr * DT
      st.backlog = 0
    } else {
      let drainCap = mu
      if (n.kind === 'queue') {
        // backpressure: only hand workers what they have room for
        drainCap = 0
        for (const e of outEdges[id]) {
          const t = byId[e.to]
          const tst = rt.nb[t.id]
          const other = Math.max(0, (tst?.prevIn ?? 0) - (rt.eb[e.id]?.prevFlow ?? 0))
          const room = (tst?.backlog ?? 0) < t.params.concurrency * 2 ? 1 : 0.3
          drainCap += Math.max(0, capacityOf(t) - other) * room
        }
        if (!outEdges[id].length) drainCap = mu
      }
      const work = st.backlog + arr * DT
      const newBadFrac = work > 0 ? (st.backlog * st.badFrac + arr * DT * bad) / work : 0
      served = Math.min(work, drainCap * DT)
      st.backlog = work - served
      if (st.backlog > p.queueLimit) {
        drop = st.backlog - p.queueLimit
        st.backlog = p.queueLimit
      }
      st.badFrac = newBadFrac
      bad = newBadFrac
      util = mu > 0 ? arr / mu : 0
      if (n.kind === 'queue') util = drainCap > 0 ? Math.min(arr / drainCap, 9.99) : 0
      waitMs = n.kind === 'queue' ? 0 : mmcWait(util, p.concurrency, p.serviceMs) + (st.backlog / Math.max(mu, 1e-6)) * 1000
    }

    const outRate = served / DT
    const dropRate = drop / DT
    totalDrops += dropRate
    st.prevIn = arr
    const df = arr > 0 ? Math.min(1, dropRate / arr) : 0
    st.dropEma = st.dropEma * 0.7 + df * 0.3
    nodeDropFrac[id] = st.dropEma

    // behaviours
    let forward = outRate
    let fwdBad = bad
    let hits = 0
    let blocked = 0
    if (p.hitRate > 0 && ['cache', 'cdn', 'dns', 'kvcache'].includes(n.kind)) {
      hits = outRate * p.hitRate
      forward = outRate - hits
    }
    if (n.kind === 'firewall') {
      blocked = outRate * bad * p.blockRate
      forward = outRate - blocked
      fwdBad = forward > 0 ? (outRate * bad - blocked) / forward : 0
    }
    hitFrac[id] = outEdges[id].length ? (outRate > 0 ? hits / outRate : p.hitRate) : 1

    const outs = outEdges[id]
    const route = info.route
    for (const e of outs) {
      const f = route === 'fanout' ? forward : forward / outs.length
      share[e.id] = route === 'fanout' ? 1 : 1 / outs.length
      const est = (rt.eb[e.id] ??= { backlog: 0, prevFlow: 0, dropEma: 0 })
      const cap = linkCapacity(e, payloadKB)
      const loss = e.params.lossPct / 100
      const offeredOnWire = f * (1 + loss) // retransmits ride the same wire
      const workE = est.backlog + offeredOnWire * DT
      const sent = Math.min(workE, cap * DT)
      est.backlog = workE - sent
      const bufReq = e.params.bufferKB / payloadKB
      let eDrop = 0
      if (est.backlog > bufReq) {
        eDrop = est.backlog - bufReq
        est.backlog = bufReq
      }
      const delivered = (sent / DT) / (1 + loss)
      const eDropRate = eDrop / DT
      totalDrops += eDropRate
      est.prevFlow = delivered
      const edf = offeredOnWire > 0 ? Math.min(1, eDropRate / offeredOnWire) : 0
      est.dropEma = est.dropEma * 0.7 + edf * 0.3
      edgeDropFrac[e.id] = est.dropEma
      em[e.id] = {
        flow: delivered,
        bad: fwdBad,
        util: cap > 0 ? offeredOnWire / cap : 0,
        queueMs: cap > 0 ? (est.backlog / cap) * 1000 : 0,
        dropRate: eDropRate,
      }
      if (pos[e.to] > pos[id]) {
        inRate[e.to] += delivered
        inBad[e.to] += delivered * fwdBad
      } else {
        const c = (rt.carry[e.to] ??= { rate: 0, bad: 0 })
        c.rate += delivered
        c.bad += delivered * fwdBad
      }
    }

    nm[id] = {
      in: arr,
      out: outRate,
      util,
      backlog: st.backlog,
      waitMs,
      p99: 0,
      dropRate,
      hits,
      blocked,
      okRate: 0,
      failPct: 0,
      bad,
      hist: rt.hist[id] ?? [],
    }
  }

  // ---- pull latency + success back from the leaves ----
  const mean: Record<string, number> = {}
  const p99: Record<string, number> = {}
  const succ: Record<string, number> = {}

  const edgeLat = (e: SimEdge) => {
    const m = em[e.id]
    const trans = (payloadKB * 8 * 1024) / (e.params.bandwidthMbps * 1e6) * 1000
    const prop = 2 * e.params.latencyMs
    const loss = e.params.lossPct / 100
    const pkts = Math.max(1, Math.ceil(payloadKB / MSS_KB))
    const pAnyLoss = 1 - Math.pow(1 - loss, pkts)
    const q = m?.queueMs ?? 0
    return {
      mean: prop + trans + q + pAnyLoss * MIN_RTO_MS,
      // once ≥1% of responses lose a packet, the RTO sits inside the p99
      p99: prop + trans + q * 1.4 + MIN_RTO_MS * Math.min(1, Math.max(0, (pAnyLoss - 0.005) / 0.005)),
    }
  }

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const n = byId[id]
    const m = nm[id]
    const src = isSource(n.kind)
    const own = src ? 0 : n.params.serviceMs + m.waitMs
    const ownP = src ? 0 : n.params.serviceMs * 1.6 + m.waitMs * 4.6
    const outs = outEdges[id].filter((e) => pos[e.to] > pos[id])
    const hit = hitFrac[id] ?? 0

    let dMean = 0
    let dP = 0
    let dSucc = 1
    if (outs.length && n.kind !== 'queue') {
      if (KINDS[n.kind].route === 'fanout') {
        for (const e of outs) {
          const l = edgeLat(e)
          dMean = Math.max(dMean, l.mean + mean[e.to])
          dP = Math.max(dP, l.p99 + p99[e.to])
          dSucc *= (1 - edgeDropFrac[e.id]) * succ[e.to]
        }
      } else {
        dSucc = 0
        for (const e of outs) {
          const l = edgeLat(e)
          const w = share[e.id] ?? 1 / outs.length
          dMean += w * (l.mean + mean[e.to])
          dP = Math.max(dP, l.p99 + p99[e.to])
          dSucc += w * (1 - edgeDropFrac[e.id]) * succ[e.to]
        }
      }
    }
    const miss = outs.length ? 1 - hit : 0
    mean[id] = own + miss * dMean
    p99[id] = ownP + dP * Math.min(1, Math.max(0, (miss - 0.005) / 0.005))
    succ[id] = (1 - nodeDropFrac[id]) * (hit + miss * dSucc + (outs.length ? 0 : 0))
    if (!outs.length || n.kind === 'queue') succ[id] = 1 - nodeDropFrac[id]
    m.p99 = p99[id]
  }

  // ---- globals ----
  let sent = 0
  let ok = 0
  let worstP99 = 0
  for (const n of nodes) {
    if (!isSource(n.kind) || n.kind === 'botnet') continue
    const m = nm[n.id]
    m.okRate = m.out * succ[n.id]
    m.failPct = 1 - succ[n.id]
    sent += m.out
    ok += m.okRate
    if (m.out > 0) worstP99 = Math.max(worstP99, p99[n.id])
  }
  for (const n of nodes) if (n.kind === 'botnet') nm[n.id].okRate = 0

  rt.tick++
  if (rt.tick % 3 === 0) {
    for (const n of nodes) {
      const h = (rt.hist[n.id] ??= [])
      const m = nm[n.id]
      h.push(isSource(n.kind) ? m.okRate : Math.min(m.util, 1.5))
      if (h.length > 36) h.shift()
      m.hist = h
    }
  }

  return {
    nodes: nm,
    edges: em,
    global: {
      p99: worstP99,
      goodput: ok,
      errorPct: sent > 0 ? 1 - ok / sent : 0,
      dropped: totalDrops,
      t: rt.tick * DT,
    },
  }
}

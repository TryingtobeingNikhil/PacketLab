import { KINDS } from '../catalog'
import { fmtBits, fmtMs, fmtPct, fmtRate } from '../format'
import { capacityOf, type SimResult } from '../sim/engine'
import type { SimEdge, SimNode } from '../types'

export type Tone = 'good' | 'warn' | 'bad' | 'idle'

export interface Commentary {
  tone: Tone
  headline: string
  detail: string
}

/**
 * Plain-language commentary on what the simulation is doing right now:
 * the single most important thing a reader should notice, and why it happens.
 */
export function commentate(nodes: SimNode[], edges: SimEdge[], m: SimResult | null, payloadKB: number): Commentary {
  if (!nodes.length) return { tone: 'idle', headline: 'The bench is empty.', detail: 'Pick a scenario on the left, or add a Client and a Server from Parts and wire them together.' }
  const sources = nodes.filter((n) => KINDS[n.kind].cat === 'traffic')
  if (!sources.length) return { tone: 'idle', headline: 'Nothing is sending traffic yet.', detail: 'Add a Client from Parts and connect it to something. It sends the offered load from the slider below.' }
  if (!edges.some((e) => sources.some((s) => s.id === e.from)))
    return { tone: 'idle', headline: 'Your client is not connected.', detail: 'Hover the client, then drag its ＋ port onto the next device to wire them.' }
  if (!m) return { tone: 'idle', headline: 'Starting up…', detail: 'Press Run below if the simulation is paused.' }

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const g = m.global

  // the most stressed device and link
  let hotNode: SimNode | null = null
  let hotNodeU = 0
  for (const n of nodes) {
    if (KINDS[n.kind].cat === 'traffic' || n.kind === 'queue') continue
    const u = m.nodes[n.id]?.util ?? 0
    if (u > hotNodeU) [hotNode, hotNodeU] = [n, u]
  }
  let hotEdge: SimEdge | null = null
  let hotEdgeU = 0
  for (const e of edges) {
    const u = m.edges[e.id]?.util ?? 0
    if (u > hotEdgeU) [hotEdge, hotEdgeU] = [e, u]
  }
  const edgeName = (e: SimEdge) => `${byId[e.from]?.label ?? '?'} → ${byId[e.to]?.label ?? '?'}`
  const linkIsWorst = hotEdge && hotEdgeU >= hotNodeU

  // anything actively blocking an attack is worth saying first if it is working
  const fw = nodes.find((n) => n.kind === 'firewall' && (m.nodes[n.id]?.blocked ?? 0) > 1)
  const bot = nodes.find((n) => n.kind === 'botnet' && (m.nodes[n.id]?.out ?? 0) > 0)
  const leakyFw = nodes.find((n) => n.kind === 'firewall' && (m.nodes[n.id]?.bad ?? 0) > 0.05 && n.params.blockRate < 0.5)

  if (g.errorPct > 0.01) {
    let why = ''
    if (bot && leakyFw) why = `${byId[bot.id].label} is flooding the system and ${leakyFw.label} is letting it through (block rate ${fmtPct(leakyFw.params.blockRate)}). Junk requests fill every queue before real users get a turn.`
    else if (linkIsWorst && hotEdge && hotEdgeU > 1) {
      const em = m.edges[hotEdge.id]
      why = `The link ${edgeName(hotEdge)} is full. It needs ${fmtBits(hotEdgeU * hotEdge.params.bandwidthMbps * 1e6)} but carries ${fmtBits(hotEdge.params.bandwidthMbps * 1e6)}, so its buffer overflows (${fmtMs(em.queueMs)} of queueing) and packets are dropped.`
    } else if (hotNode) {
      const nm = m.nodes[hotNode.id]
      why = `${hotNode.label} is the bottleneck: ${fmtRate(nm.in)}/s arrive but it can only finish ${fmtRate(capacityOf(hotNode))}/s. Its queue hit the limit, so new requests are turned away.`
    }
    return { tone: 'bad', headline: `${fmtPct(g.errorPct)} of requests are failing.`, detail: why || 'Something downstream is dropping requests. Look for the red device or link.' }
  }

  // loss that hides in the tail
  for (const e of edges) {
    const pkts = Math.max(1, Math.ceil(payloadKB / 1.4))
    const p = 1 - Math.pow(1 - e.params.lossPct / 100, pkts)
    if (p >= 0.01 && (m.edges[e.id]?.flow ?? 0) > 0) {
      return {
        tone: 'warn',
        headline: `Packet loss is setting your p99: ${fmtMs(g.p99)}.`,
        detail: `${fmtPct(p)} of responses on ${edgeName(e)} lose one of their ${pkts} packets and wait for a TCP retransmit timeout (at least 200 ms). The average looks fine; the slowest users do not.`,
      }
    }
  }

  const q = nodes.find((n) => n.kind === 'queue' && (m.nodes[n.id]?.backlog ?? 0) > 20)
  if (q) {
    return {
      tone: 'warn',
      headline: `Users are fine, but ${q.label} is piling up: ${Math.round(m.nodes[q.id].backlog).toLocaleString()} jobs waiting.`,
      detail: 'A queue answers right away and hands work to the workers at their pace. If work keeps arriving faster than they finish, the backlog grows forever.',
    }
  }
  const worstU = Math.max(hotNodeU, hotEdgeU)
  const worstName = linkIsWorst && hotEdge ? `the link ${edgeName(hotEdge)}` : hotNode?.label ?? 'nothing'
  if (worstU > 1.02 || g.p99 > 1000) {
    const extra = linkIsWorst && hotEdge
      ? `More bytes arrive than the link can send, so they wait in its buffer: ${fmtMs(m.edges[hotEdge.id].queueMs)} of delay and growing. Nothing is dropped until the buffer is full.`
      : hotNode
        ? `${fmtRate(m.nodes[hotNode.id].in)}/s arrive and it finishes ${fmtRate(capacityOf(hotNode))}/s, so a queue builds (${Math.round(m.nodes[hotNode.id].backlog)} waiting).`
        : ''
    return { tone: 'warn', headline: `Overloaded at ${worstName}. The slowest requests take ${fmtMs(g.p99)}.`, detail: extra }
  }
  if (worstU > 0.8) {
    return {
      tone: 'warn',
      headline: `${cap(worstName)} is running hot at ${fmtPct(worstU)}.`,
      detail: `Past about 80% busy, small bursts start to queue and waiting time climbs fast. Nudge the load up a little and watch p99.`,
    }
  }
  return {
    tone: 'good',
    headline: `Healthy: ${fmtRate(g.goodput)} requests a second, slowest 1% in ${fmtMs(g.p99)}.`,
    detail: `${fw && bot ? `${fw.label} is dropping ${fmtRate(m.nodes[fw.id].blocked)}/s of junk. ` : ''}The busiest part is ${worstName} at ${fmtPct(worstU)}. Drag the load slider up to find where it breaks.`,
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)


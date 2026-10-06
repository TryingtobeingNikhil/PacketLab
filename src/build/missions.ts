import type { SimResult } from '../sim/engine'
import type { Kind, Level, SimEdge, SimNode } from '../types'

export interface MissionCtx {
  nodes: SimNode[]
  edges: SimEdge[]
  m: SimResult | null
}

export interface MissionStep {
  text: string
  hint: string
  check: (c: MissionCtx) => boolean
}

export interface Mission {
  id: string
  title: string
  level: Level
  preset: string
  brief: string
  steps: MissionStep[]
  outro: string
}

/* ---- graph helpers ---- */
const ofKind = (c: MissionCtx, kinds: Kind[]) => c.nodes.filter((n) => kinds.includes(n.kind))

/** is there a directed path from any node of kind A to any node of kind B (optionally only through allowed kinds)? */
function reaches(c: MissionCtx, from: Kind[], to: Kind[]) {
  const out: Record<string, string[]> = {}
  c.edges.forEach((e) => (out[e.from] ??= []).push(e.to))
  const kind: Record<string, Kind> = Object.fromEntries(c.nodes.map((n) => [n.id, n.kind]))
  const seen = new Set<string>()
  const q = ofKind(c, from).map((n) => n.id)
  while (q.length) {
    const id = q.shift()!
    for (const nx of out[id] ?? []) {
      if (seen.has(nx)) continue
      seen.add(nx)
      if (to.includes(kind[nx])) return true
      q.push(nx)
    }
  }
  return false
}
const linked = (c: MissionCtx, a: Kind[], b: Kind[]) =>
  c.edges.some((e) => a.includes(c.nodes.find((n) => n.id === e.from)?.kind as Kind) && b.includes(c.nodes.find((n) => n.id === e.to)?.kind as Kind))
const g = (c: MissionCtx) => c.m?.global

const ROUTERS: Kind[] = ['nat', 'router']
const CLIENTS: Kind[] = ['client', 'mobile']

export const MISSIONS: Mission[] = [
  {
    id: 'online',
    title: 'Get your laptop online',
    level: 'beginner',
    preset: 'm-online',
    brief: 'A laptop and a website, and nothing in between. Build the road a packet takes from your home to a server.',
    steps: [
      { text: 'Connect the laptop to a Wi‑Fi access point', hint: 'Drag “Wi‑Fi AP” in from Parts, then drag the laptop’s ＋ port onto it.', check: (c) => linked(c, CLIENTS, ['wifi', 'switch']) },
      { text: 'Add a home router after the Wi‑Fi', hint: 'Use “NAT gateway” (that is what a home router is) or “Router”, and wire the Wi‑Fi into it.', check: (c) => reaches(c, ['wifi', 'switch'], ROUTERS) },
      { text: 'Connect the router to the Internet', hint: 'Drag in “Internet” and wire the router to it.', check: (c) => reaches(c, ROUTERS, ['internet']) },
      { text: 'Reach the website', hint: 'Wire the Internet to the Website. Requests should start succeeding.', check: (c) => reaches(c, CLIENTS, ['server']) && (g(c)?.goodput ?? 0) > 0.5 },
    ],
    outro: 'That is the trip every page load makes. Wi‑Fi carries the frame to your router, the router swaps your private address for its public one (NAT), the Internet passes it between networks, and the server answers.',
  },
  {
    id: 'launch',
    title: 'Survive launch day',
    level: 'beginner',
    preset: 'm-launch',
    brief: '400 users a second just showed up and the single API server is drowning. Scale out.',
    steps: [
      { text: 'Put a load balancer between the users and the server', hint: 'Drag in “Load balancer”, wire Users → Load balancer → API server. Then delete the old direct link (click it, press Backspace).', check: (c) => reaches(c, CLIENTS, ['lb']) && reaches(c, ['lb'], ['server']) },
      { text: 'Run at least three servers behind it', hint: 'Add Servers and wire the load balancer to each, and each server to the database.', check: (c) => c.edges.filter((e) => c.nodes.find((n) => n.id === e.from)?.kind === 'lb' && c.nodes.find((n) => n.id === e.to)?.kind === 'server').length >= 3 },
      { text: 'Get errors under 1%', hint: 'Every server needs a link to the database too, or its requests have nowhere to go.', check: (c) => !!g(c) && g(c)!.errorPct < 0.01 && g(c)!.goodput > 300 },
      { text: 'Keep the slowest requests under 300 ms', hint: 'If p99 is still high, look for the busiest ring. Is it a server or the database?', check: (c) => !!g(c) && g(c)!.p99 < 300 && g(c)!.goodput > 300 },
    ],
    outro: 'Scaling out: a load balancer spreads requests over many identical servers, so no single one sits past 80% busy where queues (and latency) explode.',
  },
  {
    id: 'far',
    title: 'Fast for faraway users',
    level: 'intermediate',
    preset: 'm-far',
    brief: 'Your users are in Mumbai and your only server is in Virginia, about 230 ms away. Bring the content to them.',
    steps: [
      { text: 'Put a CDN edge between the users and the Internet', hint: 'Drag in “CDN edge”, wire Users → CDN → Internet, and delete the old direct link.', check: (c) => linked(c, CLIENTS, ['cdn']) && reaches(c, ['cdn'], ['server']) && !linked(c, CLIENTS, ['internet']) },
      { text: 'Get the slowest requests under 120 ms', hint: 'p99 counts the slowest 1 in 100. With an 80% hit rate, 1 in 5 requests still crosses the planet. Click the CDN and raise its hit rate past 99.5%.', check: (c) => !!g(c) && g(c)!.p99 < 120 && g(c)!.goodput > 10 },
    ],
    outro: 'Two lessons in one: caching near users removes distance, and percentiles are unforgiving. Even a 5% miss rate puts the full trip into your p99.',
  },
]

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]))

/** index of the first step that is not done yet (steps count in order), or steps.length when finished */
export function progressOf(mission: Mission, c: MissionCtx) {
  let i = 0
  while (i < mission.steps.length && mission.steps[i].check(c)) i++
  return i
}

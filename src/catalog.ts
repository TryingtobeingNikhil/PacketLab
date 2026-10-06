import {
  Archive, ArrowLeftRight, BrickWall, Bug, Building2, Cable, CloudDownload, Cog, Copy, Cpu, Database,
  DoorOpen, Globe, HardDrive, Laptop, ListOrdered, Lock, MemoryStick, Monitor, Network, Router, Server,
  Shapes, Share2, Signpost, Smartphone, Sparkles, Split, Waypoints, Wifi, Zap, Boxes, EthernetPort,
  type LucideIcon,
} from 'lucide-react'
import type { Category, Kind, LinkParams, NodeParams } from './types'

export type Route = 'split' | 'fanout' | 'none'

export interface KindInfo {
  label: string
  cat: Category
  icon: LucideIcon
  desc: string
  route: Route
  /** shows in sandbox palette */
  palette: boolean
  defaults: Partial<NodeParams>
  /** which params the inspector exposes */
  knobs: (keyof NodeParams)[]
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'traffic', label: 'Traffic' },
  { id: 'edge', label: 'Edge' },
  { id: 'network', label: 'Network' },
  { id: 'compute', label: 'Compute' },
  { id: 'data', label: 'Data' },
  { id: 'ai', label: 'AI infra' },
]

export const CAT_COLOR: Record<Category, string> = {
  traffic: 'var(--c-violet)',
  edge: 'var(--c-teal)',
  network: 'var(--c-amber)',
  compute: 'var(--c-blue)',
  data: 'var(--c-cyan)',
  ai: 'var(--c-pink)',
}

const base: NodeParams = {
  concurrency: 8,
  serviceMs: 20,
  queueLimit: 200,
  hitRate: 0,
  blockRate: 0,
  attackRate: 0,
  weight: 1,
}

export const KINDS: Record<Kind, KindInfo> = {
  client: {
    label: 'Client', cat: 'traffic', icon: Monitor, route: 'split', palette: true,
    desc: 'Users sending requests. Each client sends the offered load from the top bar (times its weight).',
    defaults: {}, knobs: ['weight'],
  },
  mobile: {
    label: 'Mobile users', cat: 'traffic', icon: Smartphone, route: 'split', palette: true,
    desc: 'Phones on cellular links: same as a client, but you usually pair them with a lossy, high‑latency link.',
    defaults: { weight: 0.5 }, knobs: ['weight'],
  },
  botnet: {
    label: 'Botnet', cat: 'traffic', icon: Bug, route: 'split', palette: true,
    desc: 'Malicious traffic (a DDoS). It eats capacity like real users but nobody wants the responses. Put a firewall in front.',
    defaults: { attackRate: 400 }, knobs: ['attackRate'],
  },
  dns: {
    label: 'DNS resolver', cat: 'edge', icon: Signpost, route: 'split', palette: true,
    desc: 'Turns names into IP addresses. With a high cache hit rate most lookups never leave the resolver.',
    defaults: { concurrency: 64, serviceMs: 2, hitRate: 0.9, queueLimit: 500 }, knobs: ['hitRate', 'concurrency', 'serviceMs'],
  },
  cdn: {
    label: 'CDN edge', cat: 'edge', icon: CloudDownload, route: 'split', palette: true,
    desc: 'A cache close to users. Hits are served from the edge in a few ms; misses go back to the origin.',
    defaults: { concurrency: 256, serviceMs: 4, hitRate: 0.8, queueLimit: 2000 }, knobs: ['hitRate', 'concurrency'],
  },
  firewall: {
    label: 'Firewall / WAF', cat: 'edge', icon: BrickWall, route: 'split', palette: true,
    desc: 'Inspects packets and drops what matches a rule. Block rate is how much malicious traffic it catches.',
    defaults: { concurrency: 128, serviceMs: 1, blockRate: 0.95, queueLimit: 1000 }, knobs: ['blockRate', 'concurrency', 'serviceMs'],
  },
  lb: {
    label: 'Load balancer', cat: 'edge', icon: Split, route: 'split', palette: true,
    desc: 'Spreads requests across everything it is connected to. Adds almost no latency and a lot of headroom.',
    defaults: { concurrency: 512, serviceMs: 1, queueLimit: 2000 }, knobs: ['concurrency'],
  },
  gateway: {
    label: 'API gateway', cat: 'edge', icon: DoorOpen, route: 'split', palette: true,
    desc: 'An L7 proxy: terminates TLS, checks auth, routes by path. Slower than an L4 balancer, smarter too.',
    defaults: { concurrency: 128, serviceMs: 3, queueLimit: 800 }, knobs: ['concurrency', 'serviceMs'],
  },
  nat: {
    label: 'NAT gateway', cat: 'edge', icon: ArrowLeftRight, route: 'split', palette: true,
    desc: 'Rewrites private source addresses to one public IP. Each flow needs a port mapping, so it has a connection ceiling.',
    defaults: { concurrency: 256, serviceMs: 1, queueLimit: 400 }, knobs: ['concurrency', 'queueLimit'],
  },
  switch: {
    label: 'Switch', cat: 'network', icon: EthernetPort, route: 'split', palette: true,
    desc: 'Layer 2. Forwards frames by MAC address inside one network. Line‑rate, microseconds of latency.',
    defaults: { concurrency: 4096, serviceMs: 0.05, queueLimit: 4000 }, knobs: ['queueLimit'],
  },
  router: {
    label: 'Router', cat: 'network', icon: Router, route: 'split', palette: true,
    desc: 'Layer 3. Forwards packets between networks by longest‑prefix match. Splits across equal‑cost paths (ECMP).',
    defaults: { concurrency: 2048, serviceMs: 0.2, queueLimit: 3000 }, knobs: ['queueLimit'],
  },
  internet: {
    label: 'Internet', cat: 'network', icon: Globe, route: 'split', palette: true,
    desc: 'Many autonomous systems glued together by BGP. Treat it as a big pipe with latency you do not control.',
    defaults: { concurrency: 100000, serviceMs: 0.1, queueLimit: 100000 }, knobs: [],
  },
  wifi: {
    label: 'Wi‑Fi AP', cat: 'network', icon: Wifi, route: 'split', palette: true,
    desc: 'A shared radio. Only one device talks at a time, so airtime is the bottleneck, not the wire.',
    defaults: { concurrency: 1, serviceMs: 1.5, queueLimit: 300 }, knobs: ['serviceMs', 'queueLimit'],
  },
  vpn: {
    label: 'VPN tunnel', cat: 'network', icon: Lock, route: 'split', palette: true,
    desc: 'Encrypts and wraps every packet in another packet. Costs CPU per packet and a few bytes of overhead.',
    defaults: { concurrency: 32, serviceMs: 0.8, queueLimit: 600 }, knobs: ['concurrency', 'serviceMs'],
  },
  server: {
    label: 'Server', cat: 'compute', icon: Server, route: 'fanout', palette: true,
    desc: 'Does the work. Concurrency × (1000 / service time) is how many requests a second it can finish.',
    defaults: { concurrency: 8, serviceMs: 25, queueLimit: 200 }, knobs: ['concurrency', 'serviceMs', 'queueLimit'],
  },
  service: {
    label: 'Microservice', cat: 'compute', icon: Boxes, route: 'fanout', palette: true,
    desc: 'A service that calls everything it is connected to, in parallel, and waits for the slowest.',
    defaults: { concurrency: 16, serviceMs: 10, queueLimit: 200 }, knobs: ['concurrency', 'serviceMs', 'queueLimit'],
  },
  worker: {
    label: 'Worker', cat: 'compute', icon: Cog, route: 'fanout', palette: true,
    desc: 'Pulls jobs off a queue. Nobody waits on it directly, so slow workers grow the queue instead of the latency.',
    defaults: { concurrency: 4, serviceMs: 80, queueLimit: 50 }, knobs: ['concurrency', 'serviceMs'],
  },
  queue: {
    label: 'Queue', cat: 'compute', icon: ListOrdered, route: 'split', palette: true,
    desc: 'Accepts work instantly and hands it to workers at their pace. Converts latency into backlog.',
    defaults: { concurrency: 1000, serviceMs: 1, queueLimit: 50000 }, knobs: ['queueLimit'],
  },
  database: {
    label: 'Database', cat: 'data', icon: Database, route: 'fanout', palette: true,
    desc: 'Durable storage. Usually the smallest box in the diagram and the first to fall over.',
    defaults: { concurrency: 6, serviceMs: 30, queueLimit: 100 }, knobs: ['concurrency', 'serviceMs', 'queueLimit'],
  },
  cache: {
    label: 'Cache', cat: 'data', icon: Zap, route: 'split', palette: true,
    desc: 'In‑memory key/value store. Hits return in ~1ms; misses fall through to whatever it is connected to.',
    defaults: { concurrency: 64, serviceMs: 1, hitRate: 0.85, queueLimit: 1000 }, knobs: ['hitRate', 'concurrency'],
  },
  replica: {
    label: 'Read replica', cat: 'data', icon: Copy, route: 'fanout', palette: true,
    desc: 'A copy of the database that serves reads. Put several behind a load balancer.',
    defaults: { concurrency: 6, serviceMs: 25, queueLimit: 100 }, knobs: ['concurrency', 'serviceMs'],
  },
  objectstore: {
    label: 'Object storage', cat: 'data', icon: Archive, route: 'fanout', palette: true,
    desc: 'S3‑style blob storage. Effectively infinite throughput, but every request pays tens of ms.',
    defaults: { concurrency: 2000, serviceMs: 60, queueLimit: 10000 }, knobs: ['serviceMs'],
  },
  gpu: {
    label: 'GPU node', cat: 'ai', icon: Cpu, route: 'fanout', palette: true,
    desc: 'Eight accelerators in a box. In training, these spend a big share of every step waiting on the network.',
    defaults: { concurrency: 8, serviceMs: 120, queueLimit: 64 }, knobs: ['concurrency', 'serviceMs', 'queueLimit'],
  },
  inference: {
    label: 'Inference server', cat: 'ai', icon: Sparkles, route: 'fanout', palette: true,
    desc: 'Serves a model with continuous batching. Concurrency is the batch size; service time is one full generation.',
    defaults: { concurrency: 32, serviceMs: 900, queueLimit: 256 }, knobs: ['concurrency', 'serviceMs', 'queueLimit'],
  },
  modelrouter: {
    label: 'Model router', cat: 'ai', icon: Waypoints, route: 'split', palette: true,
    desc: 'Routes prompts to replicas, ideally the one that already holds the prompt prefix in its KV cache.',
    defaults: { concurrency: 256, serviceMs: 2, queueLimit: 2000 }, knobs: ['concurrency'],
  },
  kvcache: {
    label: 'Prefix / KV cache', cat: 'ai', icon: MemoryStick, route: 'split', palette: true,
    desc: 'Reuses attention state for repeated prompt prefixes. Each hit skips the expensive prefill.',
    defaults: { concurrency: 128, serviceMs: 3, hitRate: 0.5, queueLimit: 1000 }, knobs: ['hitRate'],
  },
  vectordb: {
    label: 'Vector DB', cat: 'ai', icon: Shapes, route: 'fanout', palette: true,
    desc: 'Nearest‑neighbour search over embeddings for retrieval (RAG).',
    defaults: { concurrency: 16, serviceMs: 15, queueLimit: 200 }, knobs: ['concurrency', 'serviceMs'],
  },
  nvswitch: {
    label: 'NVLink switch', cat: 'ai', icon: Cable, route: 'split', palette: true,
    desc: 'Scale‑up fabric inside a rack: hundreds of GB/s per GPU, sub‑microsecond hops.',
    defaults: { concurrency: 100000, serviceMs: 0.001, queueLimit: 100000 }, knobs: [],
  },
  ibswitch: {
    label: 'InfiniBand / RoCE', cat: 'ai', icon: Share2, route: 'split', palette: true,
    desc: 'Scale‑out fabric between racks. Lossless, RDMA‑capable, typically 400–800 Gb/s per port.',
    defaults: { concurrency: 50000, serviceMs: 0.002, queueLimit: 50000 }, knobs: ['queueLimit'],
  },
  storage: {
    label: 'Parallel storage', cat: 'ai', icon: HardDrive, route: 'fanout', palette: true,
    desc: 'Feeds training data and absorbs checkpoints. Checkpoint bursts can saturate the storage network.',
    defaults: { concurrency: 64, serviceMs: 40, queueLimit: 500 }, knobs: ['concurrency', 'serviceMs'],
  },
  host: {
    label: 'Host', cat: 'compute', icon: Laptop, route: 'fanout', palette: false,
    desc: 'An end host.', defaults: {}, knobs: [],
  },
  ap: {
    label: 'Access point', cat: 'network', icon: Wifi, route: 'split', palette: false,
    desc: 'Wireless access point.', defaults: {}, knobs: [],
  },
  as: {
    label: 'Autonomous system', cat: 'network', icon: Building2, route: 'split', palette: false,
    desc: 'A network run by one organisation with its own routing policy.', defaults: {}, knobs: [],
  },
}

// keep tree-shaking honest for icons only used in lessons
void Network

export function defaultParams(kind: Kind): NodeParams {
  return { ...base, ...KINDS[kind].defaults }
}

export const DEFAULT_LINK: LinkParams = {
  bandwidthMbps: 1000,
  latencyMs: 1,
  lossPct: 0,
  bufferKB: 512,
}

export const KNOB_META: Record<keyof NodeParams, { label: string; min: number; max: number; step: number; unit: string; log?: boolean; hint: string }> = {
  concurrency: { label: 'Concurrency', min: 1, max: 4096, step: 1, unit: '', log: true, hint: 'Requests it can work on at the same time (threads, connections, batch slots).' },
  serviceMs: { label: 'Service time', min: 0.5, max: 3000, step: 0.5, unit: 'ms', log: true, hint: 'How long one request takes when nothing is waiting.' },
  queueLimit: { label: 'Queue limit', min: 0, max: 50000, step: 1, unit: '', log: true, hint: 'How many requests can wait. Past this, new arrivals are dropped.' },
  hitRate: { label: 'Hit rate', min: 0, max: 1, step: 0.01, unit: '%', hint: 'Share of requests answered here without going further.' },
  blockRate: { label: 'Block rate', min: 0, max: 1, step: 0.01, unit: '%', hint: 'Share of malicious traffic that matches a rule and is dropped.' },
  attackRate: { label: 'Attack rate', min: 0, max: 20000, step: 10, unit: '/s', log: true, hint: 'Junk requests per second.' },
  weight: { label: 'Load share', min: 0, max: 4, step: 0.05, unit: '×', hint: 'Multiplier on the offered load from the top bar.' },
}

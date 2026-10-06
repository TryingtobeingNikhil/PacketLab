export type Category = 'traffic' | 'edge' | 'network' | 'compute' | 'data' | 'ai'

export type Kind =
  | 'client' | 'mobile' | 'botnet'
  | 'dns' | 'cdn' | 'firewall' | 'lb' | 'gateway' | 'nat'
  | 'switch' | 'router' | 'internet' | 'wifi' | 'vpn'
  | 'server' | 'service' | 'worker' | 'queue'
  | 'database' | 'cache' | 'replica' | 'objectstore'
  | 'gpu' | 'inference' | 'modelrouter' | 'nvswitch' | 'ibswitch' | 'vectordb' | 'kvcache' | 'storage'
  | 'host' | 'ap' | 'as'

export interface NodeParams {
  concurrency: number
  serviceMs: number
  queueLimit: number
  hitRate: number // cache / cdn
  blockRate: number // firewall
  attackRate: number // botnet
  weight: number // client share multiplier
}

export interface SimNode {
  id: string
  kind: Kind
  label: string
  x: number
  y: number
  params: NodeParams
}

export interface LinkParams {
  bandwidthMbps: number
  latencyMs: number
  lossPct: number
  bufferKB: number
}

export interface SimEdge {
  id: string
  from: string
  to: string
  params: LinkParams
}

export interface Note {
  id: string
  x: number
  y: number
  text: string
  w?: number
}

export interface NodeMetrics {
  in: number // req/s arriving
  out: number // req/s served
  util: number // 0..1+
  backlog: number
  waitMs: number
  p99: number // end-to-end p99 below this node
  dropRate: number // req/s dropped here
  hits: number
  blocked: number
  okRate: number // clients: successful responses/s
  failPct: number
  bad: number // malicious share 0..1
  hist: number[]
}

export interface EdgeMetrics {
  flow: number // req/s delivered
  bad: number
  util: number
  queueMs: number
  dropRate: number
}

export interface GlobalMetrics {
  p99: number
  goodput: number
  errorPct: number
  dropped: number
  t: number
}

/* ------------------------------ lessons ------------------------------ */

export interface LNode {
  id: string
  kind: Kind
  label: string
  sub?: string
  x: number
  y: number
}

/** [a, b, label?] — undirected */
export type LLink = [string, string, string?]

export type Layer = 'l2' | 'l3' | 'l4' | 'l7' | 'x'

export interface Msg {
  from: string
  to: string
  label: string
  /** colour key */
  c?: 'blue' | 'teal' | 'violet' | 'amber' | 'pink' | 'green' | 'red' | 'gray'
  /** run in parallel with the previous msg */
  par?: boolean
  /** packet is lost along the way */
  drop?: boolean
  /** explicit hop path override */
  via?: string[]
  /** header fields shown in the packet inspector */
  h?: Partial<Record<Layer, Record<string, string>>>
  /** number of packets in a burst (visual only) */
  burst?: number
  /** plain-language caption shown on the canvas while this packet moves */
  why?: string
}

export interface Table {
  title: string
  cols: string[]
  rows: string[][]
  /** row indexes to highlight as new */
  fresh?: number[]
}

export interface Step {
  say: string
  /** extra detail shown in intermediate mode */
  deep?: string
  msgs?: Msg[]
  focus?: string[]
  tables?: Record<string, Table>
  /** small handwritten note on the canvas */
  note?: { x: number; y: number; text: string }
}

export interface Quiz {
  q: string
  options: string[]
  answer: number
  why: string
}

export type WidgetKind = 'osi' | 'subnet' | 'cwnd' | 'bdp' | 'latency' | 'http' | 'collective' | 'parallelism'

export type Level = 'beginner' | 'intermediate'

export interface Lesson {
  id: string
  chapter: string
  level: Level
  title: string
  blurb: string
  nodes: LNode[]
  links: LLink[]
  steps: Step[]
  takeaways: string[]
  quiz?: Quiz[]
  widget?: WidgetKind
  sandbox?: string // preset id
  minutes?: number
}

export interface Chapter {
  id: string
  title: string
  icon: string
}

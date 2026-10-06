import { DEFAULT_LINK, defaultParams } from '../catalog'
import type { Kind, LinkParams, Level, Note, NodeParams, SimEdge, SimNode } from '../types'

export interface Preset {
  id: string
  title: string
  level: Level
  blurb: string
  offered: number
  payloadKB: number
  nodes: SimNode[]
  edges: SimEdge[]
  notes: Note[]
  /** what to try */
  tryIt: string[]
}

// layouts are authored on a 340 × 120 grid; pucks need a little more vertical room
const X = 0.74
const Y = 1.35
function n(id: string, kind: Kind, label: string, x: number, y: number, params: Partial<NodeParams> = {}): SimNode {
  return { id, kind, label, x: Math.round(x * X), y: Math.round(y * Y), params: { ...defaultParams(kind), ...params } }
}
function e(from: string, to: string, params: Partial<LinkParams> = {}): SimEdge {
  return { id: `${from}->${to}`, from, to, params: { ...DEFAULT_LINK, ...params } }
}
const note = (id: string, x: number, y: number, text: string, w = 540): Note => ({ id, x: Math.round(x * X) - 50, y: Math.round(y * Y) + 10, text, w: Math.min(w, 480) })

export const PRESETS: Preset[] = [
  {
    id: 'single',
    title: 'One server, one database',
    level: 'beginner',
    blurb: 'The smallest system that can fall over. Find out which box breaks first.',
    offered: 50,
    payloadKB: 4,
    nodes: [
      n('c', 'client', 'Client', 0, 0),
      n('api', 'server', 'API server', 380, 0, { concurrency: 8, serviceMs: 25 }),
      n('db', 'database', 'Database', 760, 0, { concurrency: 6, serviceMs: 30 }),
    ],
    edges: [e('c', 'api', { latencyMs: 15, bandwidthMbps: 1000 }), e('api', 'db', { latencyMs: 0.5 })],
    notes: [
      note('n1', 0, 150, 'The database is the smaller box: 6 requests at a time, 30ms each, so it tops out near 200/s. Drag the load past 200 and watch the wait build there first, not at the API.'),
    ],
    tryIt: ['Push offered load to 150, then 250.', 'Click the database and double its concurrency. Who breaks next?', 'Set the client link latency to 150ms (another continent). What happens to p99?'],
  },
  {
    id: 'scaleout',
    title: 'Load balancer + cache',
    level: 'beginner',
    blurb: 'Spread the work across servers, then keep most reads away from the database.',
    offered: 600,
    payloadKB: 4,
    nodes: [
      n('c', 'client', 'Client', 0, 120),
      n('lb', 'lb', 'Load balancer', 340, 120),
      n('s1', 'server', 'Server A', 680, 0),
      n('s2', 'server', 'Server B', 680, 120),
      n('s3', 'server', 'Server C', 680, 240),
      n('ca', 'cache', 'Redis cache', 1020, 120, { hitRate: 0.85 }),
      n('db', 'database', 'Primary DB', 1360, 120),
    ],
    edges: [
      e('c', 'lb', { latencyMs: 15 }),
      e('lb', 's1'), e('lb', 's2'), e('lb', 's3'),
      e('s1', 'ca'), e('s2', 'ca'), e('s3', 'ca'),
      e('ca', 'db'),
    ],
    notes: [note('n1', 0, 300, 'Three servers share the load, and the cache answers 85% of reads in about a millisecond. Drop the hit rate to 40% and the database becomes the bottleneck again.', 520)],
    tryIt: ['Lower the cache hit rate to 0.4.', 'Delete Server C (select it, press Backspace).', 'Push load to 2000/s. What breaks?'],
  },
  {
    id: 'bufferbloat',
    title: 'A thin pipe (bufferbloat)',
    level: 'intermediate',
    blurb: 'A 20 Mb/s uplink with a deep buffer. Latency explodes long before anything is dropped.',
    offered: 30,
    payloadKB: 64,
    nodes: [
      n('c', 'client', 'Office', 0, 0),
      n('r', 'router', 'Edge router', 360, 0),
      n('net', 'internet', 'Internet', 720, 0),
      n('s', 'server', 'Server', 1080, 0, { concurrency: 64, serviceMs: 10 }),
    ],
    edges: [
      e('c', 'r', { bandwidthMbps: 1000, latencyMs: 0.2 }),
      e('r', 'net', { bandwidthMbps: 20, latencyMs: 5, bufferKB: 8192 }),
      e('net', 's', { bandwidthMbps: 10000, latencyMs: 20 }),
    ],
    notes: [note('n1', 0, 150, '64KB responses over a 20 Mb/s uplink: about 38 requests a second fill the pipe. Past that the router buffers instead of dropping, so every packet waits behind everyone else. Shrink the buffer and compare.')],
    tryIt: ['Push load to 45/s and watch the link turn red.', 'Click the uplink and cut the buffer to 256 KB: less delay, more drops.', 'Raise bandwidth to 100 Mb/s.'],
  },
  {
    id: 'lossy',
    title: 'Lossy mobile network',
    level: 'intermediate',
    blurb: 'A 1–2% loss rate looks harmless on average and wrecks the tail.',
    offered: 120,
    payloadKB: 24,
    nodes: [
      n('m', 'mobile', 'Phones (4G)', 0, 0, { weight: 1 }),
      n('gw', 'gateway', 'API gateway', 380, 0),
      n('svc', 'service', 'Feed service', 760, 0),
    ],
    edges: [
      e('m', 'gw', { bandwidthMbps: 50, latencyMs: 45, lossPct: 1.5 }),
      e('gw', 'svc', { latencyMs: 0.5 }),
    ],
    notes: [note('n1', 0, 150, 'Each 24KB response is ~18 packets. At 1.5% loss, about one response in four loses a packet and waits for a retransmit timeout (≥200ms). That lands squarely in your p99. Set loss to 0.01% and watch it collapse.')],
    tryIt: ['Set link loss to 0.01%.', 'Shrink the payload to 2 KB (bottom bar). Does it help at 1.5% loss?', 'Compare mean latency vs p99 in the inspector.'],
  },
  {
    id: 'ddos',
    title: 'DDoS vs a firewall',
    level: 'beginner',
    blurb: 'A botnet floods the site. A firewall drops most of it before it costs you anything.',
    offered: 200,
    payloadKB: 4,
    nodes: [
      n('c', 'client', 'Real users', 0, 0),
      n('b', 'botnet', 'Botnet', 0, 220, { attackRate: 3000 }),
      n('fw', 'firewall', 'Firewall / WAF', 380, 110, { blockRate: 0 }),
      n('lb', 'lb', 'Load balancer', 760, 110),
      n('s1', 'server', 'Web 1', 1140, 40),
      n('s2', 'server', 'Web 2', 1140, 180),
    ],
    edges: [
      e('c', 'fw', { latencyMs: 20 }), e('b', 'fw', { latencyMs: 20 }),
      e('fw', 'lb'), e('lb', 's1'), e('lb', 's2'),
    ],
    notes: [note('n1', 0, 360, 'The firewall is switched off (block rate 0%), so 3,000 junk requests a second hit two servers that can do ~640 between them. Real users time out. Click the firewall and turn the block rate up.')],
    tryIt: ['Set firewall block rate to 95%.', 'Raise the attack to 20,000/s: even 5% leaking is a lot.', 'Add a third web server.'],
  },
  {
    id: 'queue',
    title: 'Queues & workers',
    level: 'intermediate',
    blurb: 'Hand slow work to a queue. Users get an instant answer; the backlog grows instead.',
    offered: 120,
    payloadKB: 4,
    nodes: [
      n('c', 'client', 'Uploads', 0, 100),
      n('api', 'service', 'Upload API', 360, 100, { serviceMs: 8 }),
      n('q', 'queue', 'Job queue', 720, 100),
      n('w1', 'worker', 'Transcoder 1', 1080, 20, { concurrency: 4, serviceMs: 80 }),
      n('w2', 'worker', 'Transcoder 2', 1080, 180, { concurrency: 4, serviceMs: 80 }),
    ],
    edges: [e('c', 'api', { latencyMs: 15 }), e('api', 'q'), e('q', 'w1'), e('q', 'w2')],
    notes: [note('n1', 0, 260, 'Two workers finish 100 jobs a second. Send 120 and the queue backlog climbs forever, but user latency stays flat: the queue answers immediately. Watch "waiting" on the queue.')],
    tryIt: ['Drop load to 80/s and watch the backlog drain.', 'Add a third worker.', 'Set the queue limit to 500: what happens when it fills?'],
  },
  {
    id: 'path',
    title: 'Where does latency come from?',
    level: 'beginner',
    blurb: 'Home Wi‑Fi → ISP → Internet → CDN → origin. Every hop adds a little.',
    offered: 20,
    payloadKB: 16,
    nodes: [
      n('c', 'client', 'Laptop', 0, 0),
      n('ap', 'wifi', 'Home Wi‑Fi', 340, 0, { serviceMs: 1.2 }),
      n('nat', 'nat', 'Home router (NAT)', 680, 0),
      n('net', 'internet', 'Internet', 1020, 0),
      n('cdn', 'cdn', 'CDN edge', 1360, 0, { hitRate: 0.9 }),
      n('o', 'server', 'Origin', 1700, 0, { concurrency: 16 }),
    ],
    edges: [
      e('c', 'ap', { bandwidthMbps: 300, latencyMs: 2, lossPct: 0.1 }),
      e('ap', 'nat', { bandwidthMbps: 1000, latencyMs: 0.3 }),
      e('nat', 'net', { bandwidthMbps: 200, latencyMs: 8 }),
      e('net', 'cdn', { bandwidthMbps: 10000, latencyMs: 6 }),
      e('cdn', 'o', { bandwidthMbps: 10000, latencyMs: 70 }),
    ],
    notes: [note('n1', 0, 150, 'The CDN is 14ms away; the origin is another 140ms round trip. At a 90% hit rate most users never pay that, but 1 in 10 still do, so p99 does. Push the hit rate to 0.995 and watch p99 fall.', 600)],
    tryIt: ['Set the CDN hit rate to 0.995, then to 0.', 'Raise Wi‑Fi load to 300/s: shared airtime is a real bottleneck.', 'Add 1% loss on the Wi‑Fi link.'],
  },
  {
    id: 'llm',
    title: 'LLM inference with RAG',
    level: 'intermediate',
    blurb: 'Prompts go through a gateway, a retrieval step, a model router and a pool of GPU replicas.',
    offered: 40,
    payloadKB: 8,
    nodes: [
      n('c', 'client', 'Chat users', 0, 140),
      n('gw', 'gateway', 'API gateway', 340, 140),
      n('orch', 'service', 'RAG orchestrator', 680, 140, { serviceMs: 5 }),
      n('vdb', 'vectordb', 'Vector DB', 1020, 0),
      n('kv', 'kvcache', 'Prefix cache', 1020, 240, { hitRate: 0.3 }),
      n('mr', 'modelrouter', 'Model router', 1360, 240),
      n('g1', 'inference', 'Replica 1 (8×GPU)', 1700, 120),
      n('g2', 'inference', 'Replica 2 (8×GPU)', 1700, 360),
    ],
    edges: [
      e('c', 'gw', { latencyMs: 25 }), e('gw', 'orch'),
      e('orch', 'vdb'), e('orch', 'kv'), e('kv', 'mr'),
      e('mr', 'g1', { bandwidthMbps: 100000 }), e('mr', 'g2', { bandwidthMbps: 100000 }),
    ],
    notes: [note('n1', 0, 320, 'Each replica runs a batch of 32 generations at ~0.9s each, so two replicas serve ~70 prompts a second. Past that the queue in front of the GPUs is the whole story. A better prefix‑cache hit rate buys headroom for free.', 560)],
    tryIt: ['Push to 80 prompts/s.', 'Raise the prefix cache hit rate to 0.7.', 'Raise batch size (concurrency) to 64 but service time to 1400ms: is it a win?'],
  },
  {
    id: 'checkpoint',
    title: 'Training checkpoint storm',
    level: 'intermediate',
    blurb: 'Every GPU node writes its checkpoint at once. The storage network, not the disks, is the limit.',
    offered: 400,
    payloadKB: 1024,
    nodes: [
      n('j', 'client', 'Training job', 0, 120, { weight: 1 }),
      n('leaf', 'ibswitch', 'Storage leaf', 360, 120),
      n('s1', 'storage', 'Storage node 1', 720, 0, { concurrency: 64, serviceMs: 20 }),
      n('s2', 'storage', 'Storage node 2', 720, 240, { concurrency: 64, serviceMs: 20 }),
    ],
    edges: [
      e('j', 'leaf', { bandwidthMbps: 400000, latencyMs: 0.005, bufferKB: 65536 }),
      e('leaf', 's1', { bandwidthMbps: 100000, latencyMs: 0.005, bufferKB: 32768 }),
      e('leaf', 's2', { bandwidthMbps: 100000, latencyMs: 0.005, bufferKB: 32768 }),
    ],
    notes: [note('n1', 0, 300, '1 MB chunks. Each storage node has a 100 Gb/s port: ~12,000 chunks/s each, about 12 GB/s. The disks could do 3,200/s each, so here the disks bind first. Raise disk concurrency and the links take over.', 560)],
    tryIt: ['Raise storage concurrency to 512.', 'Push load to 20,000 chunks/s.', 'Upgrade storage links to 400 Gb/s.'],
  },
]

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))

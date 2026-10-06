import type { Kind } from '../types'

export interface MapNode {
  id: string
  kind: Kind
  label: string
  x: number
  y: number
  /** lessons that live on this device */
  lessons: string[]
  /** one plain sentence: why you'd click this */
  teaser: string
}

export interface Zone {
  label: string
  x: number
  y: number
  w: number
  h: number
}

/** the whole course as one picture of the Internet: click a device to learn how it works */
export const ZONES: Zone[] = [
  { label: 'Your home', x: -90, y: -100, w: 800, h: 480 },
  { label: 'Your ISP & the Internet', x: 730, y: -100, w: 510, h: 600 },
  { label: 'A data centre', x: 1260, y: -100, w: 600, h: 600 },
  { label: 'An AI cluster', x: 1880, y: -100, w: 460, h: 600 },
]

export const MAP_NODES: MapNode[] = [
  { id: 'lap', kind: 'client', label: 'Your laptop', x: 0, y: 200, lessons: ['what-is-a-network', 'layers'], teaser: 'Where every request starts: packets, and the layers wrapped around them.' },
  { id: 'ap', kind: 'wifi', label: 'Wi‑Fi', x: 190, y: 200, lessons: ['wifi'], teaser: 'Why everyone on the same Wi‑Fi has to take turns.' },
  { id: 'sw', kind: 'switch', label: 'Switch', x: 380, y: 200, lessons: ['switching', 'arp', 'vlans'], teaser: 'How devices in one building find each other by MAC address.' },
  { id: 'dhcp', kind: 'server', label: 'DHCP server', x: 380, y: 30, lessons: ['dhcp'], teaser: 'How your laptop gets an IP address the moment it joins.' },
  { id: 'home', kind: 'nat', label: 'Home router', x: 580, y: 200, lessons: ['ip-subnets', 'nat'], teaser: 'Addresses, subnets, and how a whole house shares one public IP.' },
  { id: 'isp', kind: 'router', label: 'ISP router', x: 840, y: 200, lessons: ['routing', 'traceroute'], teaser: 'How routers pick the next hop, and how traceroute reveals them.' },
  { id: 'net', kind: 'internet', label: 'The Internet', x: 1060, y: 200, lessons: ['bgp', 'latency-bandwidth'], teaser: '75,000 networks agreeing on routes, and why distance costs time.' },
  { id: 'dns', kind: 'dns', label: 'DNS resolver', x: 1060, y: -10, lessons: ['dns'], teaser: 'Turning “example.com” into an address, one server at a time.' },
  { id: 'cdn', kind: 'cdn', label: 'CDN edge', x: 1060, y: 400, lessons: ['cdn'], teaser: 'Copies of the web, parked close to you.' },
  { id: 'fw', kind: 'firewall', label: 'Firewall', x: 1340, y: 200, lessons: ['firewalls'], teaser: 'Rules that decide what gets in, and what a DDoS does to them.' },
  { id: 'vpn', kind: 'vpn', label: 'VPN gateway', x: 1340, y: 400, lessons: ['vpn'], teaser: 'Packets inside packets: joining networks across the Internet.' },
  { id: 'lb', kind: 'lb', label: 'Load balancer', x: 1530, y: 200, lessons: ['load-balancing'], teaser: 'One address in front, many servers behind.' },
  { id: 'web', kind: 'server', label: 'Web server', x: 1740, y: 200, lessons: ['http', 'tls', 'realtime'], teaser: 'Requests, responses, encryption and live updates.' },
  { id: 'dc', kind: 'switch', label: 'Data‑centre fabric', x: 1640, y: 400, lessons: ['datacenter'], teaser: 'Why every rack is exactly two hops from every other.' },
  { id: 'llm', kind: 'inference', label: 'LLM service', x: 1990, y: 60, lessons: ['inference'], teaser: 'From your prompt to streamed tokens.' },
  { id: 'gpu', kind: 'gpu', label: 'GPU servers', x: 1990, y: 260, lessons: ['gpu-interconnects', 'parallelism'], teaser: 'NVLink vs InfiniBand, and how big models are split up.' },
  { id: 'ib', kind: 'ibswitch', label: 'GPU fabric', x: 2200, y: 400, lessons: ['rdma', 'allreduce', 'incast'], teaser: 'RDMA, all‑reduce, and when 1,000 GPUs talk at once.' },
]

export const MAP_LINKS: [string, string][] = [
  ['lap', 'ap'], ['ap', 'sw'], ['sw', 'dhcp'], ['sw', 'home'], ['home', 'isp'], ['isp', 'net'], ['net', 'dns'], ['net', 'cdn'],
  ['net', 'fw'], ['net', 'vpn'], ['fw', 'lb'], ['lb', 'web'], ['web', 'dc'], ['lb', 'llm'], ['llm', 'gpu'], ['gpu', 'ib'], ['dc', 'gpu'],
]

/** the end-to-end connection between the laptop and the web server: where TCP and QUIC live */
export const CONNECTION = {
  from: 'lap',
  to: 'web',
  label: 'Your connection · TCP / QUIC',
  lessons: ['ports-udp-tcp', 'tcp-handshake', 'tcp-reliability', 'flow-control', 'congestion', 'quic'],
  teaser: 'The two ends talk directly, whatever is in between: ports, handshakes, loss and speed control.',
}

/** the request that drifts across the map to keep it alive */
export const AMBIENT_ROUTE = ['lap', 'ap', 'sw', 'home', 'isp', 'net', 'fw', 'lb', 'web']

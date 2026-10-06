import type { Lesson } from '../types'
import { N } from './helpers'

const rt = (title: string, rows: string[][], fresh?: number[]) => ({ title, cols: ['Prefix', 'Next hop', 'Iface'], rows, fresh })

export const ip: Lesson[] = [
  {
    id: 'ip-subnets',
    chapter: 'ip',
    level: 'beginner',
    title: 'IP addresses & subnets',
    blurb: 'An IP address is a street name plus a house number. The /24 tells you where the split is.',
    minutes: 5,
    widget: 'subnet',
    nodes: [
      N('a', 'host', 'Laptop', 0, 60, '192.168.1.20/24'),
      N('b', 'host', 'Printer', 0, 300, '192.168.1.40/24'),
      N('sw', 'switch', 'Switch', 300, 180),
      N('r', 'router', 'Router', 600, 180, '192.168.1.1 | 10.0.5.1'),
      N('s', 'server', 'File server', 900, 180, '10.0.5.10/24'),
    ],
    links: [['a', 'sw'], ['b', 'sw'], ['sw', 'r', '192.168.1.0/24'], ['r', 's', '10.0.5.0/24']],
    steps: [
      {
        say: 'An IPv4 address is 32 bits, written as four numbers from 0 to 255: 192.168.1.20. Part of it names the network (the street) and the rest names the host (the house).',
        focus: ['a'],
      },
      {
        say: 'The “/24” is the prefix length: the first 24 bits are the network part. So 192.168.1.20/24 lives on network 192.168.1.0, and there is room for 254 hosts (.1 to .254).',
        deep: '/24 = mask 255.255.255.0. The first address (.0) is the network address and the last (.255) is the broadcast address, so 2^8 − 2 = 254 usable. A /26 has 64 addresses, 62 usable. Play with the calculator on the right.',
      },
      {
        say: 'Same network? Talk directly. The laptop checks: is 192.168.1.40 inside 192.168.1.0/24? Yes, so it delivers straight through the switch, no router needed.',
        msgs: [{ from: 'a', to: 'b', label: 'print job', why: 'Same network, so the laptop delivers straight through the switch. No router needed.', c: 'blue', h: { l3: { src: '192.168.1.20', dst: '192.168.1.40' } } }],
        focus: ['a', 'b'],
      },
      {
        say: 'Different network? Send it to the gateway. 10.0.5.10 is not in 192.168.1.0/24, so the laptop hands the packet to its default gateway, the router, which has a leg in both networks.',
        msgs: [{ from: 'a', to: 's', label: 'to 10.0.5.10', why: 'Different network, so the laptop hands the packet to the router, which has a leg in both.', c: 'teal', h: { l3: { src: '192.168.1.20', dst: '10.0.5.10' } } }],
        focus: ['a', 'r', 's'],
      },
      {
        say: 'Some ranges are private and only used inside homes and companies: 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. They are never routed on the public Internet. That is why NAT exists.',
        deep: 'IPv4 has only ~4.3 billion addresses, which ran out years ago. IPv6 uses 128‑bit addresses (2001:db8::1), enough that every device can have a globally unique one; a typical LAN is a /64.',
      },
    ],
    takeaways: [
      'An IP address = network part + host part; the prefix length (/24) sets the boundary.',
      'Same subnet → deliver directly. Different subnet → send to the default gateway.',
      'Private ranges (10/8, 172.16/12, 192.168/16) need NAT to reach the Internet.',
    ],
    quiz: [
      { q: 'How many usable host addresses are in a /26?', options: ['30', '62', '64', '254'], answer: 1, why: '32 − 26 = 6 host bits → 64 addresses, minus network and broadcast = 62.' },
      { q: 'Are 10.1.2.3/16 and 10.1.200.9/16 on the same subnet?', options: ['Yes', 'No'], answer: 0, why: 'With /16 only the first two octets (10.1) are the network, and they match.' },
    ],
  },
  {
    id: 'routing',
    chapter: 'ip',
    level: 'beginner',
    title: 'Routing tables & TTL',
    blurb: 'Each router only knows the next step. Longest matching prefix wins.',
    minutes: 5,
    nodes: [
      N('h', 'host', 'Host', 0, 180, '10.1.0.7'),
      N('r1', 'router', 'R1', 250, 180),
      N('r2', 'router', 'R2', 500, 50),
      N('r3', 'router', 'R3', 500, 310),
      N('d', 'server', 'Server', 780, 50, '172.16.4.9'),
      N('i', 'internet', 'Internet', 780, 310),
    ],
    links: [['h', 'r1'], ['r1', 'r2'], ['r1', 'r3'], ['r2', 'd', '172.16.4.0/24'], ['r3', 'i', 'default'], ['r2', 'r3']],
    steps: [
      {
        say: 'A router has a routing table: a list of “to reach this range of addresses, send it to that neighbour”. It looks at the destination IP of each packet and picks the best matching row.',
        tables: { r1: rt('R1 routing table', [['10.1.0.0/16', 'direct', 'eth0'], ['172.16.0.0/12', 'R3', 'eth2'], ['172.16.4.0/24', 'R2', 'eth1'], ['0.0.0.0/0', 'R3', 'eth2']]) },
        focus: ['r1'],
      },
      {
        say: 'A packet for 172.16.4.9 arrives. Two rows match: 172.16.0.0/12 and 172.16.4.0/24. The router picks the longest prefix, /24, because it is the most specific. Off it goes to R2.',
        deep: 'Longest‑prefix match is done in hardware with TCAMs or tries, at hundreds of millions of lookups per second. 0.0.0.0/0 matches everything, so it is the default route, used only when nothing more specific matches.',
        msgs: [{ from: 'h', to: 'd', label: 'dst 172.16.4.9', why: 'R1 picks the most specific matching route, 172.16.4.0/24, which points to R2.', c: 'blue', via: ['h', 'r1', 'r2', 'd'], h: { l3: { src: '10.1.0.7', dst: '172.16.4.9', TTL: '64' } } }],
        tables: { r1: rt('R1 routing table', [['10.1.0.0/16', 'direct', 'eth0'], ['172.16.0.0/12', 'R3', 'eth2'], ['172.16.4.0/24', 'R2', 'eth1'], ['0.0.0.0/0', 'R3', 'eth2']], [2]) },
      },
      {
        say: 'A packet for 8.8.8.8 matches nothing specific, so it takes the default route 0.0.0.0/0 towards R3 and out to the Internet.',
        msgs: [{ from: 'h', to: 'i', label: 'dst 8.8.8.8', why: 'Nothing specific matches 8.8.8.8, so R1 uses the default route towards R3 and the Internet.', c: 'teal', via: ['h', 'r1', 'r3', 'i'] }],
        tables: { r1: rt('R1 routing table', [['10.1.0.0/16', 'direct', 'eth0'], ['172.16.0.0/12', 'R3', 'eth2'], ['172.16.4.0/24', 'R2', 'eth1'], ['0.0.0.0/0', 'R3', 'eth2']], [3]) },
      },
      {
        say: 'Every router decrements the packet’s TTL (time to live) by one. If a misconfiguration creates a loop, the packet circles until TTL hits zero and is discarded. Without this, loops would melt the network.',
        msgs: [
          { from: 'r2', to: 'r3', label: 'TTL 3', c: 'amber' },
          { from: 'r3', to: 'r2', label: 'TTL 2', c: 'amber' },
          { from: 'r2', to: 'r3', label: 'TTL 1', c: 'amber' },
          { from: 'r3', to: 'r2', label: 'TTL 0 ✕', c: 'red', drop: true },
        ],
        note: { x: 560, y: 180, text: 'loop! TTL saves us' },
      },
      {
        say: 'Who fills in these tables? Small networks use static routes typed by a human. Larger ones run routing protocols (OSPF, IS‑IS inside a company, BGP between companies) so routers discover paths and react to failures automatically.',
        deep: 'OSPF and IS‑IS are link‑state: each router floods its links to all others and runs Dijkstra’s shortest path. BGP is path‑vector and policy‑driven. Next lesson.',
      },
    ],
    takeaways: [
      'Routers forward by destination IP using longest‑prefix match.',
      '0.0.0.0/0 is the default route, the fallback.',
      'TTL is decremented per hop and stops loops from living forever.',
    ],
    quiz: [
      { q: 'Destination 10.20.30.40. Routes: 10.0.0.0/8 → A, 10.20.0.0/16 → B, 0.0.0.0/0 → C. Where does it go?', options: ['A', 'B', 'C'], answer: 1, why: 'Both /8 and /16 match, and /16 is longer (more specific).' },
    ],
  },
  {
    id: 'nat',
    chapter: 'ip',
    level: 'beginner',
    title: 'NAT: many devices, one IP',
    blurb: 'Your home router rewrites addresses and ports so a whole house can share one public IP.',
    minutes: 4,
    nodes: [
      N('a', 'host', 'Laptop', 0, 50, '192.168.1.20'),
      N('b', 'host', 'Phone', 0, 310, '192.168.1.31'),
      N('nat', 'nat', 'Home router', 330, 180, 'public 81.2.69.160'),
      N('i', 'internet', 'Internet', 620, 180),
      N('s', 'server', 'Website', 900, 180, '93.184.216.34'),
    ],
    links: [['a', 'nat'], ['b', 'nat'], ['nat', 'i'], ['i', 's']],
    steps: [
      {
        say: 'Your devices have private addresses like 192.168.1.20. Those cannot be used on the Internet: millions of homes use the same ones. The ISP gives your router a single public address.',
        tables: { nat: { title: 'NAT table', cols: ['Inside', 'Outside', 'Remote'], rows: [] } },
      },
      {
        say: 'The laptop sends a request. On the way out, the router swaps the private source (192.168.1.20:51000) for its public IP and a free port (81.2.69.160:40001), and writes the mapping down.',
        msgs: [
          { from: 'a', to: 'nat', label: 'src 192.168.1.20:51000', why: 'The laptop sends a request from its private address.', c: 'blue', h: { l3: { src: '192.168.1.20', dst: '93.184.216.34' }, l4: { src_port: '51000', dst_port: '443' } } },
          { from: 'nat', to: 's', label: 'src 81.2.69.160:40001', why: 'On the way out, the router swaps in its public address and a free port, and writes the mapping down.', c: 'teal', h: { l3: { src: '81.2.69.160', dst: '93.184.216.34' }, l4: { src_port: '40001', dst_port: '443' } } },
        ],
        tables: { nat: { title: 'NAT table', cols: ['Inside', 'Outside', 'Remote'], rows: [['192.168.1.20:51000', ':40001', '93.184.216.34:443']], fresh: [0] } },
      },
      {
        say: 'The phone talks to the same site. It gets a different outside port, so the router can tell the two conversations apart.',
        msgs: [{ from: 'b', to: 's', label: 'src → :40002', c: 'violet' }],
        tables: { nat: { title: 'NAT table', cols: ['Inside', 'Outside', 'Remote'], rows: [['192.168.1.20:51000', ':40001', '93.184.216.34:443'], ['192.168.1.31:49152', ':40002', '93.184.216.34:443']], fresh: [1] } },
      },
      {
        say: 'Replies come back to 81.2.69.160:40001. The router looks up port 40001, rewrites the destination back to 192.168.1.20:51000 and delivers it to the laptop.',
        msgs: [{ from: 's', to: 'a', label: 'to :40001 → .20:51000', why: 'The reply comes back to port 40001. The router looks it up and forwards it to the laptop.', c: 'green' }],
      },
      {
        say: 'Side effect: nobody outside can start a conversation with your laptop, because there is no table entry for unsolicited traffic. That accidental firewall is why peer‑to‑peer apps need tricks like port forwarding or hole punching.',
        deep: 'This is technically NAPT / PAT (port address translation). Carrier‑grade NAT (CGNAT) does the same at the ISP, so you may be behind two layers. WebRTC uses STUN to learn its public mapping and TURN relays when hole punching fails. IPv6 removes the need for NAT entirely.',
        msgs: [{ from: 's', to: 'nat', label: 'unsolicited', why: 'Nobody inside asked for this one. There is no table entry for it, so the router drops it.', c: 'red', drop: true }],
      },
    ],
    takeaways: [
      'NAT rewrites private source IP:port to a shared public IP:port.',
      'The NAT table maps replies back to the right device.',
      'Inbound connections are blocked unless a mapping exists (port forwarding).',
    ],
    quiz: [
      { q: 'How does a NAT router know which device a reply belongs to?', options: ['By the reply’s MAC address', 'By the destination port in the reply, looked up in its NAT table', 'It broadcasts the reply to everyone'], answer: 1, why: 'Each outbound flow was given a unique outside port; the reply arrives on that port.' },
    ],
  },
  {
    id: 'traceroute',
    chapter: 'ip',
    level: 'intermediate',
    title: 'ICMP, ping & traceroute',
    blurb: 'Traceroute abuses TTL to make every router on the path introduce itself.',
    minutes: 4,
    nodes: [
      N('h', 'host', 'You', 0, 180),
      N('r1', 'router', 'Home', 220, 180, '192.168.1.1'),
      N('r2', 'router', 'ISP', 440, 180, '100.64.0.1'),
      N('r3', 'router', 'Backbone', 660, 180, '62.115.1.9'),
      N('d', 'server', 'Destination', 900, 180, '1.1.1.1'),
    ],
    links: [['h', 'r1'], ['r1', 'r2'], ['r2', 'r3'], ['r3', 'd']],
    steps: [
      {
        say: 'ICMP is IP’s messaging service for errors and diagnostics. “Destination unreachable”, “time exceeded” and the echo request/reply used by ping are all ICMP.',
        msgs: [
          { from: 'h', to: 'd', label: 'echo request', c: 'blue', h: { l3: { proto: 'ICMP', dst: '1.1.1.1', TTL: '64' }, x: { type: '8 (echo request)' } } },
          { from: 'd', to: 'h', label: 'echo reply · 14ms', c: 'green' },
        ],
      },
      {
        say: 'Traceroute sends a packet with TTL = 1. The first router decrements it to 0, drops it, and sends back “ICMP time exceeded” from its own address. Now you know hop 1.',
        msgs: [
          { from: 'h', to: 'r1', label: 'TTL 1', c: 'amber' },
          { from: 'r1', to: 'h', label: 'time exceeded (hop 1)', c: 'red' },
        ],
        tables: { h: { title: 'traceroute 1.1.1.1', cols: ['Hop', 'Address', 'RTT'], rows: [['1', '192.168.1.1', '1.2 ms']], fresh: [0] } },
      },
      {
        say: 'Then TTL = 2 reaches the second router before dying, and so on. Each probe reveals one more hop and its round‑trip time.',
        msgs: [
          { from: 'h', to: 'r2', label: 'TTL 2', c: 'amber' },
          { from: 'r2', to: 'h', label: 'time exceeded (hop 2)', c: 'red' },
          { from: 'h', to: 'r3', label: 'TTL 3', c: 'amber' },
          { from: 'r3', to: 'h', label: 'time exceeded (hop 3)', c: 'red' },
        ],
        tables: { h: { title: 'traceroute 1.1.1.1', cols: ['Hop', 'Address', 'RTT'], rows: [['1', '192.168.1.1', '1.2 ms'], ['2', '100.64.0.1', '8.9 ms'], ['3', '62.115.1.9', '12.4 ms']], fresh: [1, 2] } },
      },
      {
        say: 'Finally a probe reaches the destination itself, which answers, and the trace is complete.',
        deep: 'Linux traceroute uses UDP to high ports (the destination answers “port unreachable”); Windows tracert uses ICMP echo. A “* * *” hop just means that router does not send ICMP, which is common, not necessarily a fault. Latency that jumps at one hop and stays high afterwards is the interesting signal.',
        msgs: [{ from: 'h', to: 'd', label: 'TTL 4', c: 'amber' }, { from: 'd', to: 'h', label: 'reply (done)', c: 'green' }],
        tables: { h: { title: 'traceroute 1.1.1.1', cols: ['Hop', 'Address', 'RTT'], rows: [['1', '192.168.1.1', '1.2 ms'], ['2', '100.64.0.1', '8.9 ms'], ['3', '62.115.1.9', '12.4 ms'], ['4', '1.1.1.1', '13.8 ms']], fresh: [3] } },
      },
    ],
    takeaways: [
      'ICMP carries errors and diagnostics for IP.',
      'Traceroute increments TTL from 1 and collects the “time exceeded” replies.',
      'Missing hops (* * *) often just mean ICMP is filtered.',
    ],
    quiz: [
      { q: 'What makes each router reveal itself in traceroute?', options: ['A special traceroute flag', 'TTL expiring at that router triggers an ICMP time exceeded message', 'DNS reverse lookups'], answer: 1, why: 'A router that decrements TTL to zero must drop the packet and tell the sender, using its own source address.' },
    ],
  },
  {
    id: 'bgp',
    chapter: 'ip',
    level: 'intermediate',
    title: 'BGP: how the Internet agrees on routes',
    blurb: 'Networks announce what they own; neighbours pass it on, adding themselves to the path.',
    minutes: 5,
    nodes: [
      N('a', 'as', 'AS 64500', 0, 180, 'owns 203.0.113.0/24'),
      N('b', 'as', 'AS 64501', 320, 40, 'transit ISP'),
      N('c', 'as', 'AS 64502', 320, 320, 'transit ISP'),
      N('d', 'as', 'AS 64503', 640, 180, 'your ISP'),
      N('u', 'host', 'You', 900, 180),
    ],
    links: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['b', 'c'], ['d', 'u']],
    steps: [
      {
        say: 'The Internet is ~75,000 independent networks called autonomous systems (AS), each with a number. BGP is the protocol they use to tell each other which addresses they can reach.',
      },
      {
        say: 'AS 64500 owns 203.0.113.0/24 and announces it to its neighbours: “You can reach 203.0.113.0/24 through me. Path: 64500.”',
        msgs: [
          { from: 'a', to: 'b', label: '203.0.113.0/24 [64500]', c: 'teal' },
          { from: 'a', to: 'c', label: '203.0.113.0/24 [64500]', c: 'teal', par: true },
        ],
      },
      {
        say: 'Each neighbour adds its own number to the path and passes it on. Your ISP now hears two routes to the same prefix: via 64501 and via 64502.',
        msgs: [
          { from: 'b', to: 'd', label: '[64501 64500]', c: 'teal' },
          { from: 'c', to: 'd', label: '[64502 64500]', c: 'violet', par: true },
        ],
        tables: { d: { title: 'AS 64503 BGP table', cols: ['Prefix', 'AS path', 'Best'], rows: [['203.0.113.0/24', '64501 64500', '✓'], ['203.0.113.0/24', '64502 64500', '']], fresh: [0, 1] } },
      },
      {
        say: 'It picks one, using policy first (who is paying whom) and shorter AS path as a tiebreak. Your traffic follows that choice.',
        deep: 'BGP best‑path selection: highest local‑pref (policy, e.g. prefer customers over peers over paid transit), shortest AS path, lowest origin, lowest MED, eBGP over iBGP, lowest IGP cost, then tiebreakers. The AS path also prevents loops: a router rejects a route that already contains its own AS number.',
        msgs: [{ from: 'u', to: 'a', label: 'to 203.0.113.9', c: 'blue', via: ['u', 'd', 'b', 'a'] }],
      },
      {
        say: 'If the link to 64501 fails, the route is withdrawn and the ISP switches to the backup path within seconds.',
        msgs: [
          { from: 'b', to: 'd', label: 'WITHDRAW', c: 'red' },
          { from: 'u', to: 'a', label: 'to 203.0.113.9', c: 'blue', via: ['u', 'd', 'c', 'a'] },
        ],
        tables: { d: { title: 'AS 64503 BGP table', cols: ['Prefix', 'AS path', 'Best'], rows: [['203.0.113.0/24', '64502 64500', '✓']], fresh: [0] } },
      },
      {
        say: 'BGP runs on trust. If an AS wrongly announces someone else’s prefix (a “route leak” or “hijack”), traffic can be pulled across the world. RPKI lets owners cryptographically sign which AS may originate their prefixes.',
        deep: 'Famous incidents: Pakistan Telecom hijacking YouTube (2008), Facebook withdrawing its own routes and vanishing for six hours (2021). Anycast, used by CDNs and DNS root servers, is the friendly version: many sites announce the same prefix and BGP sends you to the nearest.',
      },
    ],
    takeaways: [
      'BGP exchanges reachability between autonomous systems.',
      'Routes carry the AS path; policy and path length pick the winner.',
      'Withdrawals reroute traffic; bad announcements can hijack it.',
    ],
    quiz: [
      { q: 'How does BGP avoid routing loops between ASes?', options: ['TTL', 'A router rejects routes whose AS path already contains its own AS', 'Spanning tree'], answer: 1, why: 'The AS path records every AS a route passed through; seeing your own number means a loop.' },
    ],
  },
]

import type { Lesson } from '../types'
import { N } from './helpers'

export const infra: Lesson[] = [
  {
    id: 'cdn',
    chapter: 'infra',
    level: 'beginner',
    title: 'CDNs & caching',
    blurb: 'Put copies of your content near your users, and most requests never cross an ocean.',
    minutes: 4,
    sandbox: 'path',
    nodes: [
      N('u1', 'host', 'User in Mumbai', 0, 40),
      N('u2', 'host', 'User in Delhi', 0, 320),
      N('edge', 'cdn', 'CDN edge (Mumbai)', 330, 180, 'cache'),
      N('origin', 'server', 'Origin (Virginia)', 800, 180, '~200 ms away'),
    ],
    links: [['u1', 'edge', '8 ms'], ['u2', 'edge', '20 ms'], ['edge', 'origin', '200 ms RTT']],
    steps: [
      {
        say: 'Your website lives on an origin server in Virginia. A user in Mumbai is ~200 ms of round trip away, and every request pays it. A CDN puts cache servers in hundreds of cities.',
      },
      {
        say: 'The first user asks for logo.png. The edge does not have it yet (a cache miss), so it fetches it from the origin, stores a copy and returns it.',
        msgs: [
          { from: 'u1', to: 'edge', label: 'GET /logo.png', c: 'blue' },
          { from: 'edge', to: 'origin', label: 'MISS → fetch', c: 'amber' },
          { from: 'origin', to: 'edge', label: 'logo.png (max-age=86400)', c: 'green' },
          { from: 'edge', to: 'u1', label: 'logo.png', c: 'green' },
        ],
        tables: { edge: { title: 'Edge cache', cols: ['Object', 'Expires'], rows: [['/logo.png', '24h']], fresh: [0] } },
      },
      {
        say: 'The next user asks for the same file. Cache hit: answered from Mumbai in a few milliseconds, and the origin never even hears about it.',
        msgs: [
          { from: 'u2', to: 'edge', label: 'GET /logo.png', c: 'blue' },
          { from: 'edge', to: 'u2', label: 'HIT (8 ms)', c: 'green' },
        ],
      },
      {
        say: 'How long can the copy be reused? The origin decides with Cache‑Control headers. When it expires the edge revalidates: “Has this changed?” and gets a tiny 304 Not Modified if not.',
        deep: 'Users are steered to the nearest edge by anycast (one IP announced from every city via BGP) or by GeoDNS. Hit ratio is the key number: at 95% the origin sees 1 in 20 requests. Personalised or POST requests usually cannot be cached, but the edge still helps by terminating TLS close to the user.',
        msgs: [
          { from: 'edge', to: 'origin', label: 'If-None-Match: "abc"', c: 'amber' },
          { from: 'origin', to: 'edge', label: '304 Not Modified', c: 'green' },
        ],
      },
    ],
    takeaways: [
      'CDNs cache content at edges near users: lower latency and less origin load.',
      'Cache‑Control and ETags decide freshness and revalidation.',
      'Hit ratio determines how much traffic reaches your origin.',
    ],
    quiz: [
      { q: 'A CDN has a 90% hit ratio and users send 10,000 req/s. How many reach the origin?', options: ['100/s', '1,000/s', '9,000/s'], answer: 1, why: 'Only misses go to the origin: 10% of 10,000.' },
    ],
  },
  {
    id: 'load-balancing',
    chapter: 'infra',
    level: 'beginner',
    title: 'Load balancing (L4 vs L7)',
    blurb: 'One address in front, many servers behind. Health checks keep traffic away from the sick ones.',
    minutes: 5,
    sandbox: 'scaleout',
    nodes: [
      N('c', 'client', 'Clients', 0, 180),
      N('lb', 'lb', 'Load balancer', 300, 180, 'VIP 203.0.113.10'),
      N('s1', 'server', 'App 1', 640, 20),
      N('s2', 'server', 'App 2', 640, 180),
      N('s3', 'server', 'App 3', 640, 340),
    ],
    links: [['c', 'lb'], ['lb', 's1'], ['lb', 's2'], ['lb', 's3']],
    steps: [
      {
        say: 'Clients connect to one virtual IP. The load balancer picks a healthy backend for each connection or request. Round robin simply takes turns.',
        msgs: [
          { from: 'c', to: 's1', label: 'req 1', c: 'blue' },
          { from: 'c', to: 's2', label: 'req 2', c: 'teal' },
          { from: 'c', to: 's3', label: 'req 3', c: 'violet' },
        ],
        tables: { lb: { title: 'Backend pool', cols: ['Server', 'Health', 'Active'], rows: [['App 1', '✓', '1'], ['App 2', '✓', '1'], ['App 3', '✓', '1']] } },
      },
      {
        say: 'The balancer constantly health‑checks each backend. App 2 stops answering /healthz, so it is pulled out of the pool and receives no new traffic.',
        msgs: [
          { from: 'lb', to: 's2', label: 'GET /healthz', c: 'gray' },
          { from: 's2', to: 'lb', label: 'timeout', c: 'red', drop: true },
          { from: 'c', to: 's1', label: 'req 4', c: 'blue' },
          { from: 'c', to: 's3', label: 'req 5', c: 'violet' },
        ],
        tables: { lb: { title: 'Backend pool', cols: ['Server', 'Health', 'Active'], rows: [['App 1', '✓', '2'], ['App 2', '✗ (drained)', '0'], ['App 3', '✓', '2']], fresh: [1] } },
      },
      {
        say: 'An L4 balancer only looks at IPs and ports. It forwards whole TCP connections without reading them: very fast, protocol‑agnostic, but blind to URLs.',
        deep: 'L4 balancers typically hash the 5‑tuple (or use consistent hashing, like Maglev) so all packets of one connection land on the same backend. With direct server return, replies bypass the balancer entirely.',
        msgs: [{ from: 'c', to: 's1', label: 'TCP :443 (opaque)', c: 'gray', h: { l3: { dst: '203.0.113.10 → 10.0.1.11' }, l4: { dst_port: '443' } } }],
      },
      {
        say: 'An L7 balancer terminates TLS and reads the HTTP request, so it can route /api to one pool and /images to another, retry failed requests, add headers and enforce rate limits. More power, more CPU.',
        msgs: [
          { from: 'c', to: 's1', label: 'GET /api/cart', c: 'blue', h: { l7: { path: '/api/cart → pool "api"' } } },
          { from: 'c', to: 's3', label: 'GET /images/1.jpg', c: 'pink', h: { l7: { path: '/images → pool "static"' } } },
        ],
      },
      {
        say: 'Smarter algorithms beat round robin when requests differ in cost: least connections, least response time, or “power of two choices” (pick two at random, use the less busy one).',
        deep: 'Sticky sessions pin a user to a backend (via cookie or IP hash) at the cost of uneven load. Prefer stateless backends with shared session stores so any server can serve anyone.',
      },
    ],
    takeaways: [
      'A load balancer spreads load and hides failures behind one address.',
      'Health checks remove unhealthy backends automatically.',
      'L4 = fast, per‑connection, blind to content. L7 = HTTP‑aware routing, retries, TLS termination.',
    ],
    quiz: [
      { q: 'You want /api and /static to go to different server pools. What do you need?', options: ['An L4 load balancer', 'An L7 load balancer', 'DNS round robin'], answer: 1, why: 'Only an L7 balancer reads the HTTP path.' },
    ],
  },
  {
    id: 'firewalls',
    chapter: 'infra',
    level: 'beginner',
    title: 'Firewalls & DDoS',
    blurb: 'Rules that decide which packets may pass, and what happens when a million bots knock at once.',
    minutes: 4,
    sandbox: 'ddos',
    nodes: [
      N('u', 'client', 'Real user', 0, 40),
      N('bot', 'botnet', 'Botnet', 0, 320),
      N('fw', 'firewall', 'Firewall', 330, 180),
      N('web', 'server', 'Web server', 660, 80, ':443'),
      N('db', 'database', 'Database', 660, 300, ':5432'),
    ],
    links: [['u', 'fw'], ['bot', 'fw'], ['fw', 'web'], ['fw', 'db'], ['web', 'db']],
    steps: [
      {
        say: 'A firewall checks each packet against a list of rules, top to bottom, and the first match decides: allow or deny. The last rule is usually “deny everything else”.',
        tables: { fw: { title: 'Rules', cols: ['#', 'Match', 'Action'], rows: [['1', 'tcp dst 443 → web', 'ALLOW'], ['2', 'tcp dst 5432 from web', 'ALLOW'], ['3', 'any', 'DENY']] } },
      },
      {
        say: 'HTTPS to the web server matches rule 1 and passes.',
        msgs: [{ from: 'u', to: 'web', label: 'tcp :443', c: 'blue' }],
        tables: { fw: { title: 'Rules', cols: ['#', 'Match', 'Action'], rows: [['1', 'tcp dst 443 → web', 'ALLOW'], ['2', 'tcp dst 5432 from web', 'ALLOW'], ['3', 'any', 'DENY']], fresh: [0] } },
      },
      {
        say: 'Someone on the Internet tries to reach the database directly on port 5432. Rule 2 only allows that from the web server, so rule 3 drops it.',
        msgs: [{ from: 'u', to: 'db', label: 'tcp :5432', c: 'red', via: ['u', 'fw'], drop: true }],
        tables: { fw: { title: 'Rules', cols: ['#', 'Match', 'Action'], rows: [['1', 'tcp dst 443 → web', 'ALLOW'], ['2', 'tcp dst 5432 from web', 'ALLOW'], ['3', 'any', 'DENY']], fresh: [2] } },
      },
      {
        say: 'Stateful firewalls remember connections. Once a connection is allowed out, its replies are let back in automatically, without needing a rule for every return packet.',
        deep: 'Cloud “security groups” are stateful firewalls attached to each instance. Network ACLs are often stateless and need explicit return rules. A WAF (web application firewall) works at L7 and blocks things like SQL injection patterns.',
      },
      {
        say: 'A DDoS attack sends so much traffic from so many machines that the target runs out of bandwidth, connections or CPU. Real users get stuck in the same queue as the junk.',
        msgs: [
          { from: 'bot', to: 'fw', label: 'flood', c: 'red', burst: 6 },
          { from: 'u', to: 'fw', label: 'real request', c: 'blue', par: true },
        ],
        note: { x: 160, y: 420, text: 'try the DDoS scenario in the sandbox →' },
      },
      {
        say: 'Defences stack up: absorb it with a huge anycast network (CDN scrubbing), filter known‑bad patterns at the edge, rate‑limit per IP, and use SYN cookies so half‑open connections cost nothing.',
        deep: 'Volumetric attacks (UDP floods, DNS/NTP amplification) target bandwidth and must be stopped upstream; you cannot filter a 1 Tb/s flood on a 10 Gb/s link. Protocol attacks (SYN floods) target state tables. Application attacks (HTTP floods) look like real users and need L7 analysis.',
      },
    ],
    takeaways: [
      'Firewalls apply ordered allow/deny rules; default deny is the safe baseline.',
      'Stateful firewalls track connections so replies flow back automatically.',
      'DDoS defence is layered: absorb, filter, rate‑limit, and keep state cheap.',
    ],
    quiz: [
      { q: 'Why can’t a firewall on your 10 Gb/s uplink stop a 500 Gb/s flood?', options: ['Firewalls cannot block UDP', 'The link is already full before packets reach the firewall', 'It can'], answer: 1, why: 'Volumetric floods saturate the pipe upstream of you; they must be absorbed or filtered by a bigger network.' },
    ],
  },
  {
    id: 'vpn',
    chapter: 'infra',
    level: 'intermediate',
    title: 'Tunnels & VPNs',
    blurb: 'Put a packet inside another packet, encrypt it, and two distant networks act like one.',
    minutes: 4,
    nodes: [
      N('lap', 'host', 'Remote laptop', 0, 180, '10.8.0.6 (tunnel)'),
      N('i', 'internet', 'Internet', 330, 180),
      N('gw', 'vpn', 'VPN gateway', 660, 180, '198.51.100.4'),
      N('wiki', 'server', 'Internal wiki', 960, 180, '10.20.0.15'),
    ],
    links: [['lap', 'i', 'coffee shop Wi‑Fi'], ['i', 'gw'], ['gw', 'wiki', 'office LAN']],
    steps: [
      {
        say: 'The internal wiki has a private address, 10.20.0.15, that is not reachable from the Internet. A VPN lets your laptop behave as if it were plugged into the office network.',
      },
      {
        say: 'The laptop builds a normal packet to 10.20.0.15, then encrypts the whole thing and wraps it in a new packet addressed to the VPN gateway’s public IP. The coffee shop only sees encrypted UDP to 198.51.100.4.',
        msgs: [{
          from: 'lap', to: 'gw', label: '🔒 outer → 198.51.100.4', c: 'amber',
          h: { l3: { outer_src: 'café public IP', outer_dst: '198.51.100.4' }, l4: { proto: 'UDP', dst_port: '51820 (WireGuard)' }, x: { inner: '🔒 IP 10.8.0.6 → 10.20.0.15 | TCP 443 | GET /wiki' } },
        }],
      },
      {
        say: 'The gateway strips the outer header, decrypts, and forwards the original inner packet onto the office LAN. To the wiki it looks like an ordinary local request.',
        msgs: [{ from: 'gw', to: 'wiki', label: 'inner: 10.8.0.6 → 10.20.0.15', c: 'blue' }, { from: 'wiki', to: 'lap', label: 'reply (re‑wrapped)', c: 'green' }],
      },
      {
        say: 'Encapsulation costs bytes: each packet carries an extra IP + UDP + VPN header (~60 bytes). Big packets no longer fit in 1,500 bytes, so the tunnel MTU is smaller and misconfigured MTU is a classic “some sites hang” bug.',
        deep: 'The same idea powers VXLAN and Geneve in data centres (Layer 2 networks tunnelled over Layer 3), GRE, IPsec site‑to‑site links, and Kubernetes overlay networks. WireGuard and IPsec encrypt; VXLAN does not.',
      },
    ],
    takeaways: [
      'A tunnel encapsulates one packet inside another.',
      'VPNs add encryption so the path in between cannot read or alter traffic.',
      'Overhead shrinks the effective MTU, a common source of bugs.',
    ],
    quiz: [
      { q: 'What does the coffee shop network see of your VPN traffic?', options: ['The wiki URLs you visit', 'Encrypted UDP packets going to the VPN gateway', 'Nothing at all'], answer: 1, why: 'The outer header must be readable to be routed; everything inside is encrypted.' },
    ],
  },
  {
    id: 'datacenter',
    chapter: 'infra',
    level: 'intermediate',
    title: 'Data‑centre fabrics: leaf‑spine',
    blurb: 'Every rack is exactly two hops from every other, with many equal paths between them.',
    minutes: 5,
    nodes: [
      N('sp1', 'router', 'Spine 1', 220, 0),
      N('sp2', 'router', 'Spine 2', 520, 0),
      N('l1', 'switch', 'Leaf 1', 0, 220),
      N('l2', 'switch', 'Leaf 2', 250, 220),
      N('l3', 'switch', 'Leaf 3', 500, 220),
      N('l4', 'switch', 'Leaf 4', 750, 220),
      N('h1', 'server', 'Rack A', 0, 400),
      N('h4', 'server', 'Rack D', 750, 400),
      N('h2', 'server', 'Rack B', 250, 400),
      N('h3', 'server', 'Rack C', 500, 400),
    ],
    links: [
      ['sp1', 'l1'], ['sp1', 'l2'], ['sp1', 'l3'], ['sp1', 'l4'],
      ['sp2', 'l1'], ['sp2', 'l2'], ['sp2', 'l3'], ['sp2', 'l4'],
      ['l1', 'h1'], ['l2', 'h2'], ['l3', 'h3'], ['l4', 'h4'],
    ],
    steps: [
      {
        say: 'Old data centres were trees: access → aggregation → core, with traffic squeezing through the top. Modern ones use a leaf‑spine (Clos) design: every leaf (top‑of‑rack switch) connects to every spine.',
      },
      {
        say: 'Any server reaches any other in the same number of hops: leaf → spine → leaf. Latency is predictable no matter which racks talk.',
        msgs: [{ from: 'h1', to: 'h4', label: 'A → D', c: 'blue', via: ['h1', 'l1', 'sp1', 'l4', 'h4'] }],
      },
      {
        say: 'There are as many equal paths as there are spines. Leaves hash each flow’s 5‑tuple to pick one (ECMP), so traffic spreads across the whole fabric.',
        deep: 'Hashing per flow keeps a flow’s packets in order, but two big “elephant” flows can collide on one spine while another sits idle. That matters a lot for AI training traffic, which is a few huge, synchronised flows; next chapter.',
        msgs: [
          { from: 'h1', to: 'h4', label: 'flow 1', c: 'blue', via: ['h1', 'l1', 'sp1', 'l4', 'h4'] },
          { from: 'h2', to: 'h3', label: 'flow 2', c: 'violet', via: ['h2', 'l2', 'sp2', 'l3', 'h3'], par: true },
          { from: 'h1', to: 'h3', label: 'flow 3', c: 'teal', via: ['h1', 'l1', 'sp2', 'l3', 'h3'], par: true },
        ],
      },
      {
        say: 'If a spine fails, the leaves just stop using it. You lose a fraction of capacity, not connectivity. Need more bandwidth? Add spines. More racks? Add leaves.',
        msgs: [
          { from: 'h2', to: 'h4', label: 'rerouted', c: 'blue', via: ['h2', 'l2', 'sp2', 'l4', 'h4'] },
        ],
        note: { x: 150, y: -70, text: 'spine 1 down → everything uses spine 2' },
      },
      {
        say: 'Oversubscription is the ratio of server‑facing to spine‑facing bandwidth on a leaf. 3:1 is common for web workloads. AI clusters build 1:1 (non‑blocking) fabrics because every GPU may talk at full rate at the same moment.',
        deep: 'Hyperscalers run BGP or a custom routing protocol on every switch (Layer 3 all the way to the rack) and use VXLAN overlays for tenant networks. Three‑tier Clos (leaf, spine, super‑spine) scales to tens of thousands of servers.',
      },
    ],
    takeaways: [
      'Leaf‑spine: every leaf links to every spine; any‑to‑any is two switch hops.',
      'ECMP hashes flows across equal paths for bandwidth and resilience.',
      'Oversubscription trades cost for contention; AI fabrics aim for 1:1.',
    ],
    quiz: [
      { q: 'A leaf‑spine fabric has 4 spines. How many equal‑cost paths are there between two servers on different leaves?', options: ['1', '2', '4', '16'], answer: 2, why: 'One path through each spine.' },
    ],
  },
]

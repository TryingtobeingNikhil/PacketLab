import type { Lesson } from '../types'
import { MAC, N } from './helpers'

export const foundations: Lesson[] = [
  {
    id: 'what-is-a-network',
    chapter: 'start',
    level: 'beginner',
    title: 'What is a network?',
    blurb: 'Messages get chopped into packets, and each packet finds its own way.',
    minutes: 3,
    nodes: [
      N('you', 'host', 'Your laptop', 0, 160, '192.168.1.20'),
      N('home', 'router', 'Home router', 220, 160),
      N('ispA', 'router', 'ISP router A', 460, 40),
      N('ispB', 'router', 'ISP router B', 460, 280),
      N('core', 'router', 'Backbone', 700, 160),
      N('srv', 'server', 'Video server', 920, 160, '203.0.113.7'),
    ],
    links: [['you', 'home', 'Wi‑Fi'], ['home', 'ispA'], ['home', 'ispB'], ['ispA', 'core'], ['ispB', 'core'], ['core', 'srv']],
    steps: [
      {
        say: 'A network is computers joined together so they can send each other messages. The Internet is millions of networks joined together. Here your laptop wants a video from a server far away.',
        focus: ['you', 'srv'],
      },
      {
        say: 'Your request does not travel as one big blob. It is chopped into small pieces called packets, each up to about 1,500 bytes. Every packet carries a label saying where it is from and where it is going.',
        deep: 'The 1,500 byte limit is the Ethernet MTU (maximum transmission unit). Anything larger is split up by TCP before it leaves your machine, so routers rarely have to fragment.',
        msgs: [
          { from: 'you', to: 'home', label: 'pkt 1', c: 'blue', h: { l3: { src: '192.168.1.20', dst: '203.0.113.7', TTL: '64' }, l7: { data: 'GET /video … (part 1 of 4)' } } },
        ],
        focus: ['you'],
      },
      {
        say: 'Routers pass each packet to a neighbour that is closer to the destination. Two packets from the same message can take different roads. Nobody reserved a path for you: this is called packet switching.',
        deep: 'The old phone network used circuit switching: a call reserved a fixed path end‑to‑end for its whole duration. Packet switching shares every link between everyone, which is far cheaper but means you can be queued behind other people’s packets.',
        msgs: [
          { from: 'you', to: 'srv', label: 'pkt 1', c: 'blue', via: ['you', 'home', 'ispA', 'core', 'srv'] },
          { from: 'you', to: 'srv', label: 'pkt 2', c: 'teal', via: ['you', 'home', 'ispB', 'core', 'srv'], par: true },
          { from: 'you', to: 'srv', label: 'pkt 3', c: 'violet', via: ['you', 'home', 'ispA', 'core', 'srv'], par: true },
          { from: 'you', to: 'srv', label: 'pkt 4', c: 'amber', via: ['you', 'home', 'ispB', 'core', 'srv'], par: true },
        ],
      },
      {
        say: 'Packets can arrive out of order, or not at all. The server puts them back together using sequence numbers, and asks again for any that went missing. That reliability job belongs to TCP, which you will meet later.',
        msgs: [
          { from: 'srv', to: 'you', label: 'video data', c: 'green', burst: 3 },
        ],
        focus: ['srv', 'you'],
      },
      {
        say: 'If one router breaks, the others simply route around it. That resilience was a design goal from the very beginning of the Internet.',
        msgs: [
          { from: 'you', to: 'srv', label: 'pkt 5', c: 'blue', via: ['you', 'home', 'ispA'], drop: true },
          { from: 'you', to: 'srv', label: 'pkt 5 (again)', c: 'blue', via: ['you', 'home', 'ispB', 'core', 'srv'] },
        ],
        note: { x: 400, y: 380, text: 'router A is down → traffic flows via B' },
      },
    ],
    takeaways: [
      'Data travels as small, independently addressed packets.',
      'Routers forward packets hop by hop; paths can differ per packet.',
      'Links are shared, so packets can be delayed, reordered or lost.',
    ],
    quiz: [
      { q: 'Why does the Internet use packet switching instead of reserving a path per conversation?', options: ['It is more secure', 'Links are shared efficiently and failures can be routed around', 'Packets are always delivered in order'], answer: 1, why: 'Reserving a path wastes capacity when you are idle. Sharing links between everyone is far cheaper, and independent packets can take another route when a link fails.' },
    ],
  },
  {
    id: 'layers',
    chapter: 'start',
    level: 'beginner',
    title: 'Layers & encapsulation',
    blurb: 'Every packet is an envelope inside an envelope inside an envelope.',
    minutes: 4,
    widget: 'osi',
    nodes: [
      N('a', 'host', 'Your laptop', 0, 160, '10.0.0.5'),
      N('sw', 'switch', 'Switch', 260, 160, 'reads L2'),
      N('r', 'router', 'Router', 520, 160, 'reads L3'),
      N('s', 'server', 'Web server', 800, 160, '93.184.216.34'),
    ],
    links: [['a', 'sw'], ['sw', 'r'], ['r', 's', 'Internet']],
    steps: [
      {
        say: 'Networking is split into layers. Each layer solves one problem and trusts the layer below it for the rest. Your browser only cares about the web page; it never thinks about cables.',
        deep: 'The textbook OSI model has 7 layers; the Internet actually runs on the 4‑layer TCP/IP model. People still say “Layer 2” for Ethernet, “Layer 3” for IP, “Layer 4” for TCP/UDP and “Layer 7” for applications.',
        focus: ['a'],
      },
      {
        say: 'Layer 7, application: the browser writes an HTTP request. This is the letter you actually want delivered.',
        msgs: [{ from: 'a', to: 'a', label: 'HTTP GET /', c: 'violet', h: { l7: { method: 'GET', path: '/', host: 'example.com' } } }],
        focus: ['a'],
      },
      {
        say: 'Layer 4, transport: TCP wraps it and adds port numbers (which app it is for) and a sequence number (so it can be reassembled and retransmitted).',
        msgs: [{ from: 'a', to: 'a', label: 'TCP | HTTP', c: 'blue', h: { l4: { src_port: '51544', dst_port: '443', seq: '1001', flags: 'PSH,ACK' }, l7: { method: 'GET', path: '/' } } }],
      },
      {
        say: 'Layer 3, network: IP wraps that and adds the source and destination IP address. This is the address that gets you across the world.',
        msgs: [{ from: 'a', to: 'a', label: 'IP | TCP | HTTP', c: 'teal', h: { l3: { src: '10.0.0.5', dst: '93.184.216.34', TTL: '64', proto: 'TCP' }, l4: { src_port: '51544', dst_port: '443' }, l7: { method: 'GET' } } }],
      },
      {
        say: 'Layer 2, link: Ethernet wraps everything one last time with MAC addresses: the address of the very next device on this wire, not the final server.',
        msgs: [{
          from: 'a', to: 'sw', label: 'ETH | IP | TCP | HTTP', c: 'amber',
          h: { l2: { src_mac: MAC.a, dst_mac: MAC.r, type: 'IPv4' }, l3: { src: '10.0.0.5', dst: '93.184.216.34', TTL: '64' }, l4: { src_port: '51544', dst_port: '443' }, l7: { method: 'GET', path: '/' } },
        }],
      },
      {
        say: 'The switch only opens the outer envelope (Layer 2) to see which port to use. The router opens one more (Layer 3), picks the next hop, decrements TTL, and puts on a brand new Ethernet envelope for the next link.',
        deep: 'The IP addresses stay the same end to end (ignoring NAT); the MAC addresses are rewritten at every router hop. TTL drops by one per router so a looping packet eventually dies.',
        msgs: [
          { from: 'sw', to: 'r', label: 'ETH | IP | …', c: 'amber' },
          { from: 'r', to: 's', label: 'new ETH | IP | …', c: 'teal', h: { l2: { src_mac: 'router-wan', dst_mac: 'next-hop' }, l3: { src: '10.0.0.5 → (NAT)', dst: '93.184.216.34', TTL: '63' } } },
        ],
        focus: ['sw', 'r'],
      },
      {
        say: 'The server unwraps the envelopes in reverse: Ethernet, then IP, then TCP, and finally hands the HTTP request to the web server program listening on port 443.',
        msgs: [{ from: 's', to: 's', label: 'HTTP GET /', c: 'violet' }],
        focus: ['s'],
      },
    ],
    takeaways: [
      'Each layer adds its own header around the data from the layer above (encapsulation).',
      'L2 (MAC) addresses change every hop; L3 (IP) addresses stay end to end.',
      'Devices only look as deep as they need: switches L2, routers L3, load balancers L4 or L7.',
    ],
    quiz: [
      { q: 'A packet crosses three routers. How many times are its MAC addresses rewritten?', options: ['Never', 'Once, at the first router', 'At every router hop'], answer: 2, why: 'MAC addresses are only meaningful on one link, so each router builds a fresh Ethernet header for the next link.' },
      { q: 'Which header carries the port number?', options: ['Ethernet (L2)', 'IP (L3)', 'TCP/UDP (L4)'], answer: 2, why: 'Ports identify the application on a host, which is the transport layer’s job.' },
    ],
  },
  {
    id: 'latency-bandwidth',
    chapter: 'start',
    level: 'beginner',
    title: 'Latency vs bandwidth',
    blurb: 'How long the road is vs how many lanes it has. They are not the same thing.',
    minutes: 4,
    widget: 'latency',
    sandbox: 'path',
    nodes: [
      N('ny', 'host', 'New York', 0, 160),
      N('r1', 'router', 'NY router', 260, 160),
      N('r2', 'router', 'London router', 640, 160),
      N('ld', 'server', 'London', 900, 160),
    ],
    links: [['ny', 'r1', '10 Gb/s'], ['r1', 'r2', 'subsea fibre · 5,570 km'], ['r2', 'ld', '10 Gb/s']],
    steps: [
      {
        say: 'Latency is how long one bit takes to get there. Bandwidth is how many bits you can push per second. A highway can be very wide and still very long.',
        focus: ['ny', 'ld'],
      },
      {
        say: 'Light in fibre travels about 200,000 km per second, two thirds of its speed in a vacuum. New York to London is about 5,570 km, so the very best one‑way trip is about 28 ms, and a round trip about 56 ms. No upgrade can beat physics.',
        deep: 'Real routes are longer than the great‑circle distance and add queuing and processing at each hop, so ~70 ms RTT is typical. This is why companies put servers in many regions.',
        msgs: [{ from: 'ny', to: 'ld', label: 'ping', c: 'blue' }, { from: 'ld', to: 'ny', label: 'pong', c: 'green' }],
        note: { x: 360, y: 60, text: '≈ 56 ms round trip, minimum' },
      },
      {
        say: 'Bandwidth decides how long a big transfer takes after the first bit arrives. A 1 GB file over 10 Gb/s needs 0.8 seconds of sending time, no matter how close the server is.',
        msgs: [{ from: 'ld', to: 'ny', label: '1 GB file', c: 'violet', burst: 6 }],
      },
      {
        say: 'Small requests (web pages, API calls, chat messages) are latency‑bound: they are done before bandwidth matters. Big ones (video, backups, model weights) are bandwidth‑bound.',
        deep: 'Transfer time ≈ RTT × round trips needed + size ÷ bandwidth. For a 10 KB API call the first term dominates; for a 100 GB checkpoint the second does.',
        msgs: [{ from: 'ny', to: 'ld', label: 'tiny API call', c: 'teal' }, { from: 'ld', to: 'ny', label: '200 OK', c: 'green' }],
      },
      {
        say: 'Throughput is what you actually get, and it is usually less than the bandwidth: other traffic shares the link, and protocols like TCP ramp up slowly. Try the latency numbers on the right to build an intuition.',
      },
    ],
    takeaways: [
      'Latency = delay of a single bit. Bandwidth = capacity per second. Throughput = what you really get.',
      'Distance sets a hard floor on latency (~1 ms per 100 km round trip in fibre).',
      'Small messages are latency‑bound; bulk transfers are bandwidth‑bound.',
    ],
    quiz: [
      { q: 'You upgrade from 100 Mb/s to 1 Gb/s. Which gets noticeably faster?', options: ['Loading a tiny JSON API response from another continent', 'Downloading a 5 GB game', 'Both equally'], answer: 1, why: 'The tiny request is dominated by round‑trip time, which bandwidth does not change. The big download is limited by bandwidth.' },
    ],
  },
]

import type { Lesson } from '../types'
import { MAC, N } from './helpers'

const macTable = (rows: string[][], fresh?: number[]) => ({ title: 'MAC address table', cols: ['MAC', 'Port'], rows, fresh })

export const local: Lesson[] = [
  {
    id: 'switching',
    chapter: 'local',
    level: 'beginner',
    title: 'Ethernet & switches',
    blurb: 'How a switch learns who is plugged in where, by watching traffic.',
    minutes: 4,
    nodes: [
      N('a', 'host', 'Host A', 0, 40, 'aa:…:0a'),
      N('b', 'host', 'Host B', 0, 300, 'bb:…:0b'),
      N('sw', 'switch', 'Switch', 360, 170, '4 ports'),
      N('c', 'host', 'Host C', 720, 40, 'cc:…:0c'),
      N('d', 'host', 'Host D', 720, 300, 'dd:…:0d'),
    ],
    links: [['a', 'sw', 'port 1'], ['b', 'sw', 'port 2'], ['sw', 'c', 'port 3'], ['sw', 'd', 'port 4']],
    steps: [
      {
        say: 'Every network card has a MAC address burned in at the factory, like a serial number. Inside one local network, Ethernet frames are delivered by MAC address. A switch connects the devices.',
        tables: { sw: macTable([]) },
      },
      {
        say: 'Host A sends a frame to Host C. The switch notes that A lives on port 1 (it learns from the source address) but it has no idea where C is yet.',
        msgs: [{ from: 'a', to: 'sw', label: 'to C', why: 'A sends a frame to C. The switch writes down that A lives on port 1.', c: 'blue', h: { l2: { src_mac: MAC.a, dst_mac: MAC.c, type: 'IPv4' } } }],
        tables: { sw: macTable([[MAC.a, '1']], [0]) },
      },
      {
        say: 'Unknown destination? The switch floods the frame out of every other port. B and D see it, notice it is not for them, and quietly throw it away.',
        msgs: [
          { from: 'sw', to: 'b', label: 'flood', why: "The switch doesn't know where C is yet, so it copies the frame to every other port.", c: 'gray' },
          { from: 'sw', to: 'c', label: 'flood', c: 'blue', par: true },
          { from: 'sw', to: 'd', label: 'flood', c: 'gray', par: true },
        ],
        tables: { sw: macTable([[MAC.a, '1']]) },
      },
      {
        say: 'C replies. Now the switch learns C is on port 3, and it already knows A is on port 1, so the reply goes out of exactly one port.',
        msgs: [{ from: 'c', to: 'a', label: 'reply to A', why: 'C replies. Now the switch learns C is on port 3, and sends the reply out of port 1 only.', c: 'green', h: { l2: { src_mac: MAC.c, dst_mac: MAC.a } } }],
        tables: { sw: macTable([[MAC.a, '1'], [MAC.c, '3']], [1]) },
      },
      {
        say: 'From now on A and C talk privately. Only traffic to unknown or broadcast addresses is flooded. That is the whole trick: learn from sources, forward by destinations.',
        deep: 'Entries age out after ~5 minutes so moved devices are relearned. Attackers can flood a switch with fake source MACs to overflow this table (MAC flooding), turning it back into a hub that floods everything.',
        msgs: [{ from: 'a', to: 'c', label: 'to C', c: 'blue' }, { from: 'c', to: 'a', label: 'to A', c: 'green' }],
        tables: { sw: macTable([[MAC.a, '1'], [MAC.c, '3']]) },
      },
    ],
    takeaways: [
      'Switches work at Layer 2 and forward frames by MAC address.',
      'They learn MAC→port mappings from the source address of every frame.',
      'Unknown and broadcast destinations are flooded to all ports.',
    ],
    quiz: [
      { q: 'A switch has just been powered on. A sends a frame to D. What does the switch do?', options: ['Drops it', 'Sends it only to D', 'Floods it out of every port except A’s'], answer: 2, why: 'The MAC table is empty, so the switch cannot know D’s port yet. It floods, and learns D’s port when D replies.' },
    ],
  },
  {
    id: 'arp',
    chapter: 'local',
    level: 'beginner',
    title: 'ARP: from IP to MAC',
    blurb: 'You know the IP address. Ethernet needs a MAC address. ARP asks the room.',
    minutes: 3,
    nodes: [
      N('a', 'host', 'Host A', 0, 60, '10.0.0.5'),
      N('sw', 'switch', 'Switch', 340, 170),
      N('b', 'host', 'Host B', 680, 40, '10.0.0.9'),
      N('c', 'host', 'Host C', 680, 300, '10.0.0.12'),
      N('gw', 'router', 'Gateway', 0, 300, '10.0.0.1'),
    ],
    links: [['a', 'sw'], ['sw', 'b'], ['sw', 'c'], ['gw', 'sw']],
    steps: [
      {
        say: 'Host A wants to send a packet to 10.0.0.9. It knows the IP address, but to build the Ethernet frame it needs B’s MAC address. Its ARP cache is empty.',
        tables: { a: { title: 'A’s ARP cache', cols: ['IP', 'MAC'], rows: [] } },
        focus: ['a'],
      },
      {
        say: 'A shouts to everyone on the local network: “Who has 10.0.0.9? Tell 10.0.0.5.” The destination MAC is ff:ff:ff:ff:ff:ff, the broadcast address, so the switch floods it everywhere.',
        msgs: [
          { from: 'a', to: 'sw', label: 'Who has 10.0.0.9?', why: 'A shouts to everyone: “Who has 10.0.0.9?” It knows the IP address but not the MAC address.', c: 'amber', h: { l2: { src_mac: MAC.a, dst_mac: MAC.bc, type: 'ARP' }, x: { op: 'request', target_ip: '10.0.0.9', sender_ip: '10.0.0.5' } } },
          { from: 'sw', to: 'b', label: 'broadcast', c: 'amber' },
          { from: 'sw', to: 'c', label: 'broadcast', c: 'amber', par: true },
          { from: 'sw', to: 'gw', label: 'broadcast', c: 'amber', par: true },
        ],
      },
      {
        say: 'Only B owns that address, so only B answers, directly to A: “10.0.0.9 is at bb:bb:bb:00:00:0b.”',
        msgs: [{ from: 'b', to: 'a', label: '10.0.0.9 is at bb:…:0b', why: 'Only B owns that address, so only B answers, straight back to A.', c: 'green', h: { l2: { src_mac: MAC.b, dst_mac: MAC.a, type: 'ARP' }, x: { op: 'reply', sender_ip: '10.0.0.9', sender_mac: MAC.b } } }],
        tables: { a: { title: 'A’s ARP cache', cols: ['IP', 'MAC'], rows: [['10.0.0.9', MAC.b]], fresh: [0] } },
      },
      {
        say: 'A caches the answer and finally sends the real packet. Next time, no shouting needed.',
        msgs: [{ from: 'a', to: 'b', label: 'IP packet', why: "Now A knows B's MAC address and can send the real packet directly.", c: 'blue', h: { l2: { src_mac: MAC.a, dst_mac: MAC.b }, l3: { src: '10.0.0.5', dst: '10.0.0.9' } } }],
        tables: { a: { title: 'A’s ARP cache', cols: ['IP', 'MAC'], rows: [['10.0.0.9', MAC.b]] } },
      },
      {
        say: 'What if A wants 8.8.8.8, which is not on this network? A checks its subnet, sees it is outside, and ARPs for the gateway (router) instead. The frame goes to the router’s MAC with 8.8.8.8 still in the IP header.',
        deep: 'ARP has no authentication: any host can reply “I am the gateway”. That is ARP spoofing, the classic way to sit in the middle of a LAN. IPv6 replaces ARP with Neighbor Discovery (NDP), which has the same weakness unless you add SEND or switch protections like Dynamic ARP Inspection.',
        msgs: [
          { from: 'a', to: 'gw', label: 'Who has 10.0.0.1?', c: 'amber', via: ['a', 'sw', 'gw'] },
          { from: 'gw', to: 'a', label: '10.0.0.1 is at 00:…:01', c: 'green' },
          { from: 'a', to: 'gw', label: 'dst IP 8.8.8.8', c: 'blue', h: { l2: { src_mac: MAC.a, dst_mac: MAC.r }, l3: { src: '10.0.0.5', dst: '8.8.8.8' } } },
        ],
        tables: { a: { title: 'A’s ARP cache', cols: ['IP', 'MAC'], rows: [['10.0.0.9', MAC.b], ['10.0.0.1', MAC.r]], fresh: [1] } },
      },
    ],
    takeaways: [
      'ARP maps an IP address to a MAC address on the local network.',
      'Requests are broadcast; replies are unicast; answers are cached.',
      'For off‑network destinations you ARP for the default gateway, not the far host.',
    ],
    quiz: [
      { q: 'Host A sends a packet to 1.1.1.1 on the Internet. Whose MAC address goes in the Ethernet destination field?', options: ['1.1.1.1’s MAC', 'The default gateway’s MAC', 'The broadcast MAC'], answer: 1, why: 'MAC addresses only matter on the local link. The next hop is the gateway, so the frame is addressed to it.' },
    ],
  },
  {
    id: 'dhcp',
    chapter: 'local',
    level: 'beginner',
    title: 'DHCP: getting an address',
    blurb: 'Discover, Offer, Request, Acknowledge. Four messages and you are online.',
    minutes: 3,
    nodes: [
      N('new', 'host', 'New laptop', 0, 160, 'no IP yet'),
      N('sw', 'switch', 'Switch', 340, 160),
      N('dhcp', 'server', 'DHCP server', 680, 40, '192.168.1.1'),
      N('p', 'host', 'Printer', 680, 300, '192.168.1.40'),
    ],
    links: [['new', 'sw'], ['sw', 'dhcp'], ['sw', 'p']],
    steps: [
      {
        say: 'A laptop joins the Wi‑Fi or plugs in a cable. It has a MAC address but no IP address, and it does not even know who to ask. DHCP solves this in four steps, nicknamed DORA.',
        focus: ['new'],
        tables: { dhcp: { title: 'Leases', cols: ['IP', 'MAC', 'Expires'], rows: [['192.168.1.40', 'printer', '23h']] } },
      },
      {
        say: 'D — Discover. The laptop broadcasts: “Is there a DHCP server out there?” Its source IP is 0.0.0.0 because it has none.',
        msgs: [
          { from: 'new', to: 'sw', label: 'DISCOVER', why: 'The new laptop has no address yet, so it shouts: “Is there a DHCP server here?”', c: 'amber', h: { l2: { dst_mac: MAC.bc }, l3: { src: '0.0.0.0', dst: '255.255.255.255' }, l4: { proto: 'UDP', src_port: '68', dst_port: '67' } } },
          { from: 'sw', to: 'dhcp', label: 'DISCOVER', c: 'amber' },
          { from: 'sw', to: 'p', label: 'DISCOVER', c: 'gray', par: true },
        ],
      },
      {
        say: 'O — Offer. The server picks a free address and offers it, along with the subnet mask, the gateway and the DNS servers to use.',
        msgs: [{ from: 'dhcp', to: 'new', label: 'OFFER 192.168.1.57', why: 'The server offers a free address, plus the gateway and DNS server to use.', c: 'green', h: { x: { your_ip: '192.168.1.57', mask: '255.255.255.0', router: '192.168.1.1', dns: '192.168.1.1', lease: '24h' } } }],
      },
      {
        say: 'R — Request. The laptop says “Yes please, I will take 192.168.1.57.” It broadcasts this so any other DHCP servers that also made offers know they were not picked.',
        msgs: [{ from: 'new', to: 'dhcp', label: 'REQUEST .57', why: "The laptop accepts: “I'll take 192.168.1.57, please.”", c: 'blue' }],
      },
      {
        say: 'A — Acknowledge. The server confirms and records the lease. The laptop configures its address, gateway and DNS, and it is online.',
        deep: 'Leases expire, so clients renew at 50% of the lease time by unicasting to the server. In large networks a router acts as a DHCP relay (ip helper) to forward broadcasts to a central server on a different subnet.',
        msgs: [{ from: 'dhcp', to: 'new', label: 'ACK', why: 'The server confirms and records the lease. The laptop is online.', c: 'green' }],
        tables: { dhcp: { title: 'Leases', cols: ['IP', 'MAC', 'Expires'], rows: [['192.168.1.40', 'printer', '23h'], ['192.168.1.57', 'laptop', '24h']], fresh: [1] } },
      },
    ],
    takeaways: [
      'DHCP hands out IP address, subnet mask, default gateway and DNS server.',
      'DORA: Discover (broadcast), Offer, Request, Acknowledge.',
      'Addresses are leased for a time and renewed.',
    ],
    quiz: [
      { q: 'Why is the DHCP Discover a broadcast?', options: ['To be faster', 'The client has no IP and does not know the server’s address', 'Broadcasts are encrypted'], answer: 1, why: 'With no address and no idea who the server is, the only way to reach it is to shout to everyone on the local network.' },
    ],
  },
  {
    id: 'vlans',
    chapter: 'local',
    level: 'intermediate',
    title: 'VLANs & trunks',
    blurb: 'One physical switch, several separate networks.',
    minutes: 4,
    nodes: [
      N('e1', 'host', 'Eng laptop', 0, 40, 'VLAN 10'),
      N('g1', 'host', 'Guest phone', 0, 300, 'VLAN 20'),
      N('sw', 'switch', 'Access switch', 330, 170),
      N('e2', 'host', 'Eng server', 660, 40, 'VLAN 10'),
      N('g2', 'host', 'Guest tablet', 660, 300, 'VLAN 20'),
      N('r', 'router', 'Router', 330, -60, 'router on a stick'),
    ],
    links: [['e1', 'sw', 'access 10'], ['g1', 'sw', 'access 20'], ['sw', 'e2', 'access 10'], ['sw', 'g2', 'access 20'], ['sw', 'r', 'trunk 802.1Q']],
    steps: [
      {
        say: 'Without VLANs every device on a switch is in one big broadcast domain: guests could see engineering’s ARP and DHCP chatter. A VLAN splits one switch into several logical switches.',
        deep: 'Each port is assigned to a VLAN (an access port), or carries many VLANs with tags (a trunk port). The tag is a 4‑byte 802.1Q header inserted into the Ethernet frame with a 12‑bit VLAN ID, so up to 4,094 VLANs.',
      },
      {
        say: 'The guest phone broadcasts. The switch only floods it to ports in VLAN 20. Engineering never sees it.',
        msgs: [
          { from: 'g1', to: 'sw', label: 'broadcast', c: 'amber' },
          { from: 'sw', to: 'g2', label: 'VLAN 20 only', c: 'amber' },
          { from: 'sw', to: 'r', label: 'tag 20', c: 'amber', par: true, h: { l2: { dst_mac: MAC.bc, vlan: '20' } } },
        ],
        focus: ['g1', 'g2'],
      },
      {
        say: 'Engineering traffic stays inside VLAN 10 the same way. The two VLANs share hardware but cannot hear each other at Layer 2.',
        msgs: [{ from: 'e1', to: 'e2', label: 'VLAN 10', c: 'blue' }],
        focus: ['e1', 'e2'],
      },
      {
        say: 'To cross between VLANs you must go through a router (or a Layer 3 switch), which is exactly where you put a firewall rule. The trunk link carries both VLANs to the router with tags.',
        msgs: [
          { from: 'g1', to: 'r', label: 'tag 20 → router', c: 'amber', via: ['g1', 'sw', 'r'], h: { l2: { vlan: '20' }, l3: { src: '10.20.0.8', dst: '10.10.0.4' } } },
          { from: 'r', to: 'e2', label: 'tag 10 (if allowed)', c: 'blue', via: ['r', 'sw', 'e2'], h: { l2: { vlan: '10' }, l3: { src: '10.20.0.8', dst: '10.10.0.4' } } },
        ],
      },
    ],
    takeaways: [
      'A VLAN is a separate broadcast domain on shared switch hardware.',
      'Trunk ports carry many VLANs using 802.1Q tags.',
      'Traffic between VLANs must be routed, which is where policy lives.',
    ],
    quiz: [
      { q: 'Two hosts on the same switch are in VLAN 10 and VLAN 20. How can they talk?', options: ['Directly through the switch', 'Only through a router or L3 switch', 'They can never talk'], answer: 1, why: 'Different VLANs are different Layer 2 networks, so traffic between them has to be routed.' },
    ],
  },
  {
    id: 'wifi',
    chapter: 'local',
    level: 'beginner',
    title: 'Wi‑Fi: sharing the air',
    blurb: 'Radio is one shared channel. Everyone takes turns, and that is why Wi‑Fi slows down in a crowd.',
    minutes: 3,
    nodes: [
      N('ph', 'host', 'Phone', 0, 40),
      N('lp', 'host', 'Laptop', 0, 300),
      N('tv', 'host', 'TV', 660, 300),
      N('ap', 'ap', 'Access point', 330, 170, 'channel 36'),
      N('r', 'router', 'Router', 660, 40),
    ],
    links: [['ph', 'ap', 'radio'], ['lp', 'ap', 'radio'], ['tv', 'ap', 'radio'], ['ap', 'r', 'cable']],
    steps: [
      {
        say: 'A cable gives each device its own private wire to the switch. Wi‑Fi is different: every device on the same channel shares one slice of radio spectrum. Only one can transmit at a time.',
      },
      {
        say: 'Before sending, a device listens. If the air is quiet it waits a small random time, then transmits. This is called CSMA/CA: listen first, avoid collisions.',
        msgs: [{ from: 'ph', to: 'ap', label: 'frame', c: 'blue' }],
        focus: ['ph'],
      },
      {
        say: 'Meanwhile the laptop wanted to send too. It heard the phone talking, so it backs off and waits. Each frame is acknowledged by the access point; no ACK means “collision, try again later”.',
        deep: 'Unlike Ethernet, a radio cannot hear while it transmits, so Wi‑Fi cannot detect collisions directly. It uses link‑layer ACKs and exponential random backoff. RTS/CTS handshakes help with the “hidden node” problem where two clients cannot hear each other but both reach the AP.',
        msgs: [
          { from: 'ap', to: 'ph', label: 'ACK', c: 'green' },
          { from: 'lp', to: 'ap', label: 'frame (after backoff)', c: 'violet' },
          { from: 'ap', to: 'lp', label: 'ACK', c: 'green' },
        ],
      },
      {
        say: 'Airtime is the real currency. A slow, far‑away device takes longer to send the same bytes, and everyone waits for it. That is why one old device at the edge of range can slow down the whole network.',
        msgs: [{ from: 'tv', to: 'ap', label: 'slow frame…', c: 'amber' }],
        note: { x: 420, y: 400, text: 'one slow talker = everyone waits' },
      },
    ],
    takeaways: [
      'Wi‑Fi is a shared, half‑duplex medium: one talker per channel at a time.',
      'Devices listen, back off randomly and rely on ACKs (CSMA/CA).',
      'Capacity is airtime; slow clients consume more of it.',
    ],
    quiz: [
      { q: 'Why can adding more devices to one Wi‑Fi channel slow everyone down, even if each uses little data?', options: ['The router overheats', 'They all share the same airtime and contend to transmit', 'IP addresses run out'], answer: 1, why: 'Every transmission occupies the shared channel; more devices means more contention, backoff and waiting.' },
    ],
  },
]

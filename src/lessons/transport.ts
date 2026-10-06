import type { Lesson } from '../types'
import { N } from './helpers'

const tcp = (flags: string, seq: string, ack?: string, extra: Record<string, string> = {}) => ({
  l4: { proto: 'TCP', flags, seq, ...(ack ? { ack } : {}), ...extra },
})

export const transport: Lesson[] = [
  {
    id: 'ports-udp-tcp',
    chapter: 'transport',
    level: 'beginner',
    title: 'Ports, UDP & TCP',
    blurb: 'IP gets you to the building. Ports get you to the right apartment.',
    minutes: 4,
    nodes: [
      N('c', 'host', 'Your laptop', 0, 180, '10.0.0.5'),
      N('r', 'router', 'Network', 330, 180),
      N('s', 'server', 'Server', 660, 180, '203.0.113.7'),
    ],
    links: [['c', 'r'], ['r', 's']],
    steps: [
      {
        say: 'One server runs many programs at once: a website, an SSH server, a database. A port number (0–65535) says which program a packet is for. Web is 443, SSH is 22, DNS is 53.',
        tables: { s: { title: 'Listening sockets', cols: ['Port', 'Program'], rows: [['22', 'sshd'], ['53/udp', 'dns'], ['443', 'nginx'], ['5432', 'postgres']] } },
      },
      {
        say: 'UDP is the simple option: stick a port number on the data and send it. No setup, no guarantee it arrives, no ordering. Great when speed beats perfection: DNS, games, voice calls, video streams.',
        msgs: [
          { from: 'c', to: 's', label: 'UDP → :53', why: 'A DNS question sent over UDP: no setup, just send it.', c: 'teal', h: { l4: { proto: 'UDP', src_port: '50123', dst_port: '53', length: '41' }, l7: { query: 'example.com A?' } } },
          { from: 's', to: 'c', label: 'UDP reply', c: 'green' },
          { from: 'c', to: 's', label: 'UDP (lost)', why: "This UDP packet is lost, and nobody will notice or resend it. That is UDP's trade-off.", c: 'teal', drop: true },
        ],
        note: { x: 300, y: 330, text: 'lost? UDP doesn’t care' },
      },
      {
        say: 'TCP is the careful option. It sets up a connection first, numbers every byte, waits for acknowledgements, resends anything lost and delivers everything in order. Web pages, APIs, file transfers and SSH use TCP.',
        msgs: [
          { from: 'c', to: 's', label: 'SYN', c: 'blue' },
          { from: 's', to: 'c', label: 'SYN‑ACK', c: 'green' },
          { from: 'c', to: 's', label: 'ACK + data', c: 'blue' },
          { from: 's', to: 'c', label: 'ACK', c: 'green' },
        ],
      },
      {
        say: 'A connection is identified by five things: protocol, source IP, source port, destination IP, destination port. That 5‑tuple is how a busy server keeps millions of conversations apart, all on port 443.',
        deep: 'Your OS picks a random ephemeral source port (e.g. 49152–65535) for each outgoing connection. Load balancers hash the 5‑tuple to keep a flow pinned to the same backend.',
        tables: { s: { title: 'Connections on :443', cols: ['Client IP', 'Client port', 'State'], rows: [['10.0.0.5', '51544', 'ESTABLISHED'], ['10.0.0.5', '51545', 'ESTABLISHED'], ['198.51.100.2', '40112', 'ESTABLISHED']] } },
      },
    ],
    takeaways: [
      'Ports identify the application; well‑known ports: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS.',
      'UDP: fast, connectionless, unreliable. TCP: connection‑oriented, reliable, ordered.',
      'A connection is identified by its 5‑tuple.',
    ],
    quiz: [
      { q: 'Which is the better fit for a live voice call?', options: ['TCP, because nothing should be lost', 'UDP, because a late packet is useless anyway'], answer: 1, why: 'Retransmitting a 20ms audio frame after 200ms is pointless; you would rather skip it and keep going.' },
    ],
  },
  {
    id: 'tcp-handshake',
    chapter: 'transport',
    level: 'beginner',
    title: 'TCP handshake & teardown',
    blurb: 'SYN, SYN‑ACK, ACK. One round trip before any data moves.',
    minutes: 4,
    nodes: [
      N('c', 'host', 'Client', 0, 180, '10.0.0.5:51544'),
      N('s', 'server', 'Server', 800, 180, '203.0.113.7:443'),
    ],
    links: [['c', 's', '40 ms one way']],
    steps: [
      {
        say: 'Before TCP sends data, both sides agree to talk and pick starting sequence numbers. This is the three‑way handshake.',
        tables: { c: { title: 'Client state', cols: ['State'], rows: [['CLOSED']] }, s: { title: 'Server state', cols: ['State'], rows: [['LISTEN']] } },
      },
      {
        say: '1. SYN: “I’d like to connect. My bytes will start at number 1000.” The starting number is random, to make it hard for attackers to guess and inject packets.',
        msgs: [{ from: 'c', to: 's', label: 'SYN seq=1000', why: "Step 1: “I'd like to talk. My bytes will start at number 1000.”", c: 'blue', h: tcp('SYN', '1000', undefined, { src_port: '51544', dst_port: '443', window: '64240', options: 'MSS 1460, SACK, WScale 7' }) }],
        tables: { c: { title: 'Client state', cols: ['State'], rows: [['SYN_SENT']], fresh: [0] }, s: { title: 'Server state', cols: ['State'], rows: [['LISTEN']] } },
      },
      {
        say: '2. SYN‑ACK: “OK. I got your 1000, so I expect 1001 next. My bytes start at 5000.”',
        msgs: [{ from: 's', to: 'c', label: 'SYN‑ACK seq=5000 ack=1001', why: 'Step 2: “OK, I got 1000, so I expect 1001 next. My bytes start at 5000.”', c: 'green', h: tcp('SYN,ACK', '5000', '1001') }],
        tables: { c: { title: 'Client state', cols: ['State'], rows: [['SYN_SENT']] }, s: { title: 'Server state', cols: ['State'], rows: [['SYN_RECEIVED']], fresh: [0] } },
      },
      {
        say: '3. ACK: “Got it, expecting 5001.” Both sides are now ESTABLISHED. That cost one full round trip (80 ms here) before the first useful byte.',
        deep: 'Servers keep half‑open connections in a SYN queue. A SYN flood fills it with fake SYNs; SYN cookies defend by encoding the state into the server’s sequence number instead of storing it. TCP Fast Open lets repeat clients send data in the SYN.',
        msgs: [{ from: 'c', to: 's', label: 'ACK ack=5001', why: 'Step 3: “Got it.” Both sides are connected. That took one full round trip.', c: 'blue', h: tcp('ACK', '1001', '5001') }],
        tables: { c: { title: 'Client state', cols: ['State'], rows: [['ESTABLISHED']], fresh: [0] }, s: { title: 'Server state', cols: ['State'], rows: [['ESTABLISHED']], fresh: [0] } },
      },
      {
        say: 'Now data flows both ways. Each side acknowledges what it has received by saying which byte it expects next.',
        msgs: [
          { from: 'c', to: 's', label: 'GET / (200 B)', why: "Now real data flows: the browser's request.", c: 'violet', h: tcp('PSH,ACK', '1001', '5001') },
          { from: 's', to: 'c', label: 'ACK=1201 + 200 OK', c: 'green', h: tcp('PSH,ACK', '5001', '1201') },
        ],
      },
      {
        say: 'Closing is polite too: each side sends FIN when it is done and the other acknowledges. The side that closed first waits in TIME_WAIT for a while so stray old packets cannot confuse a new connection.',
        deep: 'TIME_WAIT lasts 2×MSL (often 60 s on Linux). Busy clients that open and close lots of short connections can run out of ephemeral ports this way, one reason connection pooling and HTTP keep‑alive matter.',
        msgs: [
          { from: 'c', to: 's', label: 'FIN', c: 'amber' },
          { from: 's', to: 'c', label: 'ACK', c: 'green' },
          { from: 's', to: 'c', label: 'FIN', c: 'amber' },
          { from: 'c', to: 's', label: 'ACK', c: 'blue' },
        ],
        tables: { c: { title: 'Client state', cols: ['State'], rows: [['TIME_WAIT']], fresh: [0] }, s: { title: 'Server state', cols: ['State'], rows: [['CLOSED']], fresh: [0] } },
      },
    ],
    takeaways: [
      'SYN → SYN‑ACK → ACK establishes a connection in one round trip.',
      'Sequence numbers count bytes; ACK = next byte expected.',
      'FIN/ACK in each direction closes it; TIME_WAIT guards against stale packets.',
    ],
    quiz: [
      { q: 'Client and server are 100 ms apart (one way). How long before the client can send its first data byte?', options: ['0 ms', '100 ms', '200 ms (one round trip)', '300 ms'], answer: 2, why: 'SYN goes out (100 ms), SYN‑ACK comes back (100 ms). The client can send data together with its final ACK.' },
    ],
  },
  {
    id: 'tcp-reliability',
    chapter: 'transport',
    level: 'intermediate',
    title: 'Loss, ACKs & retransmission',
    blurb: 'How TCP notices a missing packet and gets it back.',
    minutes: 4,
    sandbox: 'lossy',
    nodes: [
      N('c', 'host', 'Sender', 0, 180),
      N('r', 'router', 'Congested router', 400, 180),
      N('s', 'server', 'Receiver', 800, 180),
    ],
    links: [['c', 'r'], ['r', 's']],
    steps: [
      {
        say: 'The sender has four segments to send, 1,000 bytes each. It does not wait for each one to be acknowledged; it sends several in a row.',
        msgs: [
          { from: 'c', to: 's', label: 'seq 1', c: 'blue' },
          { from: 'c', to: 's', label: 'seq 1001', c: 'blue', par: true },
          { from: 'c', to: 's', label: 'seq 2001', c: 'blue', par: true },
          { from: 'c', to: 's', label: 'seq 3001', c: 'blue', par: true },
        ],
      },
      {
        say: 'Suppose the router’s buffer is full and segment 1001 is dropped. The receiver gets 1, then 2001 and 3001: there is a hole.',
        msgs: [
          { from: 'c', to: 's', label: 'seq 1', c: 'blue' },
          { from: 'c', to: 's', label: 'seq 1001', c: 'blue', drop: true, par: true },
          { from: 'c', to: 's', label: 'seq 2001', c: 'blue', par: true },
          { from: 'c', to: 's', label: 'seq 3001', c: 'blue', par: true },
        ],
        tables: { s: { title: 'Receive buffer', cols: ['Bytes', 'Status'], rows: [['1–1000', 'got'], ['1001–2000', 'missing'], ['2001–3000', 'buffered'], ['3001–4000', 'buffered']], fresh: [1] } },
      },
      {
        say: 'The receiver keeps acknowledging the first byte it is missing: “ACK 1001, ACK 1001, ACK 1001”. Three duplicate ACKs tell the sender exactly what went missing, without waiting for a timer.',
        deep: 'This is fast retransmit. With SACK (selective acknowledgement) the receiver also lists the blocks it does have (2001–4000), so the sender resends only the gap.',
        msgs: [
          { from: 's', to: 'c', label: 'ACK 1001', c: 'green' },
          { from: 's', to: 'c', label: 'ACK 1001 (dup)', c: 'amber', par: true },
          { from: 's', to: 'c', label: 'ACK 1001 (dup)', c: 'amber', par: true },
        ],
      },
      {
        say: 'The sender retransmits segment 1001. The hole is filled, and the receiver can deliver all 4,000 bytes to the application in order.',
        msgs: [
          { from: 'c', to: 's', label: 'seq 1001 (retransmit)', c: 'violet' },
          { from: 's', to: 'c', label: 'ACK 4001', c: 'green' },
        ],
        tables: { s: { title: 'Receive buffer', cols: ['Bytes', 'Status'], rows: [['1–4000', 'delivered to app']], fresh: [0] } },
      },
      {
        say: 'If the last packet in a burst is lost there are no later packets to trigger duplicate ACKs. Then the sender has to wait for its retransmission timer (RTO), at least 200 ms on Linux. This is why a little packet loss hurts your slowest requests so much.',
        deep: 'Head‑of‑line blocking: while 1001 is missing, bytes 2001–4000 sit in the buffer even though they arrived. Every stream multiplexed over that TCP connection stalls. QUIC fixes this by doing reliability per stream.',
        msgs: [
          { from: 'c', to: 's', label: 'last seg', c: 'blue', drop: true },
        ],
        note: { x: 280, y: 320, text: '…silence… RTO ≥ 200 ms' },
      },
    ],
    takeaways: [
      'ACKs carry the next expected byte; duplicates point at a gap.',
      '3 duplicate ACKs → fast retransmit. No ACKs → wait for the RTO timer.',
      'Loss stalls in‑order delivery (head‑of‑line blocking) and inflates tail latency.',
    ],
    quiz: [
      { q: 'Why is losing the last packet of a response worse than losing a middle one?', options: ['It is bigger', 'No later packets arrive to generate duplicate ACKs, so the sender must wait for a timeout', 'The checksum fails'], answer: 1, why: 'Fast retransmit needs later packets to trigger duplicate ACKs; a lost tail falls back to the slower RTO.' },
    ],
  },
  {
    id: 'flow-control',
    chapter: 'transport',
    level: 'intermediate',
    title: 'Sliding windows & flow control',
    blurb: 'Keep the pipe full, but never overflow the receiver.',
    minutes: 4,
    widget: 'bdp',
    nodes: [
      N('c', 'host', 'Fast sender', 0, 180),
      N('s', 'host', 'Slow receiver', 800, 180, 'small buffer'),
    ],
    links: [['c', 's', '100 ms RTT · 1 Gb/s']],
    steps: [
      {
        say: 'If TCP waited for an ACK after every packet, a 100 ms link could carry just 10 packets a second. Instead the sender keeps a window of unacknowledged data in flight.',
        msgs: [{ from: 'c', to: 's', label: 'seg', c: 'blue' }, { from: 's', to: 'c', label: 'ACK', c: 'green' }],
        note: { x: 300, y: 320, text: 'stop‑and‑wait: painfully slow' },
      },
      {
        say: 'With a window of four segments, four are in flight at once. Each returning ACK slides the window forward and lets one more out.',
        msgs: [
          { from: 'c', to: 's', label: '1', c: 'blue' },
          { from: 'c', to: 's', label: '2', c: 'blue', par: true },
          { from: 'c', to: 's', label: '3', c: 'blue', par: true },
          { from: 'c', to: 's', label: '4', c: 'blue', par: true },
          { from: 's', to: 'c', label: 'ACK 2', c: 'green' },
          { from: 'c', to: 's', label: '5', c: 'violet', par: true },
        ],
      },
      {
        say: 'To fill a pipe completely, the window must hold one bandwidth‑delay product: bandwidth × round‑trip time. For 1 Gb/s and 100 ms that is 12.5 MB in flight. Use the calculator on the right.',
        deep: 'The original 16‑bit window field caps at 64 KB, which would limit this link to ~5 Mb/s. The window‑scale option (negotiated in the SYN) multiplies it by up to 2^14.',
      },
      {
        say: 'Flow control protects the receiver. Every ACK advertises how much buffer space is free (rwnd). If the application is slow to read, rwnd shrinks to zero and the sender must pause.',
        msgs: [
          { from: 's', to: 'c', label: 'ACK, window=0', c: 'red', h: { l4: { flags: 'ACK', window: '0' } } },
          { from: 'c', to: 's', label: 'window probe', c: 'amber' },
          { from: 's', to: 'c', label: 'window=64KB', c: 'green' },
        ],
      },
    ],
    takeaways: [
      'A sliding window keeps many segments in flight.',
      'Full utilisation needs window ≥ bandwidth × RTT (BDP).',
      'The receiver advertises rwnd so the sender never overflows it (flow control).',
    ],
    quiz: [
      { q: 'A link is 10 Gb/s with 20 ms RTT. Roughly how much data must be in flight to fill it?', options: ['250 KB', '25 MB', '2.5 GB'], answer: 1, why: '10 Gb/s × 0.02 s = 200 Mb = 25 MB.' },
    ],
  },
  {
    id: 'congestion',
    chapter: 'transport',
    level: 'intermediate',
    title: 'Congestion control',
    blurb: 'Slow start, additive increase, multiplicative decrease. TCP probes for bandwidth and backs off on loss.',
    minutes: 5,
    widget: 'cwnd',
    sandbox: 'bufferbloat',
    nodes: [
      N('a', 'host', 'Sender A', 0, 60),
      N('b', 'host', 'Sender B', 0, 300),
      N('r', 'router', 'Bottleneck', 380, 180, '100 Mb/s'),
      N('s', 'server', 'Receiver', 760, 180),
    ],
    links: [['a', 'r', '1 Gb/s'], ['b', 'r', '1 Gb/s'], ['r', 's', '100 Mb/s']],
    steps: [
      {
        say: 'Flow control protects the receiver. Congestion control protects the network. The sender has no idea how much spare capacity the path has, so it has to discover it by trying.',
      },
      {
        say: 'Slow start: begin with a small congestion window (cwnd, about 10 segments) and double it every round trip. “Slow” is ironic; it grows exponentially.',
        msgs: [
          { from: 'a', to: 's', label: 'cwnd 10', c: 'blue' },
          { from: 'a', to: 's', label: 'cwnd 20', c: 'blue', burst: 2 },
          { from: 'a', to: 's', label: 'cwnd 40', c: 'blue', burst: 3 },
        ],
      },
      {
        say: 'Eventually the bottleneck router’s queue overflows and a packet is dropped. The sender treats loss as a signal of congestion and cuts its window in half.',
        msgs: [{ from: 'a', to: 's', label: 'cwnd 80', c: 'blue', burst: 4 }, { from: 'r', to: 's', label: 'drop', c: 'red', drop: true }],
        note: { x: 380, y: 360, text: 'queue full → drop → cwnd ÷ 2' },
      },
      {
        say: 'Then congestion avoidance: grow by just one segment per round trip. Add slowly, cut quickly (AIMD). The result is the famous saw‑tooth. Play with it on the right.',
        deep: 'AIMD is what makes competing flows converge to a fair share. Linux defaults to CUBIC, which grows as a cubic function of time since the last loss. Google’s BBR instead models bottleneck bandwidth and minimum RTT and paces to them, which avoids filling buffers.',
      },
      {
        say: 'Two senders sharing the bottleneck each end up with roughly half. But deep router buffers let windows grow until the queue is huge, adding hundreds of ms of delay before any loss happens. That is bufferbloat; try the sandbox scenario.',
        msgs: [
          { from: 'a', to: 's', label: 'A ≈ 50 Mb/s', c: 'blue' },
          { from: 'b', to: 's', label: 'B ≈ 50 Mb/s', c: 'violet', par: true },
        ],
        deep: 'Fixes: Active queue management (CoDel, FQ‑CoDel) drops early based on queueing delay; ECN marks packets instead of dropping them so senders slow down without loss.',
      },
    ],
    takeaways: [
      'cwnd limits how much a sender has in flight; rwnd and cwnd both apply (min of the two).',
      'Slow start doubles per RTT; congestion avoidance adds one per RTT; loss halves it.',
      'Oversized buffers cause bufferbloat: high latency without loss.',
    ],
    quiz: [
      { q: 'In classic TCP Reno, what happens to cwnd after a loss detected by three duplicate ACKs?', options: ['Resets to 1', 'Halves', 'Doubles'], answer: 1, why: 'Multiplicative decrease halves the window; a timeout (RTO) is treated as more severe and resets to slow start.' },
    ],
  },
  {
    id: 'quic',
    chapter: 'transport',
    level: 'intermediate',
    title: 'QUIC & HTTP/3',
    blurb: 'TCP + TLS rebuilt on UDP: faster setup, no head‑of‑line blocking, survives network changes.',
    minutes: 4,
    nodes: [
      N('c', 'host', 'Phone', 0, 180),
      N('s', 'server', 'Server', 800, 180),
    ],
    links: [['c', 's', '50 ms one way']],
    steps: [
      {
        say: 'Classic HTTPS needs a TCP handshake (1 round trip) and then a TLS handshake (another round trip) before the request. On a 100 ms mobile link that is 200 ms of nothing.',
        msgs: [
          { from: 'c', to: 's', label: 'TCP SYN', c: 'gray' },
          { from: 's', to: 'c', label: 'SYN‑ACK', c: 'gray' },
          { from: 'c', to: 's', label: 'TLS ClientHello', c: 'amber' },
          { from: 's', to: 'c', label: 'TLS ServerHello…', c: 'amber' },
          { from: 'c', to: 's', label: 'GET /', c: 'violet' },
        ],
      },
      {
        say: 'QUIC runs over UDP and merges transport and encryption into one handshake: a single round trip and you are sending requests.',
        msgs: [
          { from: 'c', to: 's', label: 'Initial (QUIC + TLS hello)', c: 'teal', h: { l4: { proto: 'UDP', dst_port: '443' }, x: { quic: 'Initial', dcid: '8f3a…', tls: 'ClientHello' } } },
          { from: 's', to: 'c', label: 'Handshake', c: 'teal' },
          { from: 'c', to: 's', label: 'GET / (stream 0)', c: 'violet' },
        ],
      },
      {
        say: 'For a server you have visited before, QUIC can even send the request in the very first packet (0‑RTT).',
        deep: '0‑RTT data can be replayed by an attacker, so servers only accept it for idempotent requests like GETs.',
        msgs: [{ from: 'c', to: 's', label: 'Initial + 0‑RTT GET', c: 'violet' }, { from: 's', to: 'c', label: 'response', c: 'green' }],
      },
      {
        say: 'Independent streams: a lost packet only stalls the stream it belonged to. With HTTP/2 over TCP, one loss stalls every image, script and API call sharing the connection.',
        msgs: [
          { from: 's', to: 'c', label: 'stream 1 (css)', c: 'blue' },
          { from: 's', to: 'c', label: 'stream 2 (img)', c: 'pink', par: true, drop: true },
          { from: 's', to: 'c', label: 'stream 3 (js)', c: 'teal', par: true },
        ],
        note: { x: 300, y: 330, text: 'only stream 2 waits' },
      },
      {
        say: 'Connection migration: QUIC connections are identified by a connection ID, not the IP/port 5‑tuple. Walk from Wi‑Fi to 4G and the download keeps going.',
        deep: 'Because QUIC lives in user space, browsers and CDNs can ship congestion‑control improvements without waiting for OS kernels. The trade‑off is higher CPU cost per byte than kernel TCP with hardware offloads.',
      },
    ],
    takeaways: [
      'QUIC = reliable, encrypted, multiplexed transport over UDP.',
      '1‑RTT setup (0‑RTT on resume) vs 2+ for TCP + TLS.',
      'Per‑stream loss recovery removes TCP head‑of‑line blocking; connection IDs enable migration.',
    ],
    quiz: [
      { q: 'Why is QUIC built on UDP rather than a brand new IP protocol?', options: ['UDP is encrypted', 'Middleboxes and firewalls across the Internet already pass UDP; a new protocol number would be blocked', 'UDP is reliable'], answer: 1, why: 'Ossified middleboxes drop unknown protocols; UDP gets through and QUIC builds everything else on top.' },
    ],
  },
]

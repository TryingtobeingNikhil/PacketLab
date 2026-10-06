import type { Lesson } from '../types'
import { N } from './helpers'

export const app: Lesson[] = [
  {
    id: 'dns',
    chapter: 'app',
    level: 'beginner',
    title: 'DNS: the Internet’s phone book',
    blurb: 'From “example.com” to 93.184.216.34, by asking three servers in turn.',
    minutes: 5,
    nodes: [
      N('c', 'host', 'Your laptop', 0, 200),
      N('res', 'dns', 'Recursive resolver', 300, 200, 'ISP / 1.1.1.1'),
      N('root', 'dns', 'Root server', 640, 0, '.'),
      N('tld', 'dns', '.com TLD server', 640, 200, 'com.'),
      N('auth', 'dns', 'Authoritative', 640, 400, 'example.com.'),
      N('web', 'server', 'example.com', 940, 200, '93.184.216.34'),
    ],
    links: [['c', 'res'], ['res', 'root'], ['res', 'tld'], ['res', 'auth'], ['c', 'web']],
    steps: [
      {
        say: 'Computers route by IP address, but humans remember names. DNS translates one into the other. Your laptop does not do the hard work itself; it asks a recursive resolver, usually run by your ISP or a service like 1.1.1.1.',
        msgs: [{ from: 'c', to: 'res', label: 'example.com A?', c: 'blue', h: { l4: { proto: 'UDP', dst_port: '53' }, l7: { qname: 'example.com', qtype: 'A', rd: '1 (recursion desired)' } } }],
        tables: { res: { title: 'Resolver cache', cols: ['Name', 'Answer', 'TTL'], rows: [] } },
      },
      {
        say: 'The resolver’s cache is empty, so it starts at the top. It asks a root server: “Where is example.com?” The root does not know, but it knows who runs .com.',
        msgs: [
          { from: 'res', to: 'root', label: 'example.com?', c: 'blue' },
          { from: 'root', to: 'res', label: 'ask a.gtld-servers.net', c: 'amber', h: { l7: { type: 'referral', ns: 'a.gtld-servers.net', glue: '192.5.6.30' } } },
        ],
      },
      {
        say: 'It asks the .com server. Again, a referral: “Ask example.com’s own name servers.”',
        msgs: [
          { from: 'res', to: 'tld', label: 'example.com?', c: 'blue' },
          { from: 'tld', to: 'res', label: 'ask ns1.example.com', c: 'amber' },
        ],
      },
      {
        say: 'The authoritative server actually owns the answer: example.com is 93.184.216.34, and you may cache this for 3,600 seconds.',
        msgs: [
          { from: 'res', to: 'auth', label: 'example.com?', c: 'blue' },
          { from: 'auth', to: 'res', label: 'A 93.184.216.34 TTL 3600', c: 'green', h: { l7: { answer: 'example.com. 3600 IN A 93.184.216.34', aa: '1 (authoritative)' } } },
        ],
        tables: { res: { title: 'Resolver cache', cols: ['Name', 'Answer', 'TTL'], rows: [['com.', 'NS a.gtld-servers.net', '172800'], ['example.com', '93.184.216.34', '3600']], fresh: [0, 1] } },
      },
      {
        say: 'The resolver answers the laptop, which can now open a connection to the real server. The next person who asks the same resolver gets the answer instantly from cache.',
        deep: 'Caching at every level (browser, OS, resolver) is what makes DNS fast; TTLs trade freshness for load. Low TTLs let you fail over quickly but cost more lookups. DNS is mostly UDP; large answers fall back to TCP. DoH/DoT encrypt queries so your network cannot read them.',
        msgs: [
          { from: 'res', to: 'c', label: '93.184.216.34', c: 'green' },
          { from: 'c', to: 'web', label: 'TCP SYN', c: 'violet' },
        ],
      },
      {
        say: 'DNS records come in types: A (IPv4), AAAA (IPv6), CNAME (an alias for another name), MX (mail servers), TXT (verification strings), NS (who is authoritative).',
        tables: { auth: { title: 'example.com zone', cols: ['Name', 'Type', 'Value'], rows: [['@', 'A', '93.184.216.34'], ['@', 'AAAA', '2606:2800:220:1::'], ['www', 'CNAME', 'example.com'], ['@', 'MX', '10 mail.example.com'], ['@', 'TXT', 'v=spf1 …']] } },
      },
    ],
    takeaways: [
      'Stub (your laptop) → recursive resolver → root → TLD → authoritative.',
      'Every answer carries a TTL and is cached along the way.',
      'Common record types: A, AAAA, CNAME, MX, TXT, NS.',
    ],
    quiz: [
      { q: 'Which server actually holds the answer for example.com?', options: ['The root server', 'The .com TLD server', 'example.com’s authoritative name server'], answer: 2, why: 'Root and TLD servers only refer you onward; the authoritative server owns the zone data.' },
    ],
  },
  {
    id: 'http',
    chapter: 'app',
    level: 'beginner',
    title: 'HTTP: requests & responses',
    blurb: 'Verbs, status codes, headers, and how HTTP/1.1, 2 and 3 differ.',
    minutes: 5,
    widget: 'http',
    nodes: [
      N('b', 'host', 'Browser', 0, 180),
      N('s', 'server', 'Web server', 800, 180, 'api.shop.com'),
    ],
    links: [['b', 's', 'TLS over TCP :443']],
    steps: [
      {
        say: 'HTTP is a conversation of requests and responses. A request names a method (GET to read, POST to create, PUT/PATCH to update, DELETE to remove), a path, and headers.',
        msgs: [{ from: 'b', to: 's', label: 'GET /products/42', c: 'blue', h: { l7: { request: 'GET /products/42 HTTP/1.1', Host: 'api.shop.com', Accept: 'application/json', Cookie: 'session=…' } } }],
      },
      {
        say: 'The response starts with a status code. 2xx means success, 3xx means look elsewhere, 4xx means you did something wrong, 5xx means the server did.',
        msgs: [{ from: 's', to: 'b', label: '200 OK + JSON', c: 'green', h: { l7: { status: 'HTTP/1.1 200 OK', 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60', body: '{"id":42,"name":"Mug"}' } } }],
        tables: { s: { title: 'Common status codes', cols: ['Code', 'Meaning'], rows: [['200', 'OK'], ['301/302', 'Redirect'], ['304', 'Not modified (use your cache)'], ['401/403', 'Not logged in / not allowed'], ['404', 'Not found'], ['429', 'Too many requests'], ['500/502/503', 'Server / gateway / overloaded']] } },
      },
      {
        say: 'HTTP is stateless: each request stands alone. Logins work because the browser sends a cookie or token with every request.',
        msgs: [
          { from: 'b', to: 's', label: 'POST /cart (cookie)', c: 'violet' },
          { from: 's', to: 'b', label: '201 Created', c: 'green' },
        ],
      },
      {
        say: 'HTTP/1.1 can only have one request in flight per connection, so browsers open ~6 connections per site. HTTP/2 multiplexes many requests as streams on one connection. HTTP/3 does the same over QUIC. Compare them on the right.',
        deep: 'HTTP/2 also compresses headers (HPACK) and frames everything in binary. Its weakness is TCP head‑of‑line blocking: one lost packet stalls all streams. HTTP/3 (QUIC) fixes that and saves a round trip on setup.',
        msgs: [
          { from: 'b', to: 's', label: 'stream 1', c: 'blue' },
          { from: 'b', to: 's', label: 'stream 3', c: 'teal', par: true },
          { from: 'b', to: 's', label: 'stream 5', c: 'violet', par: true },
          { from: 's', to: 'b', label: 'responses (interleaved)', c: 'green', burst: 3 },
        ],
      },
    ],
    takeaways: [
      'Request = method + path + headers (+ body). Response = status + headers + body.',
      'Status classes: 2xx ok, 3xx redirect, 4xx client error, 5xx server error.',
      'HTTP/1.1 → one request at a time per connection; HTTP/2 multiplexes; HTTP/3 runs on QUIC.',
    ],
    quiz: [
      { q: 'A load balancer cannot reach any healthy backend. Which status code is it most likely to return?', options: ['404', '502 or 503', '200'], answer: 1, why: '502 Bad Gateway / 503 Service Unavailable mean the proxy could not get a good answer from upstream.' },
    ],
  },
  {
    id: 'tls',
    chapter: 'app',
    level: 'intermediate',
    title: 'TLS 1.3 handshake',
    blurb: 'Agree on a secret over a public network, and prove who you are while doing it.',
    minutes: 5,
    nodes: [
      N('c', 'host', 'Browser', 0, 180),
      N('eve', 'host', 'Eavesdropper', 400, 360, 'sees everything on the wire'),
      N('s', 'server', 'bank.com', 800, 180),
    ],
    links: [['c', 's', 'public Internet']],
    steps: [
      {
        say: 'Anything on the wire can be read by anyone in the path: your Wi‑Fi, your ISP, an attacker. TLS gives you three things: encryption (privacy), integrity (no tampering) and authentication (you really are talking to bank.com).',
        focus: ['eve'],
      },
      {
        say: 'ClientHello: the browser lists the ciphers it supports and, in TLS 1.3, already sends its half of a Diffie‑Hellman key exchange (a key share). SNI tells the server which site you want.',
        msgs: [{ from: 'c', to: 's', label: 'ClientHello + key share', c: 'amber', h: { l7: { version: 'TLS 1.3', sni: 'bank.com', ciphers: 'TLS_AES_128_GCM_SHA256, …', key_share: 'x25519: 3f9e…', alpn: 'h2, http/1.1' } } }],
      },
      {
        say: 'ServerHello: the server picks a cipher and sends its own key share. Both sides can now compute the same secret, but the eavesdropper, who saw both key shares, cannot. That is the magic of Diffie‑Hellman.',
        deep: 'Each side has a private value a or b. They exchange g^a and g^b. Each computes g^ab. Recovering a from g^a is the discrete log problem, infeasible on elliptic curves like X25519. Fresh keys per connection give forward secrecy: stealing the server’s key later does not decrypt old traffic.',
        msgs: [{ from: 's', to: 'c', label: 'ServerHello + key share', c: 'amber' }],
      },
      {
        say: 'Still in the same flight, the server sends (encrypted now) its certificate and a signature proving it owns the matching private key. The browser checks the certificate chain up to a trusted certificate authority.',
        msgs: [{ from: 's', to: 'c', label: '🔒 Certificate, Verify, Finished', c: 'violet', h: { l7: { certificate: 'CN=bank.com, issuer=R3, valid to 2027‑01‑12', chain: 'bank.com → R3 → ISRG Root X1', signature: 'ECDSA over transcript' } } }],
      },
      {
        say: 'The browser sends Finished and the first request right away. Full TLS 1.3 costs one round trip (TLS 1.2 needed two).',
        msgs: [
          { from: 'c', to: 's', label: '🔒 Finished + GET /account', c: 'blue' },
          { from: 's', to: 'c', label: '🔒 200 OK', c: 'green' },
        ],
      },
      {
        say: 'The eavesdropper sees only that you talked to bank.com (from the IP and the SNI) and how much data moved. The content is unreadable and any change would be detected.',
        deep: 'Encrypted Client Hello (ECH) hides the SNI too. mTLS (mutual TLS) has the client present a certificate as well, which is how service meshes authenticate microservices to each other.',
        msgs: [{ from: 'c', to: 'eve', label: '??? ciphertext', c: 'gray', via: ['c', 'eve'] }],
      },
    ],
    takeaways: [
      'TLS provides confidentiality, integrity and server authentication.',
      'Key exchange (ECDHE) creates a shared secret that eavesdroppers cannot compute.',
      'Certificates chain to a trusted CA; TLS 1.3 completes in one round trip.',
    ],
    quiz: [
      { q: 'What stops an attacker in the middle from simply sending you their own key share?', options: ['Nothing', 'The server signs the handshake with the private key matching a CA‑issued certificate for bank.com', 'The firewall'], answer: 1, why: 'Without the signature an attacker could do two separate key exchanges; the certificate binds the handshake to bank.com’s identity.' },
    ],
  },
  {
    id: 'realtime',
    chapter: 'app',
    level: 'beginner',
    title: 'WebSockets & streaming',
    blurb: 'When the server needs to talk first: polling, Server‑Sent Events and WebSockets.',
    minutes: 4,
    nodes: [
      N('c', 'host', 'Chat app', 0, 180),
      N('s', 'server', 'Server', 800, 180),
    ],
    links: [['c', 's']],
    steps: [
      {
        say: 'Plain HTTP is request then response: the server can only speak when asked. For a chat app, the naive fix is polling: ask every few seconds “anything new?” Mostly the answer is no, which wastes requests.',
        msgs: [
          { from: 'c', to: 's', label: 'anything new?', c: 'gray' },
          { from: 's', to: 'c', label: 'no', c: 'gray' },
          { from: 'c', to: 's', label: 'anything new?', c: 'gray' },
          { from: 's', to: 'c', label: 'no', c: 'gray' },
        ],
      },
      {
        say: 'Server‑Sent Events (SSE): the client makes one request and the server keeps the response open, writing events as they happen. One direction, plain HTTP. This is exactly how chatbots stream tokens to you.',
        msgs: [
          { from: 'c', to: 's', label: 'GET /stream', c: 'blue', h: { l7: { Accept: 'text/event-stream' } } },
          { from: 's', to: 'c', label: 'data: Hello', c: 'green' },
          { from: 's', to: 'c', label: 'data: , how', c: 'green' },
          { from: 's', to: 'c', label: 'data: can I help?', c: 'green' },
        ],
      },
      {
        say: 'WebSockets: an HTTP request that asks to “Upgrade”. After a 101 Switching Protocols response, the same TCP connection becomes a two‑way channel for small messages in either direction.',
        msgs: [
          { from: 'c', to: 's', label: 'GET /ws Upgrade: websocket', c: 'violet', h: { l7: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZQ==' } } },
          { from: 's', to: 'c', label: '101 Switching Protocols', c: 'green' },
          { from: 'c', to: 's', label: 'msg: typing…', c: 'blue' },
          { from: 's', to: 'c', label: 'msg: Ana joined', c: 'teal', par: true },
        ],
      },
      {
        say: 'Long‑lived connections change how you scale: each one holds memory on the server and pins a user to a machine, and load balancers need generous idle timeouts.',
        deep: 'A server with 100k open WebSockets needs ~100k file descriptors and a few KB each. Deploys must drain connections gracefully. For server‑to‑server streaming, gRPC uses HTTP/2 streams instead.',
      },
    ],
    takeaways: [
      'Polling is simple but wasteful.',
      'SSE: one‑way server → client stream over HTTP (used for LLM token streaming).',
      'WebSockets: full‑duplex channel after an HTTP Upgrade.',
    ],
    quiz: [
      { q: 'An LLM chat UI shows tokens appearing one by one. Which is the simplest fit?', options: ['Polling every second', 'Server‑Sent Events', 'A new TCP connection per token'], answer: 1, why: 'Data flows one way, server to client, as it is produced: exactly what SSE is for.' },
    ],
  },
]

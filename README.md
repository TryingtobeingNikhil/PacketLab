# Packetlab

Learn computer networks by watching packets move, then break a network yourself.

- **Learn**: 34 animated lessons across 7 chapters, from what a packet is to the fabrics behind AI training and inference. Each step has plain-language narration, a "Go deeper" note for intermediate learners, packets you can click to see their headers layer by layer, and live tables (MAC, ARP, NAT, routing, DNS cache). Every lesson ends with takeaways and a short quiz.
- **Sandbox**: a live simulator. Devices are queues with real capacity, and links have bandwidth, buffers, propagation delay and packet loss (which costs TCP retransmit timeouts in your p99). Drag the load up and see where it breaks.
- **Challenges**: broken designs with a measurable goal and progressive hints.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Curriculum

| Chapter | Lessons |
| --- | --- |
| Foundations | What is a network · Layers & encapsulation · Latency vs bandwidth |
| Local networks (L1–L2) | Ethernet & switches · ARP · DHCP · VLANs · Wi‑Fi |
| IP & routing (L3) | Addresses & subnets · Routing tables & TTL · NAT · ICMP & traceroute · BGP |
| Transport (L4) | Ports, UDP & TCP · Handshake & teardown · Loss & retransmission · Sliding windows · Congestion control · QUIC |
| Applications (L7) | DNS · HTTP · TLS 1.3 · WebSockets & streaming |
| Networks at scale | CDNs · Load balancing · Firewalls & DDoS · VPNs · Leaf‑spine fabrics |
| AI infrastructure | Scale‑up vs scale‑out · RDMA · Ring all‑reduce · Parallelism traffic · Incast, ECN & PFC · Serving an LLM |

Interactive widgets: OSI stack, subnet calculator, latency numbers, bandwidth‑delay product, congestion window, HTTP/1.1 vs 2 vs 3, all‑reduce cost and parallelism patterns.

## Project layout

```
src/
  lessons/      lesson content: topology + scripted packets per step
  learn/        lesson canvas, player dock, packet anatomy
  sim/          simulation engine, sandbox scenarios, challenges
  sandbox/      bench canvas, parts palette, inspector, live scope charts
  widgets/      interactive calculators used inside lessons
  catalog.ts    every device kind: icon, behaviour, defaults
```

### Adding a lesson

Add an object to one of the files in `src/lessons/`. A lesson is a set of nodes (with `x`/`y` centres), undirected `links`, and `steps`. Each step has `say` (beginner narration), optional `deep` (intermediate detail), and `msgs` (packets to animate, with optional headers under `h.l2/l3/l4/l7`). Messages with `par: true` move at the same time as the one before them. The route comes from the links, unless you give an explicit `via` path.

### Checks

```bash
npx esbuild scripts/check-lessons.ts --bundle --platform=node --format=esm --outfile=/tmp/cl.mjs && node /tmp/cl.mjs
npx esbuild scripts/check-challenges.ts --bundle --platform=node --format=esm --outfile=/tmp/cc.mjs && node /tmp/cc.mjs
```

The first checks that every lesson references real nodes and has valid quiz answers. The second confirms that each challenge fails as shipped and passes once its intended fix is applied.

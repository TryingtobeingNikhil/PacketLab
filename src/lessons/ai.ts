import type { Lesson } from '../types'
import { N } from './helpers'

export const ai: Lesson[] = [
  {
    id: 'gpu-interconnects',
    chapter: 'ai',
    level: 'beginner',
    title: 'Scale‑up vs scale‑out',
    blurb: 'Inside a server GPUs talk over NVLink; between servers they use InfiniBand or RoCE Ethernet.',
    minutes: 5,
    nodes: [
      N('g0', 'gpu', 'GPU 0', 0, 0, 'server A'),
      N('g1', 'gpu', 'GPU 1', 0, 300, 'server A'),
      N('nvA', 'nvswitch', 'NVSwitch', 230, 150, '~900 GB/s per GPU'),
      N('nicA', 'router', 'NIC A', 450, 150, '400 Gb/s'),
      N('ib', 'ibswitch', 'IB / RoCE switch', 660, 150),
      N('nicB', 'router', 'NIC B', 870, 150, '400 Gb/s'),
      N('g8', 'gpu', 'GPU 8', 1080, 150, 'server B'),
    ],
    links: [['g0', 'nvA', 'NVLink'], ['g1', 'nvA', 'NVLink'], ['nvA', 'nicA', 'PCIe'], ['nicA', 'ib', '400G'], ['ib', 'nicB', '400G'], ['nicB', 'g8', 'PCIe']],
    steps: [
      {
        say: 'Training a large model splits the work across thousands of GPUs, and they must constantly swap data: gradients, activations, weights. The network decides how much of that time GPUs spend computing versus waiting.',
      },
      {
        say: 'Scale‑up: inside one server (or one rack, for systems like NVL72) GPUs are wired together with NVLink through NVSwitch chips. Hundreds of gigabytes per second per GPU, with latencies under a microsecond. It behaves almost like shared memory.',
        msgs: [
          { from: 'g0', to: 'g1', label: 'activations · 900 GB/s', c: 'pink', h: { x: { fabric: 'NVLink 5', bandwidth: '1.8 TB/s bidirectional per GPU', latency: '< 1 µs', domain: '8–72 GPUs' } } },
        ],
        focus: ['g0', 'g1', 'nvA'],
      },
      {
        say: 'Scale‑out: between servers, each GPU usually gets its own network card (NIC) at 400 or 800 Gb/s, connected into a separate back‑end fabric of InfiniBand or RoCE Ethernet switches.',
        deep: '400 Gb/s = 50 GB/s, roughly 18× less than NVLink. That gap is why parallelism strategies put the chattiest traffic (tensor parallelism) inside the NVLink domain and the more tolerant traffic (data parallelism) across the scale‑out network.',
        msgs: [{ from: 'g0', to: 'g8', label: 'gradients · 50 GB/s', c: 'blue', via: ['g0', 'nvA', 'nicA', 'ib', 'nicB', 'g8'] }],
      },
      {
        say: 'AI clusters usually have several separate networks: the GPU back‑end fabric for training traffic, a front‑end network for users, storage and management, and the NVLink domain inside each box.',
        tables: { ib: { title: 'Interconnect cheat sheet', cols: ['Link', 'Per‑GPU bandwidth', 'Reach'], rows: [['PCIe Gen5 x16', '~64 GB/s', 'inside a server'], ['NVLink 5', '~900 GB/s each way', 'server / rack'], ['InfiniBand NDR', '400 Gb/s (50 GB/s)', 'cluster'], ['RoCE / Ethernet', '400–800 Gb/s', 'cluster'], ['Front‑end Ethernet', '25–100 Gb/s', 'data centre']] } },
      },
    ],
    takeaways: [
      'Scale‑up (NVLink) = huge bandwidth inside a server/rack; scale‑out (IB/RoCE) = cluster‑wide.',
      'Each GPU typically has its own 400–800 Gb/s NIC on a dedicated back‑end fabric.',
      'Put the most communication‑heavy work on the fastest links.',
    ],
    quiz: [
      { q: 'Which traffic belongs inside the NVLink domain?', options: ['User HTTP requests', 'Tensor‑parallel activations exchanged every layer', 'Nightly backups'], answer: 1, why: 'Tensor parallelism communicates inside every layer of every step, so it needs the highest bandwidth and lowest latency.' },
    ],
  },
  {
    id: 'rdma',
    chapter: 'ai',
    level: 'intermediate',
    title: 'RDMA: skipping the CPU',
    blurb: 'Let the network card read and write remote memory directly. No kernel, no copies.',
    minutes: 4,
    nodes: [
      N('appA', 'host', 'App (server A)', 0, 0),
      N('kA', 'worker', 'Kernel TCP stack', 0, 280, 'copies + interrupts'),
      N('nicA', 'router', 'RDMA NIC A', 300, 140),
      N('fab', 'ibswitch', 'Fabric', 560, 140),
      N('nicB', 'router', 'RDMA NIC B', 820, 140),
      N('memB', 'kvcache', 'GPU memory (B)', 1080, 140),
      N('kB', 'worker', 'Kernel B', 820, 380),
    ],
    links: [['appA', 'kA'], ['kA', 'nicA'], ['appA', 'nicA', 'verbs'], ['nicA', 'fab'], ['fab', 'nicB'], ['nicB', 'memB', 'GPUDirect'], ['nicB', 'kB'], ['kB', 'memB']],
    steps: [
      {
        say: 'With ordinary TCP, sending data means a system call, the kernel copying your buffer, building packets, interrupts on the other side, another copy into the receiver’s buffer. At 400 Gb/s the CPU simply cannot keep up.',
        msgs: [
          { from: 'appA', to: 'kA', label: 'send() → copy', c: 'gray' },
          { from: 'kA', to: 'nicA', label: 'packets', c: 'gray' },
          { from: 'nicA', to: 'kB', label: 'interrupt', c: 'gray', via: ['nicA', 'fab', 'nicB', 'kB'] },
          { from: 'kB', to: 'memB', label: 'copy', c: 'gray' },
        ],
      },
      {
        say: 'RDMA (remote direct memory access): the application registers a memory region with the NIC once. After that it posts “write these bytes to that remote address” and the NICs move the data themselves, with no CPU and no kernel on either side.',
        deep: 'The API is called verbs: you create queue pairs (QPs), post work requests to a send queue, and poll a completion queue. One‑sided READ/WRITE operations do not even notify the remote CPU.',
        msgs: [{ from: 'appA', to: 'memB', label: 'RDMA WRITE', c: 'pink', via: ['appA', 'nicA', 'fab', 'nicB', 'memB'], h: { x: { op: 'RDMA_WRITE', remote_addr: '0x7f3a_0000', rkey: '0x1234', length: '4 MiB' } } }],
      },
      {
        say: 'GPUDirect RDMA goes one step further: the NIC reads from and writes to GPU memory directly over PCIe, so gradients never touch host RAM.',
        msgs: [{ from: 'memB', to: 'appA', label: 'GPU → GPU', c: 'pink', via: ['memB', 'nicB', 'fab', 'nicA', 'appA'] }],
      },
      {
        say: 'Two ways to run RDMA: InfiniBand, a purpose‑built lossless fabric, or RoCE v2, which carries the same RDMA transport inside UDP/IP over Ethernet. RoCE needs the Ethernet network tuned to (almost) never drop packets, because the NIC’s simple recovery handles loss badly.',
        deep: 'Classic RoCE NICs use go‑back‑N: one lost packet forces resending everything after it. Newer designs (and the Ultra Ethernet Consortium’s transport) add selective retransmit and packet spraying so the fabric can tolerate some loss.',
      },
    ],
    takeaways: [
      'RDMA lets NICs move data between registered memory regions without the CPU or kernel.',
      'GPUDirect RDMA moves data straight between GPU memory and the network.',
      'InfiniBand is natively lossless; RoCE v2 runs RDMA over Ethernet and needs a carefully tuned fabric.',
    ],
    quiz: [
      { q: 'What does RDMA remove from the data path?', options: ['The switches', 'The CPU and kernel memory copies', 'The cables'], answer: 1, why: 'The NIC performs the transfer directly between registered memory regions.' },
    ],
  },
  {
    id: 'allreduce',
    chapter: 'ai',
    level: 'intermediate',
    title: 'Collectives: ring all‑reduce',
    blurb: 'How 4 (or 40,000) GPUs sum their gradients without a central bottleneck.',
    minutes: 6,
    widget: 'collective',
    nodes: [
      N('g0', 'gpu', 'GPU 0', 0, 0),
      N('g1', 'gpu', 'GPU 1', 600, 0),
      N('g2', 'gpu', 'GPU 2', 600, 340),
      N('g3', 'gpu', 'GPU 3', 0, 340),
      N('ps', 'server', 'Parameter server', 300, 170),
    ],
    links: [['g0', 'g1'], ['g1', 'g2'], ['g2', 'g3'], ['g3', 'g0'], ['g0', 'ps'], ['g1', 'ps'], ['g2', 'ps'], ['g3', 'ps']],
    steps: [
      {
        say: 'In data‑parallel training each GPU has a full copy of the model and trains on different data. After each step they must all agree: every GPU needs the sum (average) of everyone’s gradients. That operation is called all‑reduce.',
        tables: { g0: { title: 'Gradients (GPU 0)', cols: ['a', 'b', 'c', 'd'], rows: [['1', '2', '3', '4']] } },
      },
      {
        say: 'The naive way: everyone sends to one server, it adds them up and sends the result back. That server’s network link carries N copies of the model in and N out. With thousands of GPUs it is hopeless.',
        msgs: [
          { from: 'g0', to: 'ps', label: 'grads', c: 'blue' },
          { from: 'g1', to: 'ps', label: 'grads', c: 'teal', par: true },
          { from: 'g2', to: 'ps', label: 'grads', c: 'violet', par: true },
          { from: 'g3', to: 'ps', label: 'grads', c: 'amber', par: true },
          { from: 'ps', to: 'g0', label: 'sum', c: 'green' },
          { from: 'ps', to: 'g1', label: 'sum', c: 'green', par: true },
          { from: 'ps', to: 'g2', label: 'sum', c: 'green', par: true },
          { from: 'ps', to: 'g3', label: 'sum', c: 'green', par: true },
        ],
        focus: ['ps'],
        note: { x: 180, y: 260, text: 'one link carries everything' },
      },
      {
        say: 'Ring all‑reduce: arrange GPUs in a ring and cut each gradient buffer into N chunks. Phase 1, reduce‑scatter: every GPU sends one chunk to its right neighbour, which adds its own copy and passes it on. All links are busy at the same time.',
        msgs: [
          { from: 'g0', to: 'g1', label: 'chunk a', c: 'blue' },
          { from: 'g1', to: 'g2', label: 'chunk b', c: 'teal', par: true },
          { from: 'g2', to: 'g3', label: 'chunk c', c: 'violet', par: true },
          { from: 'g3', to: 'g0', label: 'chunk d', c: 'amber', par: true },
          { from: 'g0', to: 'g1', label: 'd (+)', c: 'amber' },
          { from: 'g1', to: 'g2', label: 'a (+)', c: 'blue', par: true },
          { from: 'g2', to: 'g3', label: 'b (+)', c: 'teal', par: true },
          { from: 'g3', to: 'g0', label: 'c (+)', c: 'violet', par: true },
          { from: 'g0', to: 'g1', label: 'c (+)', c: 'violet' },
          { from: 'g1', to: 'g2', label: 'd (+)', c: 'amber', par: true },
          { from: 'g2', to: 'g3', label: 'a (+)', c: 'blue', par: true },
          { from: 'g3', to: 'g0', label: 'b (+)', c: 'teal', par: true },
        ],
      },
      {
        say: 'After N−1 steps each GPU holds one fully summed chunk. Phase 2, all‑gather: pass the finished chunks around the ring N−1 more times, so everyone ends up with every summed chunk.',
        msgs: [
          { from: 'g0', to: 'g1', label: 'Σb', c: 'green' },
          { from: 'g1', to: 'g2', label: 'Σc', c: 'green', par: true },
          { from: 'g2', to: 'g3', label: 'Σd', c: 'green', par: true },
          { from: 'g3', to: 'g0', label: 'Σa', c: 'green', par: true },
        ],
        tables: { g0: { title: 'Gradients (GPU 0)', cols: ['a', 'b', 'c', 'd'], rows: [['Σa', 'Σb', 'Σc', 'Σd']], fresh: [0] } },
      },
      {
        say: 'Each GPU sends and receives only about 2× the model size, regardless of how many GPUs there are. The work is perfectly spread across links. Libraries like NCCL pick ring, tree or other algorithms automatically.',
        deep: 'Bytes sent per GPU = 2·(N−1)/N · S. Rings are bandwidth‑optimal but latency grows with N (2(N−1) steps), so large jobs use trees, hierarchical (NVLink first, then network) or in‑network reduction (NVIDIA SHARP does the sums inside switches). Other collectives: all‑gather and reduce‑scatter (FSDP/ZeRO), all‑to‑all (mixture‑of‑experts), broadcast.',
      },
      {
        say: 'The catch: a ring is only as fast as its slowest link. One congested port or one slow GPU stalls the whole ring, and with it thousands of GPUs. That is why AI networks obsess over tail latency, not averages.',
        msgs: [{ from: 'g2', to: 'g3', label: 'slow link…', c: 'red' }],
        note: { x: 220, y: 420, text: 'everyone waits for the slowest hop' },
      },
    ],
    takeaways: [
      'All‑reduce sums gradients across GPUs every training step.',
      'Ring all‑reduce = reduce‑scatter + all‑gather; ~2× model size per GPU, all links busy.',
      'Collectives are gated by the slowest link: tail latency rules.',
    ],
    quiz: [
      { q: 'You double the number of GPUs in a ring all‑reduce. Roughly how much data does each GPU send?', options: ['Twice as much', 'About the same', 'Half as much'], answer: 1, why: '2·(N−1)/N·S approaches 2S as N grows, so it barely changes. Latency (number of steps) does grow.' },
    ],
  },
  {
    id: 'parallelism',
    chapter: 'ai',
    level: 'intermediate',
    title: 'Parallelism & traffic patterns',
    blurb: 'Data, tensor, pipeline and expert parallelism each put a different load on the network.',
    minutes: 6,
    widget: 'parallelism',
    nodes: [
      N('a0', 'gpu', 'GPU 0', 0, 0, 'server 1'),
      N('a1', 'gpu', 'GPU 1', 0, 300, 'server 1'),
      N('nv1', 'nvswitch', 'NVLink', 200, 150),
      N('ib', 'ibswitch', 'Back‑end fabric', 480, 150),
      N('nv2', 'nvswitch', 'NVLink', 760, 150),
      N('b0', 'gpu', 'GPU 8', 960, 0, 'server 2'),
      N('b1', 'gpu', 'GPU 9', 960, 300, 'server 2'),
    ],
    links: [['a0', 'nv1'], ['a1', 'nv1'], ['nv1', 'ib', '400G × 8'], ['ib', 'nv2', '400G × 8'], ['nv2', 'b0'], ['nv2', 'b1']],
    steps: [
      {
        say: 'A model too big or too slow for one GPU gets split up. There are a few ways to split it, and each creates a different traffic pattern. Real jobs combine them (“3D” or “4D” parallelism).',
      },
      {
        say: 'Tensor parallelism splits each layer’s matrices across GPUs. They exchange partial results inside every layer, many times per step. Very chatty, latency‑sensitive, so it stays inside the NVLink domain.',
        msgs: [
          { from: 'a0', to: 'a1', label: 'all‑reduce (every layer)', c: 'pink' },
          { from: 'a1', to: 'a0', label: 'all‑reduce', c: 'pink', par: true },
          { from: 'b0', to: 'b1', label: 'all‑reduce', c: 'pink', par: true },
        ],
        focus: ['a0', 'a1', 'b0', 'b1'],
      },
      {
        say: 'Pipeline parallelism gives each group of GPUs a slice of the layers. Activations flow forward from stage to stage and gradients flow back. Point‑to‑point, moderate volume, fine over the scale‑out network.',
        msgs: [
          { from: 'a0', to: 'b0', label: 'activations →', c: 'blue' },
          { from: 'b0', to: 'a0', label: '← gradients', c: 'violet' },
        ],
      },
      {
        say: 'Data parallelism copies the model and splits the batch. Once per step, everyone all‑reduces their gradients. Large, bursty and synchronised: every GPU hits the network at the same moment.',
        msgs: [
          { from: 'a0', to: 'b0', label: 'grad all‑reduce', c: 'teal' },
          { from: 'a1', to: 'b1', label: 'grad all‑reduce', c: 'teal', par: true },
        ],
        deep: 'FSDP/ZeRO shards parameters and optimizer state too, replacing one all‑reduce with an all‑gather before each layer and a reduce‑scatter after, which means more frequent traffic overlapped with compute.',
      },
      {
        say: 'Expert parallelism (mixture‑of‑experts) sends each token to the GPUs holding its chosen experts. That is an all‑to‑all: every GPU sends to every other GPU. It is the hardest pattern for a network because of the many‑to‑one collisions it creates.',
        msgs: [
          { from: 'a0', to: 'b1', label: 'tokens', c: 'amber' },
          { from: 'a1', to: 'b0', label: 'tokens', c: 'amber', par: true },
          { from: 'b0', to: 'a1', label: 'tokens', c: 'amber', par: true },
          { from: 'b1', to: 'a0', label: 'tokens', c: 'amber', par: true },
        ],
      },
      {
        say: 'Rule of thumb: chattiest inside the box (tensor), then pipeline across nearby nodes, data parallel across the whole cluster. Compare the patterns on the right.',
      },
    ],
    takeaways: [
      'Tensor parallel: per‑layer all‑reduce, needs NVLink.',
      'Pipeline: point‑to‑point activations between stages.',
      'Data parallel: one big synchronised all‑reduce per step. MoE: all‑to‑all.',
    ],
    quiz: [
      { q: 'Which parallelism produces all‑to‑all traffic?', options: ['Pipeline', 'Expert (MoE)', 'Data'], answer: 1, why: 'Tokens are routed to whichever GPUs hold their experts, so every GPU may send to every other.' },
    ],
  },
  {
    id: 'incast',
    chapter: 'ai',
    level: 'intermediate',
    title: 'Incast, ECN & lossless Ethernet',
    blurb: 'When many senders hit one port at once, buffers overflow in microseconds.',
    minutes: 5,
    sandbox: 'checkpoint',
    nodes: [
      N('s1', 'gpu', 'Sender 1', 0, 0),
      N('s2', 'gpu', 'Sender 2', 0, 160),
      N('s3', 'gpu', 'Sender 3', 0, 320),
      N('s4', 'gpu', 'Sender 4', 0, 480),
      N('sw', 'ibswitch', 'Switch', 380, 240, 'shallow buffer'),
      N('r', 'gpu', 'Receiver', 760, 240, 'one 400G port'),
    ],
    links: [['s1', 'sw'], ['s2', 'sw'], ['s3', 'sw'], ['s4', 'sw'], ['sw', 'r', '400G']],
    steps: [
      {
        say: 'Incast: many senders transmit to one receiver at the same instant. Four 400 Gb/s senders into one 400 Gb/s port means 3/4 of the traffic has to wait in the switch buffer, and switch buffers are only a few tens of megabytes shared across all ports.',
        msgs: [
          { from: 's1', to: 'r', label: '400G', c: 'blue' },
          { from: 's2', to: 'r', label: '400G', c: 'teal', par: true },
          { from: 's3', to: 'r', label: '400G', c: 'violet', par: true },
          { from: 's4', to: 'r', label: '400G', c: 'amber', par: true },
        ],
      },
      {
        say: 'On ordinary Ethernet the buffer overflows and packets are dropped. For TCP that is a retransmit timeout; for RDMA it can mean resending a whole window. Either way the collective stalls.',
        msgs: [
          { from: 's3', to: 'sw', label: 'dropped', c: 'red', drop: true },
          { from: 's4', to: 'sw', label: 'dropped', c: 'red', drop: true, par: true },
        ],
      },
      {
        say: 'ECN (explicit congestion notification): instead of dropping, the switch marks packets when its queue passes a threshold. The receiver echoes the mark back and senders slow down before the buffer overflows. DCQCN is the RoCE version of this.',
        msgs: [
          { from: 'sw', to: 'r', label: 'CE‑marked', c: 'amber', h: { l3: { ECN: '11 (congestion experienced)' } } },
          { from: 'r', to: 's1', label: 'CNP: slow down', c: 'amber', via: ['r', 'sw', 's1'] },
          { from: 'r', to: 's2', label: 'CNP', c: 'amber', via: ['r', 'sw', 's2'], par: true },
        ],
      },
      {
        say: 'PFC (priority flow control) is the emergency brake: when the buffer is nearly full, the switch sends a PAUSE frame telling the upstream port to stop sending that traffic class for a moment. Nothing is dropped.',
        deep: 'PFC is a blunt tool. Pauses can spread backwards through the fabric (congestion spreading, head‑of‑line blocking of innocent flows) and in rare cases deadlock. Good RoCE designs use ECN/DCQCN to keep queues short so PFC almost never fires.',
        msgs: [
          { from: 'sw', to: 's3', label: 'PAUSE', c: 'red' },
          { from: 'sw', to: 's4', label: 'PAUSE', c: 'red', par: true },
        ],
      },
      {
        say: 'Newer approaches attack the problem at the source: spray each flow’s packets across all paths instead of hashing it to one, schedule collectives to avoid collisions, and let receivers grant credit before senders transmit.',
        deep: 'Adaptive routing (InfiniBand, Spectrum‑X), packet spraying with out‑of‑order delivery (Ultra Ethernet Transport), and receiver‑driven protocols (Homa, NDP) are all ways to keep a fabric near 100% utilised without deep queues.',
      },
    ],
    takeaways: [
      'Incast = many‑to‑one bursts that overflow shallow switch buffers.',
      'ECN marks instead of dropping; DCQCN uses it to pace RoCE senders.',
      'PFC pauses upstream ports to avoid loss, at the risk of spreading congestion.',
    ],
    quiz: [
      { q: 'What does an ECN‑capable switch do when its queue starts to build?', options: ['Drops every packet', 'Marks packets so senders slow down', 'Sends packets back to the sender'], answer: 1, why: 'ECN signals congestion early without losing data.' },
    ],
  },
  {
    id: 'inference',
    chapter: 'ai',
    level: 'beginner',
    title: 'Serving an LLM',
    blurb: 'From your prompt to streamed tokens: gateways, routers, batching and the KV cache.',
    minutes: 6,
    sandbox: 'llm',
    nodes: [
      N('u', 'client', 'You', 0, 200),
      N('gw', 'gateway', 'API gateway', 240, 200, 'auth, rate limits'),
      N('mr', 'modelrouter', 'Model router', 500, 200, 'cache‑aware'),
      N('p', 'inference', 'Prefill pool', 780, 40, 'reads the prompt'),
      N('d', 'inference', 'Decode pool', 780, 360, 'writes tokens'),
      N('kv', 'kvcache', 'KV cache', 1040, 200),
    ],
    links: [['u', 'gw', 'HTTPS'], ['gw', 'mr'], ['mr', 'p'], ['mr', 'd'], ['p', 'kv', 'RDMA'], ['kv', 'd', 'RDMA']],
    steps: [
      {
        say: 'You send a prompt. It arrives at an API gateway that checks your key, applies rate limits and picks a region, like any web API.',
        msgs: [{ from: 'u', to: 'gw', label: 'POST /v1/messages', c: 'blue', h: { l7: { method: 'POST', path: '/v1/messages', stream: 'true', prompt: '"Explain TCP in one line"' } } }],
      },
      {
        say: 'A model router chooses which GPU replica gets the request. A smart router prefers a replica that has already processed the same prompt prefix (say, a long system prompt), so it can skip that work.',
        msgs: [{ from: 'gw', to: 'mr', label: 'route', c: 'blue' }, { from: 'mr', to: 'p', label: 'prompt', c: 'violet' }],
      },
      {
        say: 'Prefill: the GPUs read the whole prompt in one big parallel pass and build the KV cache, the model’s working memory of everything so far. Prefill is compute‑heavy and decides your time‑to‑first‑token.',
        deep: 'Some systems disaggregate prefill and decode onto different GPU pools, because they stress hardware differently (prefill is compute‑bound, decode is memory‑bandwidth‑bound). The KV cache is then shipped from prefill to decode GPUs over RDMA, often gigabytes per second per request stream.',
        msgs: [{ from: 'p', to: 'kv', label: 'KV cache (GBs)', c: 'pink' }],
      },
      {
        say: 'Decode: the model generates one token at a time, each step reading the KV cache. Many users’ requests are batched together on the same GPUs (continuous batching), which is how a single replica serves dozens of conversations at once.',
        msgs: [
          { from: 'kv', to: 'd', label: 'KV', c: 'pink' },
          { from: 'd', to: 'u', label: 'token: "TCP"', c: 'green', via: ['d', 'mr', 'gw', 'u'] },
          { from: 'd', to: 'u', label: '" is"', c: 'green', via: ['d', 'mr', 'gw', 'u'] },
          { from: 'd', to: 'u', label: '" reliable…"', c: 'green', via: ['d', 'mr', 'gw', 'u'] },
        ],
      },
      {
        say: 'Tokens stream back over the same HTTP connection as Server‑Sent Events, so you see words appear as they are produced. The two numbers that matter: time to first token (TTFT) and time per output token (TPOT).',
        deep: 'Long‑lived streaming connections stress gateways and load balancers: idle timeouts, connection limits and graceful draining during deploys all matter. Queueing in front of the GPUs is what usually blows up TTFT under load; see the sandbox.',
      },
    ],
    takeaways: [
      'Gateway → router → GPU replicas, streaming tokens back via SSE.',
      'Prefill builds the KV cache (TTFT); decode generates tokens (TPOT).',
      'Cache‑aware routing and continuous batching are the big efficiency levers.',
    ],
    quiz: [
      { q: 'Why route a request to a replica that already saw the same prompt prefix?', options: ['It is closer', 'It can reuse the KV cache and skip part of the prefill', 'It has more memory'], answer: 1, why: 'Prefix caching avoids recomputing attention state for tokens it has already processed.' },
    ],
  },
]

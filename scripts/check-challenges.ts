import { newRuntime, step } from '../src/sim/engine'
import { PRESET_BY_ID } from '../src/sim/presets'
import { CHALLENGES } from '../src/sim/challenges'
import type { SimNode, SimEdge } from '../src/types'

function run(nodes: SimNode[], edges: SimEdge[], load: number, payload: number, secs = 40) {
  const rt = newRuntime()
  let r: ReturnType<typeof step> | null = null
  for (let i = 0; i < secs * 10; i++) r = step(nodes, edges, rt, load, payload)
  return r!.global
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const fixes: Record<string, (n: SimNode[], e: SimEdge[], p: { payload: number }) => void> = {
  'hold-the-line': (n) => { n.find(x => x.id === 'db')!.params.concurrency = 12 },
  'survive-the-flood': (n) => { n.find(x => x.id === 'fw')!.params.blockRate = 0.95 },
  'mind-the-tail': (_n, e) => { e[0].params.lossPct = 0.01 },
  'unbloat': (_n, e) => { e.find(x => x.id === 'r->net')!.params.bandwidthMbps = 100 },
  'feed-the-gpus': (n) => { n.find(x => x.id === 'kv')!.params.hitRate = 0.6 },
}
for (const c of CHALLENGES) {
  const p = PRESET_BY_ID[c.preset]
  const before = run(clone(p.nodes), clone(p.edges), c.load, p.payloadKB)
  const n = clone(p.nodes), e = clone(p.edges); const pp = { payload: p.payloadKB }
  fixes[c.id](n, e, pp)
  const after = run(n, e, c.load, pp.payload)
  const ok = (g: typeof before) => c.goals.every(x => { const v = g[x.metric]; return (x.max === undefined || v <= x.max) && (x.min === undefined || v >= x.min) })
  console.log(c.id.padEnd(18), 'before', fmt(before), ok(before) ? 'PASS(bad)' : 'fail(ok)', '| after', fmt(after), ok(after) ? 'PASS' : 'FAIL')
}
for (const p of Object.values(PRESET_BY_ID)) console.log('preset', p.id.padEnd(12), fmt(run(clone(p.nodes), clone(p.edges), p.offered, p.payloadKB)))
function fmt(g: { p99: number; errorPct: number; goodput: number; dropped: number }) { return `p99=${g.p99.toFixed(0)}ms err=${(g.errorPct*100).toFixed(1)}% good=${g.goodput.toFixed(0)} drop=${g.dropped.toFixed(0)}` }

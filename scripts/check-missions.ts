import { newRuntime, step } from '../src/sim/engine'
import { PRESET_BY_ID } from '../src/sim/presets'
import { MISSIONS, progressOf } from '../src/build/missions'
import { DEFAULT_LINK, defaultParams } from '../src/catalog'
import type { Kind, SimEdge, SimNode } from '../src/types'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const N = (id: string, kind: Kind, extra: Partial<SimNode['params']> = {}): SimNode => ({ id, kind, label: id, x: 0, y: 0, params: { ...defaultParams(kind), ...extra } })
const E = (from: string, to: string, p: Partial<SimEdge['params']> = {}): SimEdge => ({ id: `${from}->${to}`, from, to, params: { ...DEFAULT_LINK, ...p } })

function run(presetId: string, mut: (n: SimNode[], e: SimEdge[]) => void) {
  const p = PRESET_BY_ID[presetId]
  const nodes = clone(p.nodes), edges = clone(p.edges)
  mut(nodes, edges)
  const rt = newRuntime(); let m: any
  for (let i = 0; i < 300; i++) m = step(nodes, edges, rt, p.offered, p.payloadKB)
  return { nodes, edges, m }
}
const solutions: Record<string, (n: SimNode[], e: SimEdge[]) => void> = {
  online: (n, e) => { n.push(N('w', 'wifi'), N('r', 'nat'), N('i', 'internet')); e.push(E('lap', 'w', { bandwidthMbps: 300, latencyMs: 2 }), E('w', 'r'), E('r', 'i'), E('i', 'site', { latencyMs: 20 })) },
  launch: (n, e) => {
    e.splice(e.findIndex((x) => x.id === 'u->api'), 1)
    n.push(N('lb', 'lb'), N('s2', 'server'), N('s3', 'server'))
    e.push(E('u', 'lb', { latencyMs: 15 }), E('lb', 'api'), E('lb', 's2'), E('lb', 's3'), E('s2', 'db'), E('s3', 'db'))
  },
  far: (n, e) => {
    e.splice(e.findIndex((x) => x.id === 'u->net'), 1)
    n.push(N('cdn', 'cdn', { hitRate: 0.996 }))
    e.push(E('u', 'cdn', { latencyMs: 2 }), E('cdn', 'net', { latencyMs: 4 }))
  },
}
let bad = 0
for (const ms of MISSIONS) {
  const start = run(ms.preset, () => {})
  const solved = run(ms.preset, solutions[ms.id])
  const a = progressOf(ms, start), b = progressOf(ms, solved)
  const g = solved.m.global
  console.log(`${ms.id.padEnd(8)} start ${a}/${ms.steps.length}  solved ${b}/${ms.steps.length}  (p99 ${g.p99.toFixed(0)}ms, err ${(g.errorPct * 100).toFixed(1)}%, good ${g.goodput.toFixed(0)})`)
  if (a === ms.steps.length || b !== ms.steps.length) bad++
}
// the CDN lesson: at the default 80% hit rate p99 must still fail
const cdn80 = run('m-far', (n, e) => { solutions.far(n, e); n.find((x) => x.id === 'cdn')!.params.hitRate = 0.8 })
console.log('far @80% hit: p99', cdn80.m.global.p99.toFixed(0), 'ms', progressOf(MISSIONS[2], cdn80) === 1 ? '(step 2 correctly unmet)' : '(UNEXPECTED)')
process.exit(bad)

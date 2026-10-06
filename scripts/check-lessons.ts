import { LESSONS } from '../src/lessons'
import { GLOSSARY } from '../src/glossary'
import { PRESET_BY_ID } from '../src/sim/presets'
import { bfs } from '../src/learn/timeline'

let problems = 0
const bad = (l: string, m: string) => { problems++; console.log(`✗ ${l}: ${m}`) }
const ids = new Set<string>()
for (const l of LESSONS) {
  if (ids.has(l.id)) bad(l.id, 'duplicate id'); ids.add(l.id)
  const nodes = new Set(l.nodes.map(n => n.id))
  for (const [a, b] of l.links) for (const x of [a, b]) if (!nodes.has(x)) bad(l.id, `link → unknown ${x}`)
  l.steps.forEach((s, i) => {
    for (const m of s.msgs ?? []) {
      for (const x of [m.from, m.to, ...(m.via ?? [])]) if (!nodes.has(x)) bad(l.id, `step ${i + 1} msg → unknown ${x}`)
      if (!m.via && m.from !== m.to) {
        const p = bfs(l, m.from, m.to)
        if (p.length === 2 && !l.links.some(([a, b]) => (a === m.from && b === m.to) || (b === m.from && a === m.to))) bad(l.id, `step ${i + 1} no path ${m.from}→${m.to}`)
      }
    }
    for (const f of s.focus ?? []) if (!nodes.has(f)) bad(l.id, `step ${i + 1} focus unknown ${f}`)
    for (const k of Object.keys(s.tables ?? {})) if (!nodes.has(k)) bad(l.id, `step ${i + 1} table on unknown ${k}`)
  })
  for (const q of l.quiz ?? []) if (q.answer < 0 || q.answer >= q.options.length) bad(l.id, 'quiz answer out of range')
  if (l.sandbox && !PRESET_BY_ID[l.sandbox]) bad(l.id, `unknown sandbox ${l.sandbox}`)
}
for (const t of GLOSSARY) if (t.lesson && !ids.has(t.lesson)) bad('glossary', `${t.term} → unknown lesson ${t.lesson}`)
const steps = LESSONS.reduce((a, l) => a + l.steps.length, 0)
const deep = LESSONS.reduce((a, l) => a + l.steps.filter(s => s.deep).length, 0)
const quiz = LESSONS.reduce((a, l) => a + (l.quiz?.length ?? 0), 0)
console.log(`${LESSONS.length} lessons · ${steps} steps · ${deep} go-deeper notes · ${quiz} quiz questions · ${GLOSSARY.length} glossary terms · ${problems} problems`)
process.exit(problems ? 1 : 0)

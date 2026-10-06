import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Lightbulb, Trophy } from 'lucide-react'
import { useStore } from '../store'
import { MISSION_BY_ID, MISSIONS, progressOf } from './missions'

/** Live checklist for a build mission, shown in the sandbox's right panel. */
export function MissionPanel({ id }: { id: string }) {
  const mission = MISSION_BY_ID[id]
  const [done, setDone] = useState(0)
  const { progress, completeMission, set } = useStore()
  const solved = !!progress.missions?.[id]

  useEffect(() => {
    const tick = () => {
      const s = useStore.getState()
      const d = progressOf(mission, { nodes: s.graph.nodes, edges: s.graph.edges, m: s.metrics })
      setDone(d)
      if (d === mission.steps.length) s.completeMission(id)
    }
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [id, mission, completeMission])

  const next = MISSIONS[MISSIONS.findIndex((m) => m.id === id) + 1]
  return (
    <>
      <div className="insp-top">
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Build mission <span className={`lvl ${mission.level}`}>{mission.level}</span></div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{mission.title}</div>
        </div>
      </div>
      <div className="scroll insp-body" data-scroll>
        <div className="desc" style={{ fontSize: 14, color: 'var(--ink)' }}>{mission.brief}</div>
        <div className="sect">Steps</div>
        {mission.steps.map((st, i) => {
          const ok = i < done
          const cur = i === done
          return (
            <div key={i} className={`goal ${ok ? 'met' : ''}`} style={{ fontFamily: 'var(--font)', fontSize: 13.5, alignItems: 'flex-start', flexDirection: 'column', gap: 4, opacity: !ok && !cur ? 0.55 : 1 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {ok ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                {st.text}
              </span>
              {cur && (
                <span className="muted" style={{ fontSize: 12.5, paddingLeft: 23, display: 'flex', gap: 6 }}>
                  <Lightbulb size={13} style={{ flex: 'none', marginTop: 2, color: 'var(--accent)' }} /> {st.hint}
                </span>
              )}
            </div>
          )
        })}
        {(solved || done === mission.steps.length) && (
          <div className="verdict good" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, color: 'var(--ok)', marginBottom: 4 }}><Trophy size={15} /> Mission complete</div>
            {mission.outro}
            {next && (
              <div style={{ marginTop: 10 }}>
                <button className="btn sm primary" onClick={() => useStore.getState().loadPreset(next.preset, { mission: next.id })}>Next mission: {next.title}</button>
              </div>
            )}
          </div>
        )}
        <button className="btn sm" style={{ marginTop: 14 }} onClick={() => set({ missionId: null })}>Leave mission (keep building)</button>
      </div>
    </>
  )
}

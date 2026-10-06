import { useState } from 'react'
import { CheckCircle2, Search, Target } from 'lucide-react'
import { CAT_COLOR, CATEGORIES, KINDS } from '../catalog'
import { CHALLENGES } from '../sim/challenges'
import { PRESETS } from '../sim/presets'
import { useStore } from '../store'
import type { Kind } from '../types'

type Tab = 'scenarios' | 'challenges' | 'parts'

export function Palette({ onAdd }: { onAdd: (k: Kind) => void }) {
  const [tab, setTab] = useState<Tab>('scenarios')
  const [q, setQ] = useState('')
  const { presetId, challengeId, loadPreset, progress } = useStore()
  const query = q.trim().toLowerCase()
  const kinds = (Object.keys(KINDS) as Kind[]).filter((k) => KINDS[k].palette)
  const solved = CHALLENGES.filter((c) => progress.challenges[c.id]).length

  return (
    <>
      <div className="subtabs" role="tablist">
        <button className={tab === 'scenarios' ? 'on' : ''} onClick={() => setTab('scenarios')}>Scenarios</button>
        <button className={tab === 'challenges' ? 'on' : ''} onClick={() => setTab('challenges')}>Challenges</button>
        <button className={tab === 'parts' ? 'on' : ''} onClick={() => setTab('parts')}>Parts</button>
      </div>

      {tab === 'parts' && (
        <>
          <div style={{ padding: '0 12px 4px' }}>
            <div className="search">
              <Search size={15} className="muted" />
              <input placeholder="Search parts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search parts" />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>Drag onto the bench or click to add. Hover a device and drag its ＋ port to wire it.</p>
          </div>
          <div className="scroll">
            {CATEGORIES.map((c) => {
              const items = kinds.filter((k) => KINDS[k].cat === c.id && (!query || KINDS[k].label.toLowerCase().includes(query) || KINDS[k].desc.toLowerCase().includes(query)))
              if (!items.length) return null
              return (
                <div key={c.id} className="pal-group">
                  <div className="pal-label">{c.label}</div>
                  <div className="pal-grid">
                    {items.map((k) => {
                      const info = KINDS[k]
                      const Icon = info.icon
                      return (
                        <button
                          key={k}
                          className="pal-tile"
                          style={{ ['--cat' as string]: CAT_COLOR[info.cat] }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/x-kind', k)
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => onAdd(k)}
                          title={info.desc}
                        >
                          <span className="disc"><Icon size={16} /></span>
                          {info.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{ height: 14 }} />
          </div>
        </>
      )}

      {tab === 'scenarios' && (
        <div className="scroll">
          <div className="card-list">
            <p className="muted" style={{ fontSize: 12.5, margin: '0 2px' }}>Ready‑made systems with a note on the bench telling you what to try.</p>
            {PRESETS.map((p) => (
              <button key={p.id} className={`scn${presetId === p.id && !challengeId ? ' on' : ''}`} onClick={() => loadPreset(p.id)}>
                <b>{p.title} <span className={`lvl ${p.level}`} style={{ marginLeft: 'auto' }}>{p.level === 'beginner' ? 'beg' : 'int'}</span></b>
                <span className="d">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'challenges' && (
        <div className="scroll">
          <div className="card-list">
            <p className="muted" style={{ fontSize: 12.5, margin: '0 2px' }}>
              Each design ships broken. Make one change that meets the goals and hold them for 5 seconds. <b className="mono">{solved}/{CHALLENGES.length}</b> solved.
            </p>
            {CHALLENGES.map((c) => (
              <button key={c.id} className={`scn${challengeId === c.id ? ' on' : ''}`} onClick={() => loadPreset(c.preset, { load: c.load, challenge: c.id })}>
                <b>
                  {progress.challenges[c.id] ? <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} /> : <Target size={15} style={{ color: 'var(--accent)' }} />}
                  {c.title}
                  <span className={`lvl ${c.level}`} style={{ marginLeft: 'auto' }}>{c.level === 'beginner' ? 'beg' : 'int'}</span>
                </b>
                <span className="d">{c.brief}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

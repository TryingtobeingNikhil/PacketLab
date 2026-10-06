import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store'
import { commentate, type Commentary as C } from './narrate'

const TONE: Record<C['tone'], string> = { good: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', idle: 'var(--muted)' }
const LABEL: Record<C['tone'], string> = { good: 'Live · healthy', warn: 'Live · watch this', bad: 'Live · breaking', idle: 'Getting started' }

/** Plain-language commentary over the bench, refreshed twice a second so it can be read. */
export function Commentary() {
  const [c, setC] = useState<C>(() => {
    const s = useStore.getState()
    return commentate(s.graph.nodes, s.graph.edges, s.metrics, s.payloadKB)
  })
  const [min, setMin] = useState(false)
  useEffect(() => {
    const tick = () => {
      const s = useStore.getState()
      setC(commentate(s.graph.nodes, s.graph.edges, s.metrics, s.payloadKB))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`commentary${min ? ' min' : ''}`} style={{ ['--tone' as string]: TONE[c.tone] }} aria-live="polite">
      <div className="ct-top">
        <span className="live-dot" />
        <span className="eyebrow">{LABEL[c.tone]}</span>
        <button className="ibtn sm" onClick={() => setMin(!min)} aria-label={min ? 'Expand commentary' : 'Collapse commentary'}>
          {min ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!min && (
        <>
          <h3>{c.headline}</h3>
          {c.detail && <p>{c.detail}</p>}
        </>
      )}
    </div>
  )
}

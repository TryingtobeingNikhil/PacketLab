import type { Layer, Lesson, Msg } from '../types'

const LAYERS: { k: Layer; name: string; tag: string; c: string }[] = [
  { k: 'l2', name: 'Ethernet frame', tag: 'L2', c: 'var(--c-amber)' },
  { k: 'l3', name: 'IP packet', tag: 'L3', c: 'var(--c-teal)' },
  { k: 'l4', name: 'Transport segment', tag: 'L4', c: 'var(--c-blue)' },
  { k: 'l7', name: 'Application data', tag: 'L7', c: 'var(--c-violet)' },
  { k: 'x', name: 'Protocol payload', tag: '…', c: 'var(--c-pink)' },
]

export function PacketInspector({ msg, lesson }: { msg: Msg; lesson: Lesson }) {
  const name = (id: string) => lesson.nodes.find((n) => n.id === id)?.label ?? id
  const h = msg.h ?? {}
  const present = LAYERS.filter((l) => h[l.k])
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{msg.label}</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {msg.from === msg.to ? `inside ${name(msg.from)}` : `${name(msg.from)} → ${name(msg.to)}`}
        {msg.drop && <span style={{ color: 'var(--bad)' }}> · this one gets lost</span>}
      </div>
      {present.length ? (
        <div className="anatomy">
          {present.map((l) => (
            <div key={l.k} className="anat-row" style={{ ['--lc' as string]: l.c }}>
              <span className="tag">{l.tag}</span>
              <span className="nm">{l.name}</span>
              <dl>
                {Object.entries(h[l.k]!).map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>Outermost header first, like the bytes on the wire.</p>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>No header detail for this message. Messages with a full anatomy appear throughout the lessons.</p>
      )}
    </div>
  )
}

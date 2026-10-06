import type { Lesson } from '../types'
import { describe } from './describe'
import { COLORS, type Timeline } from './timeline'

/** Narrates the packet that is moving right now, directly on the canvas. */
export function LiveCaption({ lesson, timeline, idx }: { lesson: Lesson; timeline: Timeline; idx: number }) {
  const tm = timeline.msgs[idx]
  if (!tm) {
    if (!timeline.msgs.length)
      return (
        <div className="live-caption waiting" aria-live="polite">
          <span className="live-dot" />
          <span>This step sets the scene: read it in the lesson panel, then press <b style={{ color: 'var(--ink)' }}>Next step</b>.</span>
        </div>
      )
    return (
      <div className="live-caption waiting" aria-live="polite">
        <span className="live-dot" />
        <span>Watch the diagram: {timeline.msgs.length === 1 ? 'a packet is' : `${timeline.msgs.length} packets are`} about to move.</span>
      </div>
    )
  }
  const d = describe(tm.msg, lesson, tm.path)
  return (
    <div className="live-caption" key={idx} aria-live="polite">
      <div className="lc-top">
        <i style={{ background: COLORS[tm.msg.c ?? 'blue'] }} />
        <span className="lc-label">{tm.msg.label}</span>
        <span className="lc-count">{idx + 1} / {timeline.msgs.length}</span>
      </div>
      <p>
        {d.lead}
        {d.detail && <span> {d.detail}</span>}
      </p>
    </div>
  )
}

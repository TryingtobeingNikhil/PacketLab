import type { ReactNode } from 'react'
import { CAT_COLOR, KINDS } from '../catalog'
import type { Kind } from '../types'

export const utilColor = (u: number) => (u >= 0.95 ? 'var(--bad)' : u >= 0.75 ? 'var(--warn)' : 'var(--ok)')

interface Props {
  kind: Kind
  x: number
  y: number
  r: number
  label: string
  sub?: string
  chip?: ReactNode
  chipBad?: boolean
  /** utilisation ring, 0..1+ */
  ring?: number
  /** fixed ring colour (otherwise coloured by load) */
  ringColor?: string
  /** draw as an empty dashed slot with a question mark */
  ghost?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
  nodeId?: string
  children?: ReactNode
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
}

/** A network device drawn as a round puck with an optional load ring. Positioned by its centre. */
export function Puck({ kind, x, y, r, label, sub, chip, chipBad, ring, ringColor, ghost, className = '', nodeId, children, onPointerDown, onPointerMove, onPointerUp, onClick }: Props) {
  const info = KINDS[kind]
  const Icon = info.icon
  const R = r + 7
  const C = 2 * Math.PI * R
  const u = Math.max(0, Math.min(1, ring ?? 0))
  return (
    <div className={`puck ${className}`} style={{ left: x, top: y, ['--cat' as string]: CAT_COLOR[info.cat], ['--r' as string]: `${r}px` }} data-node={nodeId}>
      {ring !== undefined && (
        <svg className="ring" width={R * 2 + 6} height={R * 2 + 6} style={{ left: -R - 3, top: -R - 3 }} aria-hidden>
          <circle cx={R + 3} cy={R + 3} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={4} />
          <circle
            cx={R + 3}
            cy={R + 3}
            r={R}
            fill="none"
            stroke={ringColor ?? utilColor(ring)}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${C * u} ${C}`}
            transform={`rotate(-90 ${R + 3} ${R + 3})`}
            style={{ transition: 'stroke-dasharray .35s, stroke .35s' }}
          />
        </svg>
      )}
      <div className={`disc${ghost ? ' ghost' : ''}`}>
        {ghost ? <span className="q">?</span> : <Icon size={Math.round(r * 0.72)} strokeWidth={1.9} />}
      </div>
      <div className="hit" title={ghost ? 'Something is missing here' : `${label}: ${info.desc}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={onClick} />
      {children}
      <div className="lbl">
        <b>{ghost ? '???' : label}</b>
        {sub && !ghost && <small>{sub}</small>}
        {chip !== undefined && <span className={`chip${chipBad ? ' bad' : ''}`}>{chip}</span>}
      </div>
    </div>
  )
}

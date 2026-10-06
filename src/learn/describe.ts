import type { Lesson, Msg } from '../types'

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/**
 * One plain-language sentence for the packet that is moving right now, so the
 * canvas always has words next to the motion. Authored `why` text wins; otherwise
 * the sentence is built from the route, the headers and what happens to the packet.
 */
export function describe(m: Msg, lesson: Lesson, path: string[]): { lead: string; detail?: string } {
  const name = (id: string) => lesson.nodes.find((n) => n.id === id)?.label ?? id
  const label = `“${m.label}”`

  if (m.from === m.to) {
    return { lead: `${name(m.from)} prepares ${label}.`, detail: m.why ?? 'Nothing has left the machine yet: this is the data being built up inside it.' }
  }

  const hops = path.slice(1, -1).map(name)
  let lead = `${name(m.from)} sends ${label} to ${name(m.to)}`
  if (hops.length === 1) lead += ` through ${hops[0]}`
  else if (hops.length > 1) lead += `, hopping through ${list(hops)}`
  if (m.burst && m.burst > 1) lead += ` as a burst of ${m.burst} packets`

  if (m.drop) {
    const k = Math.max(0, Math.min(path.length - 2, Math.floor((path.length - 1) * 0.6)))
    return {
      lead: `${lead}…`,
      detail: m.why ?? `…but it never arrives. It is lost after ${name(path[k])}, so the sender will have to notice and try again.`,
    }
  }

  if (m.why) return { lead: `${lead}.`, detail: m.why }

  const h = m.h ?? {}
  const notes: string[] = []
  const dstMac = h.l2?.dst_mac ?? ''
  if (dstMac.startsWith('ff:ff') || /broadcast|flood/i.test(m.label)) notes.push('It is a broadcast, so every device on the local network gets a copy.')
  if (h.l4?.proto === 'UDP') notes.push('It rides on UDP: no handshake and no retransmission if it is lost.')
  if (h.l3?.TTL) notes.push(`Its TTL is ${h.l3.TTL}; every router on the way subtracts one.`)
  if (!notes.length && (h.l2 || h.l3 || h.l4 || h.l7 || h.x)) notes.push('Its full headers are listed in the step panel.')
  return { lead: `${lead}.`, detail: notes[0] }
}

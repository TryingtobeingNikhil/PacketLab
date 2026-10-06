import type { Kind, LNode } from '../types'

export const N = (id: string, kind: Kind, label: string, x: number, y: number, sub?: string): LNode => ({ id, kind, label, x, y, sub })

export const MAC = {
  a: 'aa:aa:aa:00:00:0a',
  b: 'bb:bb:bb:00:00:0b',
  c: 'cc:cc:cc:00:00:0c',
  d: 'dd:dd:dd:00:00:0d',
  r: '00:00:5e:00:01:01',
  bc: 'ff:ff:ff:ff:ff:ff',
}

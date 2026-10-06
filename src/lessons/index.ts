import type { Chapter, Lesson } from '../types'
import { foundations } from './foundations'
import { local } from './local'
import { ip } from './ip'
import { transport } from './transport'
import { app } from './app'
import { infra } from './infra'
import { ai } from './ai'

export const CHAPTERS: Chapter[] = [
  { id: 'start', title: 'Foundations', icon: 'Layers' },
  { id: 'local', title: 'Local networks · L1–L2', icon: 'EthernetPort' },
  { id: 'ip', title: 'IP & routing · L3', icon: 'Router' },
  { id: 'transport', title: 'Transport · L4', icon: 'Repeat' },
  { id: 'app', title: 'Applications · L7', icon: 'Globe' },
  { id: 'infra', title: 'Networks at scale', icon: 'Server' },
  { id: 'ai', title: 'AI infrastructure', icon: 'Cpu' },
]

export const LESSONS: Lesson[] = [...foundations, ...local, ...ip, ...transport, ...app, ...infra, ...ai]

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]))

export function nextLesson(id: string, level?: 'beginner' | 'intermediate'): Lesson | undefined {
  const i = LESSONS.findIndex((l) => l.id === id)
  for (let j = i + 1; j < LESSONS.length; j++) {
    if (!level || level === 'intermediate' || LESSONS[j].level === 'beginner') return LESSONS[j]
  }
  return undefined
}

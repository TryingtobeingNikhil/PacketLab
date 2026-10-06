import { create } from 'zustand'
import { DEFAULT_LINK, defaultParams, KINDS } from './catalog'
import { PRESET_BY_ID, PRESETS } from './sim/presets'
import { newRuntime, type SimResult, type SimRuntime } from './sim/engine'
import { CHALLENGE_BY_ID } from './sim/challengeIndex'
import type { Kind, Level, LinkParams, NodeParams, Note, SimEdge, SimNode } from './types'

export type Mode = 'learn' | 'sandbox'
export type Selection = { type: 'node' | 'edge' | 'note'; id: string } | null

interface Graph {
  nodes: SimNode[]
  edges: SimEdge[]
  notes: Note[]
}

interface Progress {
  done: Record<string, boolean>
  quiz: Record<string, number> // lesson -> correct answers
  challenges: Record<string, boolean>
}

interface State {
  mode: Mode
  theme: 'dark' | 'light'
  level: Level
  welcomed: boolean
  glossaryOpen: boolean
  shortcutsOpen: boolean
  leftOpen: boolean
  rightOpen: boolean
  /** learn mode: the course outline drawer */
  courseOpen: boolean

  // learn
  lessonId: string
  stepIdx: number
  autoplay: boolean
  speed: number
  progress: Progress

  // sandbox
  presetId: string | null
  challengeId: string | null
  hintsShown: number
  graph: Graph
  past: Graph[]
  future: Graph[]
  offered: number
  payloadKB: number
  running: boolean
  selection: Selection
  metrics: SimResult | null
  runtime: SimRuntime
  fitKey: number

  set: (p: Partial<State>) => void
  setMode: (m: Mode) => void
  toggleTheme: () => void
  openLesson: (id: string, step?: number) => void
  setStep: (i: number) => void
  markDone: (id: string, quiz?: number) => void

  loadPreset: (id: string, opts?: { load?: number; challenge?: string | null }) => void
  loadGraph: (g: Graph, offered?: number, payloadKB?: number) => void
  clearCanvas: () => void
  commit: () => void
  undo: () => void
  redo: () => void
  addNode: (kind: Kind, x: number, y: number) => string
  moveNode: (id: string, x: number, y: number) => void
  updateNode: (id: string, p: Partial<NodeParams>, label?: string) => void
  removeSelected: () => void
  connect: (from: string, to: string) => void
  updateEdge: (id: string, p: Partial<LinkParams>) => void
  updateNote: (id: string, text: string) => void
  addNote: (x: number, y: number) => void
  moveNote: (id: string, x: number, y: number) => void
  resetSim: () => void
  completeChallenge: (id: string) => void
}

const LS = 'packetlab:v1'
function loadSaved(): Partial<State> {
  try {
    const raw = localStorage.getItem(LS)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
let lastSaved = ''
function save(s: State) {
  const json = JSON.stringify({
    theme: s.theme, level: s.level, welcomed: s.welcomed, mode: s.mode, lessonId: s.lessonId,
    progress: s.progress, speed: s.speed, autoplay: s.autoplay,
  })
  if (json === lastSaved) return
  lastSaved = json
  try {
    localStorage.setItem(LS, json)
  } catch {
    /* storage unavailable */
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
let uid = 0
const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`

const saved = loadSaved()
const first = PRESETS[0]

export const useStore = create<State>((set, get) => ({
  mode: saved.mode ?? 'learn',
  theme: saved.theme ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  level: saved.level ?? 'beginner',
  welcomed: saved.welcomed ?? false,
  glossaryOpen: false,
  shortcutsOpen: false,
  leftOpen: typeof innerWidth === 'undefined' ? true : innerWidth > 1000,
  rightOpen: typeof innerWidth === 'undefined' ? true : innerWidth > 1000,
  courseOpen: false,

  lessonId: saved.lessonId ?? 'what-is-a-network',
  stepIdx: 0,
  autoplay: saved.autoplay ?? false,
  speed: saved.speed ?? 1,
  progress: { done: {}, quiz: {}, challenges: {}, ...(saved.progress ?? {}) },

  presetId: first.id,
  challengeId: null,
  hintsShown: 0,
  graph: { nodes: clone(first.nodes), edges: clone(first.edges), notes: clone(first.notes) },
  past: [],
  future: [],
  offered: first.offered,
  payloadKB: first.payloadKB,
  running: true,
  selection: null,
  metrics: null,
  runtime: newRuntime(),
  fitKey: 0,

  set: (p) => set(p),
  setMode: (mode) => set({ mode, selection: null }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
  openLesson: (id, step = 0) => set({ lessonId: id, stepIdx: step, mode: 'learn', courseOpen: false }),
  setStep: (i) => set({ stepIdx: i }),
  markDone: (id, quiz) => {
    const p = get().progress
    set({
      progress: {
        ...p,
        done: { ...p.done, [id]: true },
        quiz: quiz === undefined ? p.quiz : { ...p.quiz, [id]: Math.max(quiz, p.quiz[id] ?? 0) },
      },
    })
  },

  loadPreset: (id, opts = {}) => {
    const pr = PRESET_BY_ID[id]
    if (!pr) return
    set({
      presetId: id,
      challengeId: opts.challenge ?? null,
      hintsShown: 0,
      graph: { nodes: clone(pr.nodes), edges: clone(pr.edges), notes: clone(pr.notes) },
      past: [],
      future: [],
      offered: opts.load ?? pr.offered,
      payloadKB: pr.payloadKB,
      selection: null,
      metrics: null,
      runtime: newRuntime(),
      running: true,
      mode: 'sandbox',
      fitKey: get().fitKey + 1,
    })
  },
  loadGraph: (g, offered, payloadKB) =>
    set({
      presetId: null, challengeId: null, graph: g, past: [], future: [], selection: null, metrics: null,
      runtime: newRuntime(), offered: offered ?? get().offered, payloadKB: payloadKB ?? get().payloadKB,
      mode: 'sandbox', fitKey: get().fitKey + 1,
    }),
  clearCanvas: () => {
    get().commit()
    set({ graph: { nodes: [], edges: [], notes: [] }, presetId: null, challengeId: null, selection: null, metrics: null, runtime: newRuntime() })
  },
  commit: () => {
    const { graph, past } = get()
    set({ past: [...past.slice(-60), clone(graph)], future: [] })
  },
  undo: () => {
    const { past, graph, future } = get()
    if (!past.length) return
    set({ graph: past[past.length - 1], past: past.slice(0, -1), future: [clone(graph), ...future], selection: null })
  },
  redo: () => {
    const { past, graph, future } = get()
    if (!future.length) return
    set({ graph: future[0], future: future.slice(1), past: [...past, clone(graph)], selection: null })
  },
  addNode: (kind, x, y) => {
    get().commit()
    const id = newId('n')
    const g = get().graph
    const same = g.nodes.filter((n) => n.kind === kind).length
    const label = KINDS[kind].label + (same ? ` ${same + 1}` : '')
    set({ graph: { ...g, nodes: [...g.nodes, { id, kind, label, x, y, params: defaultParams(kind) }] }, selection: { type: 'node', id } })
    return id
  },
  moveNode: (id, x, y) => {
    const g = get().graph
    set({ graph: { ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) } })
  },
  updateNode: (id, p, label) => {
    const g = get().graph
    set({ graph: { ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, label: label ?? n.label, params: { ...n.params, ...p } } : n)) } })
  },
  removeSelected: () => {
    const { selection, graph } = get()
    if (!selection) return
    get().commit()
    if (selection.type === 'node') {
      set({
        graph: {
          ...graph,
          nodes: graph.nodes.filter((n) => n.id !== selection.id),
          edges: graph.edges.filter((e) => e.from !== selection.id && e.to !== selection.id),
        },
        selection: null,
      })
    } else if (selection.type === 'edge') {
      set({ graph: { ...graph, edges: graph.edges.filter((e) => e.id !== selection.id) }, selection: null })
    } else {
      set({ graph: { ...graph, notes: graph.notes.filter((n) => n.id !== selection.id) }, selection: null })
    }
  },
  connect: (from, to) => {
    const g = get().graph
    if (from === to || g.edges.some((e) => e.from === from && e.to === to)) return
    get().commit()
    const id = `${from}->${to}`
    set({ graph: { ...g, edges: [...g.edges, { id, from, to, params: { ...DEFAULT_LINK } }] }, selection: { type: 'edge', id } })
  },
  updateEdge: (id, p) => {
    const g = get().graph
    set({ graph: { ...g, edges: g.edges.map((e) => (e.id === id ? { ...e, params: { ...e.params, ...p } } : e)) } })
  },
  updateNote: (id, text) => {
    const g = get().graph
    set({ graph: { ...g, notes: g.notes.map((n) => (n.id === id ? { ...n, text } : n)) } })
  },
  addNote: (x, y) => {
    get().commit()
    const id = newId('note')
    const g = get().graph
    set({ graph: { ...g, notes: [...g.notes, { id, x, y, text: 'Double‑click to edit this note', w: 360 }] }, selection: { type: 'note', id } })
  },
  moveNote: (id, x, y) => {
    const g = get().graph
    set({ graph: { ...g, notes: g.notes.map((n) => (n.id === id ? { ...n, x, y } : n)) } })
  },
  resetSim: () => set({ runtime: newRuntime(), metrics: null }),
  completeChallenge: (id) => {
    const p = get().progress
    if (p.challenges[id]) return
    set({ progress: { ...p, challenges: { ...p.challenges, [id]: true } } })
  },
}))

useStore.subscribe((s) => save(s))

export const challengeOf = (id: string | null) => (id ? CHALLENGE_BY_ID[id] : null)

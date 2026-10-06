import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, forwardRef, type ReactNode } from 'react'

/** pointer capture is best-effort: it throws for pointers the browser no longer tracks */
function capture(e: React.PointerEvent, el: Element = e.currentTarget as Element) {
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

export interface View {
  x: number
  y: number
  k: number
}
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export interface Insets {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ViewportApi {
  view: View
  fit: () => void
  zoomBy: (f: number) => void
  toWorld: (clientX: number, clientY: number) => { x: number; y: number }
  el: () => HTMLDivElement | null
}

const Ctx = createContext<ViewportApi | null>(null)
export const useViewport = () => useContext(Ctx)!

interface Props {
  bounds: Bounds
  insets: Insets
  fitKey: string | number
  maxFitZoom?: number
  children: ReactNode
  overlay?: ReactNode
  onBackgroundDown?: () => void
  onDrop?: (e: React.DragEvent) => void
  onView?: (v: View) => void
}

export const Viewport = forwardRef<ViewportApi, Props>(function Viewport(
  { bounds, insets, fitKey, maxFitZoom = 1.25, children, overlay, onBackgroundDown, onDrop, onView },
  ref,
) {
  const el = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [panning, setPanning] = useState(false)
  const latest = useRef({ bounds, insets, maxFitZoom })
  latest.current = { bounds, insets, maxFitZoom }

  // keep the callback in a ref: if `apply` changed identity on every render, `fit` would too,
  // and the refit effects below would snap the view back on every re-render
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  const apply = useCallback((v: View) => {
    setView(v)
    onViewRef.current?.(v)
  }, [])

  // once the user zooms or pans by hand, automatic refits (resizes, panel toggles) leave the view alone
  const touched = useRef(false)
  const move = useCallback((v: View) => {
    touched.current = true
    apply(v)
  }, [apply])

  const fit = useCallback(() => {
    const c = el.current
    if (!c) return
    touched.current = false
    const { bounds: b, insets: i, maxFitZoom: mz } = latest.current
    const W = c.clientWidth - i.left - i.right
    const H = c.clientHeight - i.top - i.bottom
    const bw = Math.max(1, b.maxX - b.minX)
    const bh = Math.max(1, b.maxY - b.minY)
    const k = Math.max(0.2, Math.min(mz, W / bw, H / bh))
    apply({ k, x: i.left + (W - bw * k) / 2 - b.minX * k, y: i.top + (H - bh * k) / 2 - b.minY * k })
  }, [apply])

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const v = viewRef.current
    const k = Math.min(2.5, Math.max(0.15, v.k * f))
    const r = k / v.k
    move({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r })
  }, [move])

  const api: ViewportApi = {
    view,
    fit,
    zoomBy: (f) => {
      const c = el.current
      if (c) zoomAt(f, c.clientWidth / 2, c.clientHeight / 2)
    },
    toWorld: (clientX, clientY) => {
      const r = el.current!.getBoundingClientRect()
      const v = viewRef.current
      return { x: (clientX - r.left - v.x) / v.k, y: (clientY - r.top - v.y) / v.k }
    },
    el: () => el.current,
  }
  useImperativeHandle(ref, () => api)

  // refit on new content
  useLayoutEffect(() => {
    fit()
  }, [fitKey, fit])

  // refit when insets change (panels toggled) or window resizes
  const insetKey = `${insets.left},${insets.right},${insets.top},${insets.bottom}`
  useEffect(() => {
    const t = setTimeout(() => !touched.current && fit(), 30)
    return () => clearTimeout(t)
  }, [insetKey, fit])
  useEffect(() => {
    const c = el.current
    if (!c) return
    let t: ReturnType<typeof setTimeout>
    let last = `${c.clientWidth}x${c.clientHeight}`
    const ro = new ResizeObserver(() => {
      const size = `${c.clientWidth}x${c.clientHeight}`
      if (size === last) return
      last = size
      clearTimeout(t)
      t = setTimeout(() => !touched.current && fit(), 60)
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [fit])

  // wheel: scroll pans, ctrl/cmd+scroll (and pinch) zooms
  useEffect(() => {
    const c = el.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-scroll]')) return
      e.preventDefault()
      const r = c.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0045), e.clientX - r.left, e.clientY - r.top)
      } else {
        const v = viewRef.current
        move({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [zoomAt, move])

  // drag background to pan; two-finger pinch on touch
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; k: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement
    if (t !== el.current && !t.dataset.bg) return
    onBackgroundDown?.()
    capture(e, el.current!)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k }
    }
    setPanning(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const r = el.current!.getBoundingClientRect()
      const f = (pinch.current.k * (d / pinch.current.d)) / viewRef.current.k
      zoomAt(f, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
      return
    }
    const v = viewRef.current
    move({ ...v, x: v.x + (e.clientX - prev.x), y: v.y + (e.clientY - prev.y) })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (!pointers.current.size) setPanning(false)
  }

  const g = 22 * view.k
  return (
    <Ctx.Provider value={api}>
      <div
        ref={el}
        className={`canvas${panning ? ' panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(e) => onDrop && e.preventDefault()}
        onDrop={onDrop}
        style={{
          backgroundImage: `radial-gradient(circle, var(--dot) ${Math.max(0.8, 1.1 * view.k)}px, transparent ${Math.max(1, 1.3 * view.k)}px)`,
          backgroundSize: `${g}px ${g}px`,
          backgroundPosition: `${view.x - g / 2}px ${view.y - g / 2}px`,
        }}
      >
        <div className="world" data-bg="1" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          {children}
        </div>
        {overlay}
      </div>
    </Ctx.Provider>
  )
})

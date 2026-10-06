export function fmtRate(v: number) {
  if (!isFinite(v)) return '∞'
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  if (v >= 10) return `${Math.round(v)}`
  if (v >= 1) return v.toFixed(1)
  if (v > 0) return v.toFixed(2)
  return '0'
}

export function fmtMs(ms: number) {
  if (!isFinite(ms)) return '∞'
  if (ms >= 10000) return `${(ms / 1000).toFixed(0)}s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms >= 10) return `${Math.round(ms)}ms`
  if (ms >= 1) return `${ms.toFixed(1)}ms`
  if (ms >= 0.001) return `${+(ms * 1000).toFixed(ms < 0.01 ? 1 : 0)}µs`
  return `${Math.round(ms * 1e6)}ns`
}

export function fmtBits(bps: number) {
  if (bps >= 1e12) return `${+(bps / 1e12).toFixed(1)} Tb/s`
  if (bps >= 1e9) return `${+(bps / 1e9).toFixed(1)} Gb/s`
  if (bps >= 1e6) return `${+(bps / 1e6).toFixed(1)} Mb/s`
  if (bps >= 1e3) return `${+(bps / 1e3).toFixed(1)} kb/s`
  return `${Math.round(bps)} b/s`
}

export function fmtBytes(b: number) {
  if (b >= 1024 ** 3) return `${+(b / 1024 ** 3).toFixed(1)} GB`
  if (b >= 1024 ** 2) return `${+(b / 1024 ** 2).toFixed(1)} MB`
  if (b >= 1024) return `${+(b / 1024).toFixed(1)} KB`
  return `${Math.round(b)} B`
}

export function fmtPct(f: number) {
  const p = f * 100
  if (p >= 10 || p === 0) return `${Math.round(p)}%`
  return `${p.toFixed(1)}%`
}

/** 0..1000 slider position <-> log-scaled value */
export function valToLog(v: number, min: number, max: number) {
  return (Math.log(Math.max(min, Math.min(max, v)) / min) / Math.log(max / min)) * 1000
}
export function logToVal(p: number, min: number, max: number) {
  return min * Math.pow(max / min, p / 1000)
}

/** snap a value to a "nice" number for display in sliders */
export function nice(v: number) {
  if (v >= 100) return Math.round(v)
  if (v >= 10) return Math.round(v * 2) / 2
  if (v >= 1) return Math.round(v * 10) / 10
  return +v.toPrecision(2)
}

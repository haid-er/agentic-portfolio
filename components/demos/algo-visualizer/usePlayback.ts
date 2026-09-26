'use client'
/**
 * Step/play/scrub state for a recorded trace. Plays on requestAnimationFrame at
 * `rate` steps per second and pauses itself while `active` is false (tab hidden or off-screen).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Playback {
  step: number
  total: number
  playing: boolean
  setStep: (n: number) => void
  toggle: () => void
  pause: () => void
  forward: () => void
  back: () => void
  reset: () => void
  finish: () => void
}

export function usePlayback(total: number, rate: number, active: boolean): Playback {
  const [step, setStepRaw] = useState(0)
  const [playing, setPlaying] = useState(false)
  const acc = useRef(0)

  const clamp = useCallback((n: number) => Math.max(0, Math.min(total, Math.round(n))), [total])
  const setStep = useCallback((n: number) => setStepRaw(clamp(n)), [clamp])

  // A new trace can be shorter than the old position.
  useEffect(() => { setStepRaw((s) => Math.min(s, total)) }, [total])

  useEffect(() => {
    if (!playing || !active) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      acc.current += ((now - last) / 1000) * rate
      last = now
      const whole = Math.floor(acc.current)
      if (whole > 0) {
        acc.current -= whole
        setStepRaw((s) => Math.min(total, s + whole))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, active, rate, total])

  // Stop at the end of the trace.
  useEffect(() => { if (playing && step >= total) setPlaying(false) }, [playing, step, total])

  const toggle = () => {
    if (!playing && step >= total) setStepRaw(0) // replay from the start when finished
    acc.current = 0
    setPlaying(!playing)
  }
  const pause = useCallback(() => setPlaying(false), [])
  const reset = useCallback(() => { setPlaying(false); setStepRaw(0) }, [])
  const finish = useCallback(() => { setPlaying(false); setStepRaw(total) }, [total])

  return {
    step,
    total,
    playing,
    setStep: (n) => { setPlaying(false); setStep(n) },
    toggle,
    pause,
    forward: () => { setPlaying(false); setStepRaw((s) => Math.min(total, s + 1)) },
    back: () => { setPlaying(false); setStepRaw((s) => Math.max(0, s - 1)) },
    reset,
    finish,
  }
}

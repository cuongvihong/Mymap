/**
 * Controller of Play (FSD FR-KB-06, TDD 8.5). Pure: time comes from an injected clock, so tests
 * run it with a fake one and the renderer runs it with the window timers.
 *
 * Every step has two phases. In `hold` the block glows and the caption shows for 1500 ms. In
 * `travel` a dot runs from this block to the next one for 750 ms. Both are divided by the speed.
 * The renderer draws the dot by asking `progress()` on every frame, so pausing freezes it and a
 * change of speed carries on from the same place.
 */

export const PLAY_TIMING = { camera: 500, hold: 1500, travel: 750 } as const
export const PLAY_SPEEDS = [0.5, 1, 2] as const
export type PlaySpeed = (typeof PLAY_SPEEDS)[number]

export type PlayState = 'idle' | 'playing' | 'paused' | 'finished' | 'stopped'
export type PlayPhase = 'hold' | 'travel'

/** Ease in and out, quadratic. t is clamped to 0..1. */
export function easeInOutQuad(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

export interface PlayClock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface PlayHooks {
  /** A step begins: light the block, move the camera, show the caption. */
  step(index: number): void
  /** The dot starts to run from step `from` to step `to`. */
  travel(from: number, to: number): void
  state(state: PlayState): void
}

export interface PlayerOptions {
  stepCount: number
  clock: PlayClock
  hooks: PlayHooks
  speed?: PlaySpeed
  /** False when the system asks for reduced motion: no dot, the next step follows the hold. */
  travel?: boolean
}

export interface Player {
  start(): void
  pause(): void
  resume(): void
  /** Cancels every timer. After this nothing runs again. */
  stop(): void
  setSpeed(speed: PlaySpeed): void
  state(): PlayState
  index(): number
  phase(): PlayPhase
  speed(): PlaySpeed
  /** 0..1 through the current phase. */
  progress(): number
  /** Length of the camera glide at the current speed, in ms. */
  cameraMs(): number
}

export function createPlayer(options: PlayerOptions): Player {
  const { stepCount, clock, hooks } = options
  const withTravel = options.travel !== false
  let state: PlayState = 'idle'
  let index = -1
  let phase: PlayPhase = 'hold'
  let speed: PlaySpeed = options.speed ?? 1
  /** Share of the phase that was done when the timer was last set. */
  let fraction = 0
  let checkpoint = 0
  let timer: unknown = null

  const base = () => (phase === 'hold' ? PLAY_TIMING.hold : PLAY_TIMING.travel)
  const progressNow = (): number =>
    state === 'playing'
      ? Math.min(1, fraction + ((clock.now() - checkpoint) * speed) / base())
      : fraction
  const clear = () => {
    if (timer !== null) clock.clearTimeout(timer)
    timer = null
  }
  const setState = (next: PlayState) => {
    state = next
    hooks.state(next)
  }
  const schedule = () => {
    clear()
    checkpoint = clock.now()
    const wait = Math.max(0, ((1 - fraction) * base()) / speed)
    timer = clock.setTimeout(onPhaseEnd, wait)
  }
  const enter = (i: number) => {
    index = i
    phase = 'hold'
    fraction = 0
    hooks.step(i)
    schedule()
  }
  function onPhaseEnd(): void {
    timer = null
    if (state !== 'playing') return
    if (phase === 'hold') {
      if (index >= stepCount - 1) {
        setState('finished')
        return
      }
      if (withTravel) {
        phase = 'travel'
        fraction = 0
        hooks.travel(index, index + 1)
        schedule()
        return
      }
    }
    enter(index + 1)
  }

  return {
    start() {
      if (state !== 'idle') return
      if (stepCount <= 0) {
        setState('finished')
        return
      }
      setState('playing')
      enter(0)
    },
    pause() {
      if (state !== 'playing') return
      fraction = progressNow()
      clear()
      setState('paused')
    },
    resume() {
      if (state !== 'paused') return
      setState('playing')
      schedule()
    },
    stop() {
      clear()
      if (state === 'stopped' || state === 'finished') return
      setState('stopped')
    },
    setSpeed(next) {
      if (state === 'playing') {
        fraction = progressNow()
        speed = next
        schedule()
      } else {
        speed = next
      }
    },
    state: () => state,
    index: () => index,
    phase: () => phase,
    speed: () => speed,
    progress: progressNow,
    cameraMs: () => PLAY_TIMING.camera / speed
  }
}

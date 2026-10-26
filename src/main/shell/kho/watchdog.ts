export const WATCHDOG_INTERVAL_MS = 3000

export interface WatchdogOptions {
  /** True while the Kho can be reached. Must not throw, but a throw counts as "lost". */
  check: () => boolean
  onLost: () => void
  /** Return false when the recovery failed, the watchdog then stays in the lost state and tries again. */
  onRecovered: () => boolean | void
  intervalMs?: number
}

export interface Watchdog {
  start(): void
  stop(): void
  isLost(): boolean
}

/** Polls the Kho every 3 seconds and reports when it disappears or comes back (like studyapp). */
export function createWatchdog(options: WatchdogOptions): Watchdog {
  const interval = options.intervalMs ?? WATCHDOG_INTERVAL_MS
  let timer: ReturnType<typeof setInterval> | null = null
  let lost = false

  function tick() {
    let ok = false
    try {
      ok = options.check()
    } catch {
      ok = false
    }
    if (!ok && !lost) {
      lost = true
      options.onLost()
    } else if (ok && lost) {
      if (options.onRecovered() !== false) lost = false
    }
  }

  return {
    start() {
      if (timer) return
      lost = false
      timer = setInterval(tick, interval)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    isLost: () => lost
  }
}

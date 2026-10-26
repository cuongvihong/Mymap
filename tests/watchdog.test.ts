import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchdog, WATCHDOG_INTERVAL_MS } from '../src/main/shell/kho/watchdog'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('watchdog', () => {
  it('polls every 3 seconds and reports lost then recovered once each', () => {
    let reachable = true
    const events: string[] = []
    const dog = createWatchdog({
      check: () => reachable,
      onLost: () => void events.push('lost'),
      onRecovered: () => void events.push('back')
    })
    dog.start()
    expect(WATCHDOG_INTERVAL_MS).toBe(3000)

    vi.advanceTimersByTime(9000)
    expect(events).toEqual([])

    reachable = false
    vi.advanceTimersByTime(3000)
    vi.advanceTimersByTime(9000)
    expect(events).toEqual(['lost'])
    expect(dog.isLost()).toBe(true)

    reachable = true
    vi.advanceTimersByTime(3000)
    expect(events).toEqual(['lost', 'back'])
    expect(dog.isLost()).toBe(false)
    dog.stop()
  })

  it('a throwing check counts as lost', () => {
    const onLost = vi.fn()
    const dog = createWatchdog({
      check: () => {
        throw new Error('EIO')
      },
      onLost,
      onRecovered: () => {}
    })
    dog.start()
    vi.advanceTimersByTime(3000)
    expect(onLost).toHaveBeenCalledTimes(1)
    dog.stop()
  })

  it('stays lost and tries again when the recovery fails', () => {
    let reachable = false
    let attempts = 0
    const dog = createWatchdog({
      check: () => reachable,
      onLost: () => {},
      onRecovered: () => {
        attempts += 1
        return attempts >= 2
      }
    })
    dog.start()
    vi.advanceTimersByTime(3000)
    reachable = true
    vi.advanceTimersByTime(3000)
    expect(attempts).toBe(1)
    expect(dog.isLost()).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(attempts).toBe(2)
    expect(dog.isLost()).toBe(false)
    dog.stop()
  })

  it('stop() ends the polling', () => {
    const check = vi.fn(() => true)
    const dog = createWatchdog({ check, onLost: () => {}, onRecovered: () => {} })
    dog.start()
    vi.advanceTimersByTime(3000)
    dog.stop()
    vi.advanceTimersByTime(30000)
    expect(check).toHaveBeenCalledTimes(1)
  })
})

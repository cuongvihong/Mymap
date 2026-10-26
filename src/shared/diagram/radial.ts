/** A press shorter than this and moving less than TAP_MOVE px counts as a tap (TDD 8.4). */
export const TAP_MAX_MS = 220
export const TAP_MAX_MOVE = 6

/**
 * Slot under the pointer for a radial menu. dx and dy are the pointer offset from the centre in
 * screen pixels (y grows downwards). Returns -1 inside the dead zone. Slot 0 points up and slots
 * grow clockwise. Each slot is centred on its direction, so with 8 slots slot 1 covers 22.5 to
 * 67.5 degrees.
 */
export function slotFromVector(dx: number, dy: number, slots = 8, dead = 40): number {
  if (!(slots > 0)) return -1
  if (Math.hypot(dx, dy) <= dead) return -1
  // Angle from "up", clockwise, in [0, 360).
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  const width = 360 / slots
  return Math.floor(((angle + width / 2) % 360) / width)
}

/** True for a quick press that barely moved: the menu stays open until the next click. */
export function isTap(pressMs: number, moved: number): boolean {
  return pressMs < TAP_MAX_MS && moved < TAP_MAX_MOVE
}

/** Moves a sub-type index by delta (mouse wheel or the Q key) and wraps around. */
export function cycleSub(index: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return (((index + delta) % length) + length) % length
}

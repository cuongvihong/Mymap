/** `prefers-reduced-motion`: no fly out, no ripple, the zoom to a pin is instant (FR-AN-05). */
export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

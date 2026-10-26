import { normalize } from './normalize'

export interface PinLike {
  id: number
  note: string
}

const MIN_WORD = 3

function words(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= MIN_WORD)
  )
}

function scoreOf(pin: PinLike, target: Set<string>): number {
  let score = 0
  for (const w of words(pin.note)) if (target.has(w)) score++
  return score
}

/**
 * Index of the pin whose note shares the most words with the step note (TDD 8.6). Accents and case
 * are ignored and words shorter than 3 characters are dropped. A tie goes to the first pin.
 * Returns -1 when there are no pins.
 */
export function pickPin(pins: readonly PinLike[], stepNote: string): number {
  if (pins.length === 0) return -1
  const target = words(stepNote)
  let best = 0
  let bestScore = -1
  pins.forEach((pin, i) => {
    const score = scoreOf(pin, target)
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  return best
}

export interface PeekCandidate {
  imageId: number
  pins: readonly PinLike[]
}

/**
 * The image and pin the Play card shows for a step (FR-ANH-06). Among the images of the block the
 * pin with the most words in common with the step note wins, a tie goes to the earlier image and
 * pin. Images without pins only count when no image has any: then the first image shows whole,
 * with pinIndex -1. Returns null for a block without images.
 */
export function pickPeek(
  images: readonly PeekCandidate[],
  stepNote: string
): { imageId: number; pinIndex: number } | null {
  if (images.length === 0) return null
  const target = words(stepNote)
  let best: { imageId: number; pinIndex: number } | null = null
  let bestScore = -1
  for (const image of images) {
    image.pins.forEach((pin, i) => {
      const score = scoreOf(pin, target)
      if (score > bestScore) {
        best = { imageId: image.imageId, pinIndex: i }
        bestScore = score
      }
    })
  }
  return best ?? { imageId: (images[0] as PeekCandidate).imageId, pinIndex: -1 }
}

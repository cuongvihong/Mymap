import type { Id, LinkEnds } from './focus'

/**
 * How a block, a channel or a group frame is drawn while a focus or a scenario is active (FR-CV-07).
 * `normal` means nothing is dimmed. `focus` is the focused block itself, `lit` a block that stays
 * bright, `dim` a block outside the lit set.
 */
export type BlockDisplay = 'normal' | 'focus' | 'lit' | 'dim'
export type EdgeDisplay = 'normal' | 'lit' | 'dim'
export type FrameDisplay = 'normal' | 'dim'

export interface DisplayState {
  /** Result of focus.litNodes. null means nothing is dimmed. */
  lit: ReadonlySet<Id> | null
  focusId: Id | null
}

export function blockDisplay(id: Id, state: DisplayState): BlockDisplay {
  if (state.focusId !== null && id === state.focusId) return 'focus'
  if (state.lit === null) return 'normal'
  return state.lit.has(id) ? 'lit' : 'dim'
}

/**
 * A channel stays bright when both ends are lit and, while a block has the focus, when it touches
 * that block. Every other channel is dimmed.
 */
export function edgeDisplay(link: Pick<LinkEnds, 'from' | 'to'>, state: DisplayState): EdgeDisplay {
  if (state.lit === null && state.focusId === null) return 'normal'
  if (state.focusId !== null && link.from !== state.focusId && link.to !== state.focusId) {
    return 'dim'
  }
  if (state.lit === null) return 'lit'
  return state.lit.has(link.from) && state.lit.has(link.to) ? 'lit' : 'dim'
}

/** A group frame is dimmed when none of its blocks is lit. */
export function frameDisplay(memberIds: readonly Id[], state: DisplayState): FrameDisplay {
  if (state.lit === null) return 'normal'
  return memberIds.some((id) => state.lit?.has(id)) ? 'normal' : 'dim'
}

/** CSS Module class names the canvas uses for a display state. */
export const DISPLAY_CLASS = {
  focus: 'focus',
  lit: 'lit',
  dim: 'dim',
  normal: ''
} as const

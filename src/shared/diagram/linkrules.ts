import type { NodeType, ViaType } from './types'

/** Which part of a channel breaks a rule. */
export type LinkRuleEnd = 'from' | 'to' | 'via'

export type LinkRuleReason = 'note' | 'to-start' | 'to-req' | 'from-end' | 'impl-not-req'

export interface LinkRuleViolation {
  end: LinkRuleEnd
  reason: LinkRuleReason
}

/** Reason texts for the UI, shown when a drop is refused (FR-LK-03). */
export const LINK_RULE_TEXT: Record<LinkRuleReason, string> = {
  note: 'Khối Ghi chú không có kênh.',
  'to-start': 'Không thể nối vào khối Start, Start chỉ là điểm đầu.',
  'to-req': 'Không thể nối vào khối REQ, REQ chỉ là điểm đầu của kênh Hiện thực.',
  'from-end': 'Không thể nối ra từ khối End, End chỉ là điểm cuối.',
  'impl-not-req': 'Kênh Hiện thực chỉ được xuất phát từ khối REQ.'
}

/**
 * FR-LK-03 for two different blocks: into Start, into REQ, out of End, any Note, and an `impl`
 * channel that does not start at a REQ. Self links are a separate check (from === to).
 * Returns every violation, empty when the channel is allowed.
 */
export function checkLinkRules(
  fromType: NodeType,
  toType: NodeType,
  via: ViaType
): LinkRuleViolation[] {
  if (fromType === 'note') return [{ end: 'from', reason: 'note' }]
  if (toType === 'note') return [{ end: 'to', reason: 'note' }]
  const out: LinkRuleViolation[] = []
  if (toType === 'start') out.push({ end: 'to', reason: 'to-start' })
  if (toType === 'req') out.push({ end: 'to', reason: 'to-req' })
  if (fromType === 'end') out.push({ end: 'from', reason: 'from-end' })
  if (via === 'impl' && fromType !== 'req') out.push({ end: 'via', reason: 'impl-not-req' })
  return out
}

export const LINK_SELF_TEXT = 'Không thể nối một khối vào chính nó.'

export interface LinkEndType {
  id: number
  type: NodeType
}

/**
 * Reason a channel between two blocks is refused, or null when it is allowed (FR-LK-03).
 * The renderer uses it for the lit and dim ports while dragging and for the toast on a bad drop.
 */
export function linkProblem(from: LinkEndType, to: LinkEndType, via: ViaType): string | null {
  if (from.id === to.id) return LINK_SELF_TEXT
  const violation = checkLinkRules(from.type, to.type, via)[0]
  return violation ? LINK_RULE_TEXT[violation.reason] : null
}

import { TECH_SUBTYPES, VIA_TYPES, type NodeType, type ViaType } from './types'

/** Where the right button went down (FR-VC-05). */
export type RadialContext = 'canvas' | 'node' | 'link' | 'multi'

export interface RadialSub {
  id: string
  label: string
}

export interface RadialItem {
  id: string
  label: string
  /** Name of the icon, drawn by the renderer. */
  icon: string
  /** Block type whose colour the slot takes, or 'danger' or 'neutral'. */
  tone: NodeType | 'danger' | 'neutral' | 'accent'
  /** Values the wheel cycles through. */
  subs?: readonly RadialSub[]
  /** Not built yet: the slot is dimmed and this text says when it arrives. */
  soon?: string
}

/** Slots of a ring, clockwise from the top. Null slots stay empty. */
export type Ring = readonly (RadialItem | null)[]

export const RING_SLOTS = 8
/** The Xóa slot of every ring that has one, straight down (FR-VC-05). */
export const DELETE_SLOT = 4

const TECH_LABEL: Record<(typeof TECH_SUBTYPES)[number], string> = {
  api: 'API',
  database: 'Database',
  service: 'Service',
  ui: 'UI',
  queue: 'Queue',
  storage: 'Storage',
  job: 'Job'
}

const VIA_LABEL: Record<ViaType, string> = {
  impl: 'Hiện thực',
  rest: 'REST / API',
  webhook: 'Webhook',
  db: 'Database',
  ui: 'Điều hướng UI',
  call: 'Gọi nội bộ',
  redirect: 'Redirect',
  job: 'Lịch chạy',
  event: 'Event',
  queue: 'Queue',
  file: 'File'
}

export const ALIGN_SUBS: readonly RadialSub[] = [
  { id: 'left', label: 'Trái' },
  { id: 'center', label: 'Giữa' },
  { id: 'right', label: 'Phải' },
  { id: 'top', label: 'Trên' },
  { id: 'bottom', label: 'Dưới' }
]

export const DISTRIBUTE_SUBS: readonly RadialSub[] = [
  { id: 'horizontal', label: 'Ngang' },
  { id: 'vertical', label: 'Dọc' }
]

/** Ring of an empty spot on the canvas, in the order of the approved demo. No Xóa slot. */
export function canvasRing(): Ring {
  return [
    { id: 'fnc', label: 'Function', icon: 'function', tone: 'fnc' },
    { id: 'req', label: 'REQ', icon: 'checklist', tone: 'req' },
    {
      id: 'tech',
      label: 'Tech',
      icon: 'database',
      tone: 'tech',
      subs: TECH_SUBTYPES.map((id) => ({ id, label: TECH_LABEL[id] }))
    },
    { id: 'ext', label: 'Hệ thống ngoài', icon: 'world', tone: 'ext' },
    { id: 'note', label: 'Ghi chú', icon: 'note', tone: 'note' },
    { id: 'cond', label: 'Điều kiện', icon: 'branch', tone: 'cond' },
    {
      id: 'startend',
      label: 'Start/End',
      icon: 'play',
      tone: 'start',
      subs: [
        { id: 'start', label: 'Start' },
        { id: 'end', label: 'End' }
      ]
    },
    { id: 'group', label: 'Nhóm FS', icon: 'folder', tone: 'accent' }
  ]
}

/** Ring of a single block. "Thu gọn" reads "Mở rộng" for a collapsed block. */
export function nodeRing(opts: { collapsed: boolean }): Ring {
  return [
    { id: 'fs', label: 'Mở FS', icon: 'file', tone: 'neutral' },
    { id: 'image', label: 'Thêm ảnh', icon: 'photo', tone: 'neutral' },
    { id: 'link', label: 'Nối tới', icon: 'arrow', tone: 'neutral' },
    { id: 'branch', label: 'Rẽ nhánh', icon: 'fork', tone: 'neutral' },
    { id: 'delete', label: 'Xóa', icon: 'trash', tone: 'danger' },
    { id: 'duplicate', label: 'Nhân bản', icon: 'copy', tone: 'neutral' },
    {
      id: 'collapse',
      label: opts.collapsed ? 'Mở rộng' : 'Thu gọn',
      icon: 'fold',
      tone: 'neutral'
    },
    { id: 'edit', label: 'Sửa', icon: 'edit', tone: 'neutral' }
  ]
}

/** Ring of a channel. Five items, Xóa still at the bottom. `split` is true when the pair is drawn as separate wires. */
export function linkRing(opts: { split: boolean }): Ring {
  return [
    { id: 'add', label: 'Thêm kênh', icon: 'plus', tone: 'neutral' },
    {
      id: 'via',
      label: 'Đổi via',
      icon: 'route',
      tone: 'neutral',
      subs: VIA_TYPES.map((id) => ({ id, label: VIA_LABEL[id] }))
    },
    {
      id: 'split',
      label: opts.split ? 'Gộp dây' : 'Tách dây',
      icon: opts.split ? 'merge' : 'split',
      tone: 'neutral'
    },
    { id: 'label', label: 'Sửa nhãn', icon: 'edit', tone: 'neutral' },
    { id: 'delete', label: 'Xóa', icon: 'trash', tone: 'danger' },
    null,
    null,
    null
  ]
}

/** Ring of several selected blocks. `groups` feeds the sub list of "Gom vào nhóm FS". */
export function multiRing(groups: readonly { id: number; title: string }[]): Ring {
  return [
    { id: 'align', label: 'Căn hàng', icon: 'align', tone: 'neutral', subs: ALIGN_SUBS },
    {
      id: 'distribute',
      label: 'Giãn đều',
      icon: 'distribute',
      tone: 'neutral',
      subs: DISTRIBUTE_SUBS
    },
    {
      id: 'group',
      label: 'Gom vào nhóm',
      icon: 'folder',
      tone: 'accent',
      subs: [
        { id: 'new', label: 'Nhóm mới' },
        ...groups.map((g) => ({ id: String(g.id), label: g.title }))
      ]
    },
    { id: 'layout', label: 'Bố cục tự động', icon: 'layout', tone: 'neutral' },
    { id: 'delete', label: 'Xóa', icon: 'trash', tone: 'danger' },
    { id: 'duplicate', label: 'Nhân bản', icon: 'copy', tone: 'neutral' },
    null,
    null
  ]
}

export function ringFor(
  context: RadialContext,
  opts: {
    collapsed?: boolean
    split?: boolean
    groups?: readonly { id: number; title: string }[]
  } = {}
): Ring {
  switch (context) {
    case 'canvas':
      return canvasRing()
    case 'node':
      return nodeRing({ collapsed: opts.collapsed === true })
    case 'link':
      return linkRing({ split: opts.split === true })
    default:
      return multiRing(opts.groups ?? [])
  }
}

/** Block a slot of the canvas ring creates, or null for the group frame. */
export function blockSpec(
  itemId: string,
  subId: string | null
): { type: NodeType; subtype: string | null } | null {
  switch (itemId) {
    case 'fnc':
    case 'req':
    case 'ext':
    case 'note':
    case 'cond':
      return { type: itemId, subtype: null }
    case 'tech':
      return { type: 'tech', subtype: subId ?? 'api' }
    case 'startend':
      return subId === 'end' ? { type: 'end', subtype: 'ok' } : { type: 'start', subtype: 'user' }
    default:
      return null
  }
}

/** Current sub-item of a slot: the remembered one when it still exists, else the first. */
export function currentSub(item: RadialItem, remembered: string | undefined): RadialSub | null {
  if (!item.subs || item.subs.length === 0) return null
  return item.subs.find((s) => s.id === remembered) ?? (item.subs[0] as RadialSub)
}

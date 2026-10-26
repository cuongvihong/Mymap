import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { defaultVia } from '../../../../shared/diagram/channels'
import { dropTarget } from '../../../../shared/diagram/frames'
import { IMAGE_LIMITS } from '../../../../shared/diagram/imagerules'
import { linkProblem } from '../../../../shared/diagram/linkrules'
import { cycleSub, isTap, slotFromVector } from '../../../../shared/diagram/radial'
import {
  blockSpec,
  currentSub,
  ringFor,
  type RadialContext,
  type RadialItem,
  type Ring
} from '../../../../shared/diagram/radialMenus'
import type { AlignMode, DistributeAxis } from '../../../../shared/diagram/arrange'
import type { NodeType, ViaType } from '../../../../shared/diagram/types'
import { useDiagram, type BlockSpec } from '../store/diagramStore'
import type { CanvasModel, PairModel } from '../canvas/model'
import { RadialMenu } from './RadialMenu'

const HALF = 130
/** Selectors for things on top of the canvas that keep their own right click. */
const IGNORE = '[role="toolbar"], aside, dialog, [data-popover], .react-flow__minimap'

/** Sub-item chosen for each slot, kept for the whole session (FR-VC-04). */
let remembered: Record<string, string> = {}

interface Open {
  context: RadialContext
  ring: Ring
  /** Centre in pixels from the top left of the canvas. */
  centre: { x: number; y: number }
  /** Where the ring was asked for, in screen pixels. New blocks go here. */
  press: { x: number; y: number }
  sticky: boolean
  hover: number
  by: 'mouse' | 'key'
  nodeId?: number
  pair?: PairModel
  /** The pair is drawn as separate wires at the moment. */
  split?: boolean
  /** A wire dropped on the bare canvas: the new block is joined to this block. */
  linkFrom?: number
}

type Hit =
  | { context: 'canvas' }
  | { context: 'node'; nodeId: number }
  | { context: 'multi' }
  | { context: 'link'; pair: PairModel; linkId: number | null }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export interface UseRadial {
  element: ReactNode
  isOpen(): boolean
  /** A wire was dropped on the bare canvas: open the canvas ring, joined to `from` (FR-LK-02). */
  openFromWire(point: { x: number; y: number }, from: number): void
}

/**
 * Radial menu controller (TDD 8.4, FR-VC). Right button down opens the ring at the pointer, moving
 * picks a slot and letting go chooses it. A tap keeps the ring open until the next click. The Q key
 * works the same way while it is held. The wheel changes the sub-type of the slot under the pointer.
 */
export function useRadial(
  wrapRef: RefObject<HTMLDivElement | null>,
  model: CanvasModel | null
): UseRadial {
  const rf = useReactFlow()
  const [open, setOpenState] = useState<Open | null>(null)
  const [subs, setSubs] = useState<Record<string, string>>(remembered)
  const ref = useRef<Open | null>(null)
  const latest = useRef({ rf, model })
  useEffect(() => {
    latest.current = { rf, model }
  }, [rf, model])
  const pressAt = useRef(0)

  const setOpen = useCallback((next: Open | null) => {
    ref.current = next
    setOpenState(next)
  }, [])

  /** Which ring the point asks for, read from the elements stacked under it. */
  const resolve = useCallback((x: number, y: number): Hit | null => {
    const store = useDiagram.getState()
    const current = latest.current.model
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest(IGNORE)) return null
      const wrapper = el.closest('.react-flow__node')
      const idAttr = wrapper?.getAttribute('data-id')
      if (idAttr) {
        const nodeId = Number(idAttr)
        if (store.selected.length > 1 && store.selected.includes(nodeId))
          return { context: 'multi' }
        return { context: 'node', nodeId }
      }
      const linkKey = el.getAttribute('data-hit-link')
      const pairKey =
        el.getAttribute('data-hit') ?? el.closest('[data-badge]')?.getAttribute('data-badge')
      if (linkKey && current) {
        const pair = current.pairs.find((p) => p.links.some((l) => l.key === linkKey))
        const link = pair?.links.find((l) => l.key === linkKey)
        if (pair && link) return { context: 'link', pair, linkId: link.id }
      }
      if (pairKey && current) {
        const pair = current.pairs.find((p) => p.key === pairKey)
        if (pair)
          return {
            context: 'link',
            pair,
            linkId: pair.links.length === 1 ? (pair.links[0]?.id ?? null) : null
          }
      }
    }
    return { context: 'canvas' }
  }, [])

  const begin = useCallback(
    (x: number, y: number, by: 'mouse' | 'key', sticky: boolean, forced?: { linkFrom: number }) => {
      const wrap = wrapRef.current
      const store = useDiagram.getState()
      if (!wrap || !store.data) return false
      const hit: Hit | null = forced ? { context: 'canvas' } : resolve(x, y)
      if (!hit) return false
      const box = wrap.getBoundingClientRect()
      const centre = {
        x: clamp(x - box.left, HALF, Math.max(HALF, box.width - HALF)),
        y: clamp(y - box.top, HALF, Math.max(HALF, box.height - HALF))
      }
      const node =
        hit.context === 'node' ? store.data.nodes.find((n) => n.id === hit.nodeId) : undefined
      const split =
        hit.context === 'link'
          ? store.pairView[hit.pair.key] === 'split' ||
            (store.pairView[hit.pair.key] === undefined && store.channelMode === 'many')
          : false
      const ring = ringFor(hit.context, {
        collapsed: node?.collapsed === true,
        split,
        groups: store.data.groups.map((g) => ({ id: g.id, title: g.title }))
      })
      pressAt.current = performance.now()
      setOpen({
        context: hit.context,
        ring,
        centre,
        press: { x, y },
        sticky,
        hover: -1,
        by,
        ...(hit.context === 'node' ? { nodeId: hit.nodeId } : {}),
        ...(hit.context === 'link' ? { pair: hit.pair, split } : {}),
        ...(forced ? { linkFrom: forced.linkFrom } : {})
      })
      return true
    },
    [resolve, setOpen, wrapRef]
  )

  /** Whether a slot cannot be chosen right now. */
  const disabled = useCallback((o: Open, item: RadialItem, subId: string | null): boolean => {
    if (item.soon) return true
    const store = useDiagram.getState()
    if (o.context === 'canvas' && o.linkFrom !== undefined) {
      if (item.id === 'group') return true
      const spec = blockSpec(item.id, subId)
      const from = store.data?.nodes.find((n) => n.id === o.linkFrom)
      if (!spec || !from) return false
      const fake = { id: -1, type: spec.type as NodeType, subtype: spec.subtype }
      return linkProblem(from, fake, defaultVia(from, fake)) !== null
    }
    if (o.context === 'node') {
      const node = store.data?.nodes.find((n) => n.id === o.nodeId)
      if (item.id === 'fs') return !node?.fsFile
      if (item.id === 'image')
        return (
          (store.data?.images.filter((i) => i.nodeId === o.nodeId).length ?? 0) >=
          IMAGE_LIMITS.maxPerBlock
        )
    }
    if (o.context === 'link' && o.pair && o.pair.links.length > 1) {
      return item.id === 'via' || item.id === 'label' || item.id === 'delete'
    }
    if (o.context === 'multi' && item.id === 'distribute') return store.selected.length < 3
    return false
  }, [])

  const run = useCallback((o: Open, item: RadialItem, subId: string | null) => {
    const s = useDiagram.getState()
    const { rf: flow, model: current } = latest.current
    const world = flow.screenToFlowPosition(o.press)
    switch (o.context) {
      case 'canvas': {
        const spec: BlockSpec | null =
          item.id === 'group' ? { type: 'group' } : blockSpec(item.id, subId)
        if (!spec) return
        const frames = (current?.frames ?? [])
          .filter((f) => !f.collapsed)
          .map((f) => ({ id: f.group.id, rect: f.rect }))
        const groupId = dropTarget({ x: world.x, y: world.y, w: 1, h: 1 }, frames)
        void s.createBlock(spec, world, {
          groupId,
          edit: true,
          ...(o.linkFrom !== undefined ? { linkFrom: o.linkFrom } : {})
        })
        return
      }
      case 'node': {
        const id = o.nodeId
        if (id === undefined) return
        if (item.id === 'fs') void s.openFs(id)
        else if (item.id === 'image') void s.pickImages(id)
        else if (item.id === 'link') s.startLinking(id)
        else if (item.id === 'branch') s.startBranchAt(id)
        else if (item.id === 'delete') void s.requestDelete([id])
        else if (item.id === 'duplicate') void s.duplicate([id])
        else if (item.id === 'collapse') void s.toggleNodeCollapsed(id)
        else if (item.id === 'edit') {
          s.select([id])
          s.startEditing(id)
        }
        return
      }
      case 'link': {
        const pair = o.pair
        const first = pair?.links[0]
        if (!pair || !first) return
        const only = pair.links.length === 1 ? first : null
        if (item.id === 'add') void s.createLink(first.fromNode, first.toNode)
        else if (item.id === 'split') s.togglePair(pair.key, !o.split)
        else if (item.id === 'via' && only && subId)
          void s.updateLink(only.id, { via: subId as ViaType })
        else if (item.id === 'label' && only) {
          s.selectLink(only.id)
          s.focusLinkLabel(only.id)
        } else if (item.id === 'delete' && only) void s.removeLinks([only.id])
        return
      }
      default: {
        const ids = s.selected
        if (item.id === 'align' && subId) void s.align(subId as AlignMode)
        else if (item.id === 'distribute' && subId) void s.distribute(subId as DistributeAxis)
        else if (item.id === 'group' && subId) {
          void s.gatherIntoGroup(ids, subId === 'new' ? 'new' : Number(subId))
        } else if (item.id === 'delete') void s.requestDelete(ids)
        else if (item.id === 'layout') void s.autoLayout({ kind: 'selection', ids })
        else if (item.id === 'duplicate') void s.duplicate(ids)
      }
    }
  }, [])

  const choose = useCallback(
    (o: Open, index: number) => {
      setOpen(null)
      const item = index >= 0 ? o.ring[index] : null
      if (!item) return
      const sub = currentSub(item, remembered[item.id])
      if (disabled(o, item, sub?.id ?? null)) return
      run(o, item, sub?.id ?? null)
    },
    [disabled, run, setOpen]
  )

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let last = { x: -1, y: -1 }
    let start = { x: 0, y: 0 }

    const hoverAt = (o: Open, x: number, y: number): Open => {
      const box = wrap.getBoundingClientRect()
      const hover = slotFromVector(x - (box.left + o.centre.x), y - (box.top + o.centre.y))
      const slot = hover >= 0 && o.ring[hover] ? hover : -1
      return slot === o.hover ? o : { ...o, hover: slot }
    }
    const inside = (target: EventTarget | null) => target instanceof Node && wrap.contains(target)
    const typing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }

    const swallowNextClick = () =>
      window.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true })

    const onDown = (e: PointerEvent) => {
      const cur = ref.current
      if (cur) {
        if (!cur.sticky) return
        e.preventDefault()
        e.stopPropagation()
        swallowNextClick()
        if (e.button === 0) choose(cur, hoverAt(cur, e.clientX, e.clientY).hover)
        else setOpen(null)
        return
      }
      if (e.button !== 2 || !inside(e.target)) return
      if (useDiagram.getState().overlayOpen) return
      e.preventDefault()
      start = { x: e.clientX, y: e.clientY }
      begin(e.clientX, e.clientY, 'mouse', false)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current) e.stopPropagation()
    }
    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      const cur = ref.current
      if (cur) {
        const next = hoverAt(cur, e.clientX, e.clientY)
        if (next !== cur) setOpen(next)
      }
    }
    const onUp = (e: PointerEvent) => {
      const cur = ref.current
      if (!cur || cur.by !== 'mouse' || cur.sticky || e.button !== 2) return
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (isTap(performance.now() - pressAt.current, moved)) {
        setOpen({ ...cur, sticky: true })
        return
      }
      choose(cur, hoverAt(cur, e.clientX, e.clientY).hover)
    }
    const onWheel = (e: WheelEvent) => {
      const cur = ref.current
      if (!cur) return
      e.preventDefault()
      e.stopPropagation()
      const item = cur.ring[cur.hover]
      if (!item?.subs?.length) return
      const now = currentSub(item, remembered[item.id])
      const index = item.subs.findIndex((s) => s.id === now?.id)
      const next = item.subs[cycleSub(index, e.deltaY > 0 ? 1 : -1, item.subs.length)]
      if (!next) return
      remembered = { ...remembered, [item.id]: next.id }
      setSubs(remembered)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const cur = ref.current
      if (e.key === 'Escape' && cur) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(null)
        return
      }
      if ((e.key === 'q' || e.key === 'Q') && !e.repeat && !cur) {
        if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
        if (useDiagram.getState().overlayOpen || last.x < 0) return
        const el = document.elementFromPoint(last.x, last.y)
        if (!inside(el)) return
        start = { ...last }
        if (begin(last.x, last.y, 'key', false)) e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const cur = ref.current
      if ((e.key === 'q' || e.key === 'Q') && cur && cur.by === 'key') {
        choose(cur, cur.hover)
      }
    }
    const onBlur = () => {
      if (ref.current && !ref.current.sticky) setOpen(null)
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [begin, choose, setOpen, wrapRef])

  const openFromWire = useCallback(
    (point: { x: number; y: number }, from: number) => {
      begin(point.x, point.y, 'mouse', true, { linkFrom: from })
    },
    [begin]
  )

  const element = open ? (
    <RadialMenu
      ring={open.ring}
      centre={open.centre}
      hover={open.hover}
      sticky={open.sticky}
      subs={subs}
      isDisabled={(item, subId) => disabled(open, item, subId)}
    />
  ) : null

  return { element, isOpen: () => ref.current !== null, openFromWire }
}

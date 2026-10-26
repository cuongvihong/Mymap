import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeChange,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { snapDrag } from '../../../../shared/diagram/arrange'
import {
  blockWidth,
  dropTarget,
  unionRect,
  type FrameRect
} from '../../../../shared/diagram/frames'
import { connect, type Rect } from '../../../../shared/diagram/geometry'
import { forkMarks } from '../../../../shared/diagram/scenarioView'
import { fixMatches } from '../../../../shared/diagram/search'
import type { LinkData, Viewport } from '../../../../shared/diagram/types'
import { PlayCaption } from '../play/PlayCaption'
import { PlayPeekHost } from '../play/PlayPeekHost'
import { DetailPanel } from '../panels/DetailPanel'
import { RecorderPanel } from '../scenario/RecorderPanel'
import { useRadial } from '../radial/useRadial'
import { diagramStrings as t } from '../strings'
import { PALETTE_MIME, useDiagram, type BlockSpec, type DeleteRequest } from '../store/diagramStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { BlockNodeComponent, typeColor, type BlockData, type BlockFlowNode } from './BlockNode'
import { CanvasToolbar } from './CanvasToolbar'
import { ChannelLayer } from './ChannelLayer'
import { ChannelPopover } from './ChannelPopover'
import { layoutScope } from '../data/layoutScope'
import { FramesLayer, GuidesLayer } from './Layers'
import { ScenarioLayer } from './ScenarioLayer'
import { buildScenarioLines } from './scenarioLines'
import { blockRect, buildCanvasModel, type FrameModel, type PairModel } from './model'
import styles from './FlowCanvas.module.css'

const nodeTypes = { block: BlockNodeComponent }
const ZOOM = { min: 0.15, max: 1.6 }
const FIT = { padding: 0.06, maxZoom: 1.2, duration: 300 } as const

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** Text of the confirmation to delete blocks: scenarios that lose a step, branches that turn into roots (FR-SUA-06). */
function DeleteBody({ request }: { request: DeleteRequest }) {
  const data = useDiagram((s) => s.data)
  const blocks = (data?.nodes ?? []).filter((n) => request.ids.includes(n.id))
  const keys = (list: { key: string }[]) => list.map((x) => x.key).join(', ')
  return (
    <>
      <p>
        {request.ids.length === 1
          ? t.del.one
          : t.del.many.replace('{n}', String(request.ids.length))}{' '}
        <b>{blocks.map((n) => n.code).join(', ')}</b>
      </p>
      {request.linkCount > 0 && <p>{t.del.links.replace('{n}', String(request.linkCount))}</p>}
      {request.affected.length > 0 && (
        <p>
          {t.del.affected} <b>{keys(request.affected)}</b>.
        </p>
      )}
      {request.detached.length > 0 && (
        <p>
          <b>{keys(request.detached)}</b> {t.del.root}.
        </p>
      )}
      <p>{t.del.hint}</p>
    </>
  )
}

function CanvasInner() {
  const data = useDiagram((s) => s.data)
  const sizes = useDiagram((s) => s.sizes)
  const focusId = useDiagram((s) => s.focusId)
  const selectedScenarios = useDiagram((s) => s.selectedScenarios)
  const fsExists = useDiagram((s) => s.fsExists)
  const minimap = useDiagram((s) => s.minimap)
  const viewRequest = useDiagram((s) => s.viewRequest)
  const channelMode = useDiagram((s) => s.channelMode)
  const filterUncovered = useDiagram((s) => s.filterUncovered)
  const popover = useDiagram((s) => s.popover)
  const selected = useDiagram((s) => s.selected)
  const fixFilter = useDiagram((s) => s.fixFilter)
  const linking = useDiagram((s) => s.linking)
  const deleteRequest = useDiagram((s) => s.deleteRequest)
  const play = useDiagram((s) => s.play)
  const recorder = useDiagram((s) => s.recorder)
  const scenarioDelete = useDiagram((s) => s.deleteScenarioRequest)
  const rf = useReactFlow()
  /** While a scenario plays only that one is lit, whatever was selected in the sidebar. */
  const litScenarios = useMemo(
    () => (play ? [play.scenarioId] : selectedScenarios),
    [play, selectedScenarios]
  )
  const [removing, setRemoving] = useState<FrameModel | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const fixIds = useMemo(
    () => (data && fixFilter.trim() !== '' ? fixMatches(data.nodes, fixFilter) : null),
    [data, fixFilter]
  )

  const model = useMemo(
    () =>
      data
        ? buildCanvasModel({
            data,
            sizes,
            focusId,
            selectedScenarios: litScenarios,
            filterUncovered,
            fixIds
          })
        : null,
    [data, sizes, focusId, litScenarios, filterUncovered, fixIds]
  )
  const modelRef = useRef(model)
  useEffect(() => {
    modelRef.current = model
  }, [model])
  const radial = useRadial(wrapRef, model)

  const forks = useMemo(
    () => (data ? forkMarks(data.scenarios, litScenarios) : new Map<number, string[]>()),
    [data, litScenarios]
  )
  const runningNode = play ? (play.steps[play.index]?.nodeId ?? null) : null
  const runningType = play
    ? (data?.scenarios.find((s) => s.id === play.scenarioId)?.type ?? null)
    : null

  const lines = useMemo(
    () =>
      data && model
        ? buildScenarioLines({
            data,
            rects: model.rects,
            scenarioIds: litScenarios,
            draft: recorder?.draft ?? null
          })
        : [],
    [data, model, litScenarios, recorder?.draft]
  )
  /** The hop the dot of Play runs along. */
  const travel = play?.travel ?? null
  const dot = useMemo(() => {
    if (!travel || !model || !runningType) return null
    const a = model.rects.get(travel.from)
    const b = model.rects.get(travel.to)
    return a && b && a !== b ? { d: connect(a, b, 0).d, type: runningType } : null
  }, [travel, model, runningType])

  const nodes = useMemo<BlockFlowNode[]>(() => {
    if (!model) return []
    const picked = new Set(selected)
    return model.blocks.map((b) => {
      const n = b.node
      const size = sizes[n.id]
      const state: BlockData['fsState'] = !n.fsFile
        ? 'unknown'
        : fsExists === null
          ? 'unknown'
          : fsExists[n.fsFile] === false
            ? 'missing'
            : 'ok'
      return {
        id: String(n.id),
        type: 'block',
        position: { x: n.x, y: n.y },
        // React Flow forgets the measurement of a controlled node unless it is passed back.
        ...(size ? { measured: { width: blockWidth(n.type), height: size.h } } : {}),
        selectable: false,
        selected: picked.has(n.id),
        data: {
          node: n,
          display: b.display,
          selected: picked.has(n.id),
          fsState: state,
          fsLabel: [n.fsFile, n.fsSection].filter(Boolean).join(' '),
          coverage: n.type === 'req' ? (model.coverage.get(n.id) ?? 0) : null,
          running: runningNode === n.id ? runningType : null,
          forks: forks.get(n.id) ?? []
        }
      }
    })
  }, [model, sizes, selected, fsExists, runningNode, runningType, forks])

  // --- drag ---------------------------------------------------------------------------------
  const frozen = useRef<FrameRect<number>[]>([])
  const onNodeDragStart = useCallback<OnNodeDrag<BlockFlowNode>>(
    (_e, _node, dragged) => {
      useDiagram.getState().beginMove(dragged.map((n) => Number(n.id)))
      frozen.current = (model?.frames ?? [])
        .filter((f) => !f.collapsed)
        .map((f) => ({ id: f.group.id, rect: f.rect }))
    },
    [model]
  )

  /** Rectangle of a block as the store has it now, so snapping is included. */
  const liveRect = useCallback((id: number): Rect | null => {
    const st = useDiagram.getState()
    const found = st.data?.nodes.find((n) => n.id === id)
    return found ? blockRect(found, st.sizes) : null
  }, [])

  const onNodeDrag = useCallback<OnNodeDrag<BlockFlowNode>>(
    (_e, node, dragged) => {
      const rect = dragged.length === 1 ? liveRect(Number(node.id)) : null
      useDiagram.getState().setDropGroup(rect ? dropTarget(rect, frozen.current) : null)
    },
    [liveRect]
  )

  const onNodeDragStop = useCallback<OnNodeDrag<BlockFlowNode>>(
    (_e, node, dragged) => {
      const ids = dragged.map((n) => Number(n.id))
      // A group change is only for one block; a selection moves as it is.
      const rect = ids.length === 1 ? liveRect(Number(node.id)) : null
      const group = rect ? dropTarget(rect, frozen.current) : undefined
      void useDiagram.getState().commitMove(ids, group)
    },
    [liveRect]
  )

  const onNodesChange = useCallback((changes: NodeChange<BlockFlowNode>[]) => {
    const store = useDiagram.getState()
    let moves: { id: number; x: number; y: number }[] = []
    let dragging = false
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        moves.push({ id: Number(c.id), x: c.position.x, y: c.position.y })
        if (c.dragging) dragging = true
      } else if (c.type === 'dimensions' && c.dimensions) {
        store.setSize(Number(c.id), { w: c.dimensions.width, h: c.dimensions.height })
      }
    }
    if (moves.length === 0) return
    if (dragging && store.data) {
      // Edges and centres snap to the other blocks, else the corner snaps to the 16 px grid (FR-SUA-03).
      const rects: Rect[] = []
      for (const m of moves) {
        const found = store.data.nodes.find((n) => n.id === m.id)
        if (found) rects.push({ ...blockRect(found, store.sizes), x: m.x, y: m.y })
      }
      const box = unionRect(rects)
      if (box) {
        const moving = new Set(moves.map((m) => m.id))
        const others = (modelRef.current?.blocks ?? [])
          .filter((b) => !moving.has(b.node.id))
          .map((b) => b.rect)
        const snap = snapDrag(box, others)
        moves = moves.map((m) => ({ ...m, x: m.x + snap.dx, y: m.y + snap.dy }))
        store.setGuides(snap.guides)
      }
    }
    store.setLivePositions(moves)
  }, [])

  // --- channels -----------------------------------------------------------------------------
  /** Block under a screen point, found through the DOM so the whole block is a drop target. */
  const blockAt = useCallback((x: number, y: number): number | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const wrapper = el.closest('.react-flow__node')
      const id = wrapper?.getAttribute('data-id')
      if (id) return Number(id)
    }
    return null
  }, [])

  const pointOf = (e: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } => {
    if ('changedTouches' in e) {
      const t0 = e.changedTouches[0]
      return { x: t0?.clientX ?? 0, y: t0?.clientY ?? 0 }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const onConnectStart = useCallback<OnConnectStart>((_e, params) => {
    if (params.nodeId) useDiagram.getState().setConnecting(Number(params.nodeId))
  }, [])

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event) => {
      const s = useDiagram.getState()
      const from = s.connecting
      s.setConnecting(null)
      if (from === null) return
      const p = pointOf(event)
      const target = blockAt(p.x, p.y)
      // Dropped on the bare canvas: the ring offers a new block joined to the wire (FR-LK-02).
      if (target === null) {
        radial.openFromWire(p, from)
        return
      }
      void s.createLink(from, target)
    },
    [blockAt, radial]
  )

  /** Drag an end of the selected channel onto another block (FR-LK-06). */
  const onGripDown = useCallback(
    (e: React.PointerEvent, link: LinkData, end: 'from' | 'to') => {
      e.stopPropagation()
      e.preventDefault()
      const store = useDiagram.getState()
      const toWorld = (ev: PointerEvent) =>
        rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      const first = toWorld(e.nativeEvent)
      store.setReconnect({ linkId: link.id, end, x: first.x, y: first.y })
      const move = (ev: PointerEvent) => {
        const w = toWorld(ev)
        useDiagram.getState().setReconnect({ linkId: link.id, end, x: w.x, y: w.y })
      }
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        const st = useDiagram.getState()
        st.setReconnect(null)
        if (ev.type === 'pointercancel') return
        const target = blockAt(ev.clientX, ev.clientY)
        if (target === null) return
        const patch = end === 'from' ? { fromNode: target } : { toNode: target }
        const current = st.data?.links.find((l) => l.id === link.id)
        if (!current || (end === 'from' ? current.fromNode : current.toNode) === target) return
        void st.updateLink(link.id, patch)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [rf, blockAt]
  )

  const onOpenPair = useCallback(
    (pair: PairModel, mid: readonly [number, number]) => {
      const screen = rf.flowToScreenPosition({ x: mid[0], y: mid[1] })
      const box = wrapRef.current?.getBoundingClientRect()
      useDiagram.getState().openPopover({
        key: pair.key,
        x: screen.x - (box?.left ?? 0),
        y: screen.y - (box?.top ?? 0)
      })
    },
    [rf]
  )

  // --- highlight ----------------------------------------------------------------------------
  const onNodeDoubleClick = useCallback<NodeMouseHandler>((_e, node) => {
    const store = useDiagram.getState()
    if (store.recorder || store.play) return
    store.setFocus(Number(node.id))
  }, [])
  const onNodeClick = useCallback<NodeMouseHandler>((e, node) => {
    const store = useDiagram.getState()
    // Recording: a click on a block is a step. The second click of a double click is not.
    if (store.recorder) {
      if (e.detail < 2) store.recordStep(Number(node.id))
      return
    }
    if (store.play) return
    if (e.ctrlKey || e.metaKey || e.shiftKey) store.toggleSelect(Number(node.id))
    else store.selectNode(Number(node.id))
  }, [])

  // --- new blocks ---------------------------------------------------------------------------
  /** Creates a block of the palette at a world point, inside the group frame under it. */
  const placeSpec = useCallback(
    async (spec: BlockSpec, at: { x: number; y: number }, topLeft = false) => {
      const frames = (modelRef.current?.frames ?? [])
        .filter((f) => !f.collapsed)
        .map((f) => ({ id: f.group.id, rect: f.rect }))
      const groupId = dropTarget({ x: at.x, y: at.y, w: 1, h: 1 }, frames)
      const point = spec.type === 'group' && !topLeft ? { x: at.x - 200, y: at.y - 130 } : at
      await useDiagram.getState().createBlock(spec, point, { groupId, edit: true })
    },
    []
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(PALETTE_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(PALETTE_MIME)
      if (!raw) return
      e.preventDefault()
      try {
        const spec = JSON.parse(raw) as BlockSpec
        void placeSpec(spec, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), true)
      } catch {
        // Not one of ours.
      }
    },
    [placeSpec, rf]
  )

  // --- camera -------------------------------------------------------------------------------
  const allRects = useCallback((): Rect[] => {
    if (!model) return []
    return [...model.blocks.map((b) => b.rect), ...model.frames.map((f) => f.rect)]
  }, [model])

  const handled = useRef(useDiagram.getState().viewRequest?.seq ?? 0)
  useEffect(() => {
    if (!viewRequest || viewRequest.seq === handled.current || !model) return
    handled.current = viewRequest.seq
    const store = useDiagram.getState()
    if (viewRequest.kind === 'fit' || viewRequest.kind === 'group') {
      const box =
        viewRequest.kind === 'fit'
          ? unionRect(allRects())
          : (model.frames.find((f) => f.group.id === viewRequest.groupId)?.rect ?? null)
      if (box) void rf.fitBounds({ x: box.x, y: box.y, width: box.w, height: box.h }, FIT)
    } else if (viewRequest.kind === 'play') {
      const rect = model.rects.get(viewRequest.nodeId)
      if (!rect) return
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      if (viewRequest.ms === 0) {
        // Reduced motion: no glide. The camera only jumps when the block is out of sight.
        const box = wrapRef.current?.getBoundingClientRect()
        const a = rf.flowToScreenPosition({ x: rect.x, y: rect.y })
        const b = rf.flowToScreenPosition({ x: rect.x + rect.w, y: rect.y + rect.h })
        const hidden =
          !box || a.x < box.left || a.y < box.top || b.x > box.right || b.y > box.bottom
        if (hidden) void rf.setCenter(cx, cy, { zoom: rf.getZoom(), duration: 0 })
      } else {
        const zoom = viewRequest.first ? Math.min(1, Math.max(0.5, rf.getZoom())) : rf.getZoom()
        void rf.setCenter(cx, cy, { zoom, duration: viewRequest.ms })
      }
    } else if (viewRequest.kind === 'node') {
      const found = store.data?.nodes.find((n) => n.id === viewRequest.nodeId)
      const rect =
        model.blocks.find((b) => b.node.id === viewRequest.nodeId)?.rect ??
        (found ? blockRect(found, store.sizes) : null)
      if (rect) {
        void rf.setCenter(rect.x + rect.w / 2, rect.y + rect.h / 2, { zoom: 1, duration: 300 })
      }
    } else {
      // A block from the palette goes to the middle of what is on screen.
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const at = rf.screenToFlowPosition({
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
      })
      void placeSpec(viewRequest.spec, at)
    }
    // placeSpec is stable: it only reads from the store and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRequest, model, rf, allRects])

  const pending = useRef<Viewport | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const vp = pending.current
    pending.current = null
    if (vp) useDiagram.getState().saveViewport(vp)
  }, [])
  const onMoveEnd = useCallback(
    (_e: unknown, vp: Viewport) => {
      pending.current = { x: vp.x, y: vp.y, zoom: vp.zoom }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 400)
    },
    [flush]
  )
  // The camera is remembered when the project closes (FR-CV-04).
  useEffect(() => flush, [flush])

  // The popover is anchored to a screen point, so it closes when the camera moves or on an outside click.
  useEffect(() => {
    if (!popover) return
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null
      if (el?.closest('[data-popover]') || el?.closest('[data-badge]')) return
      useDiagram.getState().closePopover()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [popover])

  // --- keyboard -----------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const s = useDiagram.getState()
      if (s.overlayOpen) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.altKey) {
        const key = e.key.toLowerCase()
        if (key === 'z') {
          e.preventDefault()
          void (e.shiftKey ? s.redo() : s.undo())
        } else if (key === 'y') {
          e.preventDefault()
          void s.redo()
        } else if (key === 'c') {
          s.copySelection()
        } else if (key === 'v') {
          e.preventDefault()
          void s.pasteSmart()
        } else if (key === 'd') {
          e.preventDefault()
          void s.duplicate(s.selected)
        }
        return
      }
      if (e.altKey) return
      if (e.key === 'f' || e.key === 'F') {
        s.requestFit()
      } else if (e.key === 'l' || e.key === 'L') {
        void s.autoLayout(layoutScope())
      } else if (e.key === '/') {
        e.preventDefault()
        s.setSearchOpen(true)
      } else if (e.key === 'Escape') {
        if (s.editingId !== null) return
        if (s.recorder) {
          e.preventDefault()
          s.requestCancelRecording()
          return
        }
        if (s.popover) {
          s.closePopover()
          return
        }
        if (s.linking !== null) {
          s.startLinking(null)
          return
        }
        if (s.detailLinkId !== null) {
          s.selectLink(null)
          return
        }
        s.clearHighlight()
      } else if (e.key === 'Delete') {
        if (s.detailLinkId !== null) void s.removeLinks([s.detailLinkId])
        else if (s.selected.length > 0) void s.requestDelete(s.selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- selection box (Shift and drag) --------------------------------------------------------
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  )
  const onMouseDownCapture = (e: React.MouseEvent) => {
    if (e.button !== 0 || !e.shiftKey || e.ctrlKey || e.metaKey) return
    const target = e.target as Element
    if (
      target.closest(
        '.react-flow__node, [role="toolbar"], aside, [data-popover], .react-flow__minimap, [data-grip]'
      )
    )
      return
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    e.stopPropagation()
    e.preventDefault()
    const origin = { x: e.clientX, y: e.clientY }
    const rel = (x: number, y: number) => ({
      x: Math.min(origin.x, x) - box.left,
      y: Math.min(origin.y, y) - box.top,
      w: Math.abs(origin.x - x),
      h: Math.abs(origin.y - y)
    })
    setMarquee(rel(origin.x, origin.y))
    const move = (ev: MouseEvent) => setMarquee(rel(ev.clientX, ev.clientY))
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setMarquee(null)
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return
      // The click that follows the release must not count as a click on the bare canvas.
      window.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true })
      const a = rf.screenToFlowPosition(origin)
      const b = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      const area = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y)
      }
      const ids = (modelRef.current?.blocks ?? [])
        .filter(
          (blk) =>
            blk.rect.x < area.x + area.w &&
            blk.rect.x + blk.rect.w > area.x &&
            blk.rect.y < area.y + area.h &&
            blk.rect.y + blk.rect.h > area.y
        )
        .map((blk) => blk.node.id)
      useDiagram.getState().select(ids)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  /** Pressing an unselected block selects it first, so the drag moves the right set (FR-SUA-02). */
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return
    const id = (e.target as Element).closest('.react-flow__node')?.getAttribute('data-id')
    if (!id) return
    const st = useDiagram.getState()
    if (!st.selected.includes(Number(id))) st.selectOnly([Number(id)])
  }

  // --- "Nối tới": a line follows the pointer until a block is clicked --------------------------
  const [linkMouse, setLinkMouse] = useState<{ x: number; y: number } | null>(null)
  const [linkOrigin, setLinkOrigin] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  useEffect(() => {
    if (linking === null) return
    const move = (e: PointerEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (box) setLinkOrigin({ left: box.left, top: box.top })
      setLinkMouse({ x: e.clientX, y: e.clientY })
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      window.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true })
      const from = useDiagram.getState().linking
      useDiagram.getState().startLinking(null)
      const target = blockAt(e.clientX, e.clientY)
      if (from !== null && target !== null && target !== from) {
        void useDiagram.getState().createLink(from, target)
      }
    }
    const stopMouse = (e: MouseEvent) => e.stopPropagation()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('mousedown', stopMouse, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('mousedown', stopMouse, true)
      setLinkMouse(null)
    }
  }, [linking, blockAt])

  /** The line of "Nối tới", from the right edge of the source block to the pointer. */
  const linkLine = (from: number, mouse: { x: number; y: number }) => {
    const block = model?.blocks.find((b) => b.node.id === from)
    if (!block) return null
    const start = rf.flowToScreenPosition({
      x: block.rect.x + block.rect.w,
      y: block.rect.y + block.rect.h / 2
    })
    return (
      <svg className={styles.linkLine} aria-hidden>
        <line
          x1={start.x - linkOrigin.left}
          y1={start.y - linkOrigin.top}
          x2={mouse.x - linkOrigin.left}
          y2={mouse.y - linkOrigin.top}
        />
      </svg>
    )
  }

  if (!data || !model) return null

  const highlighted = focusId !== null || selectedScenarios.length > 0 || play !== null
  const empty = data.nodes.length === 0

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDownCapture={onMouseDownCapture}
      onPointerDownCapture={onPointerDownCapture}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<BlockFlowNode>
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={(e) => {
          const st = useDiagram.getState()
          if (e.detail === 2) st.clearHighlight()
          else if (st.detailLinkId !== null) st.selectLink(null)
          else if (st.selected.length > 1) st.select([])
        }}
        onPaneContextMenu={(e) => e.preventDefault()}
        onMoveEnd={onMoveEnd}
        onMoveStart={() => useDiagram.getState().closePopover()}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        connectionLineStyle={{ stroke: 'var(--dg-accent)', strokeWidth: 2 }}
        zoomOnDoubleClick={false}
        panOnDrag={[0, 1]}
        panActivationKeyCode="Space"
        elementsSelectable={false}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesConnectable
        nodeDragThreshold={3}
        nodeClickDistance={3}
        minZoom={ZOOM.min}
        maxZoom={ZOOM.max}
        defaultViewport={data.viewport ?? undefined}
        fitView={data.viewport === null}
        fitViewOptions={{ padding: FIT.padding, maxZoom: FIT.maxZoom }}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        aria-label={t.canvas.region}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--dg-dot)" />
        <FramesLayer frames={model.frames} onRemove={setRemoving} />
        <GuidesLayer />
        <ScenarioLayer lines={lines} dot={dot} />
        <ChannelLayer
          pairs={model.pairs}
          mode={channelMode}
          onOpenPair={onOpenPair}
          onGripDown={onGripDown}
        />
        {minimap && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            className={styles.minimap}
            maskColor="rgba(0, 0, 0, 0.45)"
            nodeColor={(n) => typeColor((n.data as BlockData).node)}
            nodeStrokeWidth={0}
          />
        )}
      </ReactFlow>

      <CanvasToolbar highlighted={highlighted} />
      {marquee && (
        <div
          className={styles.marquee}
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
      {linking !== null && linkMouse && linkLine(linking, linkMouse)}
      {radial.element}
      {empty && <p className={styles.empty}>{t.canvas.empty}</p>}
      {popover && model.pairs.find((p) => p.key === popover.key) && (
        <ChannelPopover pair={model.pairs.find((p) => p.key === popover.key) as PairModel} />
      )}
      <DetailPanel />
      <PlayCaption />
      <PlayPeekHost />
      <RecorderPanel />

      {deleteRequest && (
        <ConfirmDialog
          title={t.del.title}
          onClose={() => useDiagram.getState().cancelDelete()}
          actions={[
            { label: t.del.cancel, onClick: () => useDiagram.getState().cancelDelete() },
            {
              label: t.del.confirm,
              kind: 'danger',
              onClick: () => void useDiagram.getState().confirmDelete()
            }
          ]}
        >
          <DeleteBody request={deleteRequest} />
        </ConfirmDialog>
      )}

      {scenarioDelete && (
        <ConfirmDialog
          title={t.scenario.removeTitle.replace('{key}', scenarioDelete.key)}
          onClose={() => useDiagram.getState().cancelDeleteScenario()}
          actions={
            scenarioDelete.children.length === 0
              ? [
                  {
                    label: t.scenario.cancelDelete,
                    onClick: () => useDiagram.getState().cancelDeleteScenario()
                  },
                  {
                    label: t.scenario.confirmDelete,
                    kind: 'danger',
                    onClick: () => void useDiagram.getState().confirmDeleteScenario('cascade')
                  }
                ]
              : [
                  {
                    label: t.scenario.cancelDelete,
                    onClick: () => useDiagram.getState().cancelDeleteScenario()
                  },
                  {
                    label: t.scenario.removePromote,
                    kind: 'primary',
                    onClick: () => void useDiagram.getState().confirmDeleteScenario('promote')
                  },
                  {
                    label: t.scenario.removeCascade,
                    kind: 'danger',
                    onClick: () => void useDiagram.getState().confirmDeleteScenario('cascade')
                  }
                ]
          }
        >
          {scenarioDelete.children.length === 0 ? (
            <p>{t.scenario.removeAsk.replace('{key}', scenarioDelete.key)}</p>
          ) : (
            <p>
              {t.scenario.removeChildren
                .replace('{key}', scenarioDelete.key)
                .replace('{list}', scenarioDelete.children.map((c) => c.key).join(', '))}
            </p>
          )}
          <p>{t.scenario.removeHint}</p>
        </ConfirmDialog>
      )}

      {removing && (
        <ConfirmDialog
          title={t.group.removeTitle}
          onClose={() => setRemoving(null)}
          actions={
            removing.memberIds.length === 0
              ? [
                  { label: t.group.cancel, onClick: () => setRemoving(null) },
                  {
                    label: t.group.keepBlocks,
                    kind: 'danger',
                    onClick: () => {
                      void useDiagram.getState().removeGroup(removing.group.id, true)
                      setRemoving(null)
                    }
                  }
                ]
              : [
                  { label: t.group.cancel, onClick: () => setRemoving(null) },
                  {
                    label: t.group.keepBlocks,
                    kind: 'primary',
                    onClick: () => {
                      void useDiagram.getState().removeGroup(removing.group.id, true)
                      setRemoving(null)
                    }
                  },
                  {
                    label: t.group.deleteBlocks,
                    kind: 'danger',
                    onClick: () => {
                      void useDiagram.getState().removeGroup(removing.group.id, false)
                      setRemoving(null)
                    }
                  }
                ]
          }
        >
          {removing.memberIds.length === 0
            ? t.group.removeEmpty
            : t.group.removeAsk.replace('{n}', String(removing.memberIds.length))}
        </ConfirmDialog>
      )}
    </div>
  )
}

/** The map. React Flow does the pan, zoom and block dragging; frames and channels are drawn by us. */
export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

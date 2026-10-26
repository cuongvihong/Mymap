import { create } from 'zustand'
import {
  alignMoves,
  distributeMoves,
  type AlignMode,
  type Box,
  type DistributeAxis,
  type Guide,
  type Move
} from '../../../../shared/diagram/arrange'
import { defaultVia } from '../../../../shared/diagram/channels'
import { planClone } from '../../../../shared/diagram/clone'
import { dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import { History } from '../../../../shared/diagram/history'
import { linkProblem } from '../../../../shared/diagram/linkrules'
import { scenariosForkedAt, scenariosUsingNodes } from '../../../../shared/diagram/scenario'
import { snapshotNodes } from '../../../../shared/diagram/snapshot'
import type {
  AffectedScenario,
  BundleLink,
  ChannelMode,
  GroupData,
  ImageData,
  IpcResult,
  LinkData,
  LinkPatch,
  NodeData,
  NodeInput,
  NodePatch,
  PinData,
  PinInput,
  PinPatch,
  ProjectData,
  RestoreBundle,
  RestoreResult,
  Viewport
} from '../../../../shared/diagram/types'
import { blockRect } from '../canvas/model'
import {
  createScenarioSlice,
  disposePlayer,
  SCENARIO_EMPTY,
  type ScenarioSliceActions,
  type ScenarioSliceState
} from './scenarioSlice'
import {
  createDataSlice,
  DATA_EMPTY,
  YAML_PANEL_DEFAULT_WIDTH,
  type DataSliceActions,
  type DataSliceState
} from './dataSlice'

/** Receives the error code of a failed call. The shell turns it into a Vietnamese toast. */
type ErrorSink = (code: string) => void
let errorSink: ErrorSink = () => {}
export function setDiagramErrorSink(sink: ErrorSink): void {
  errorSink = sink
}

/** Receives a ready made message, for example the reason a channel was refused. */
export interface NoticeOptions {
  /** `info` is a result such as "Đã chép", `error` a refusal. Errors by default. */
  kind?: 'info' | 'error'
  action?: { label: string; run: () => void }
}
type NoticeSink = (text: string, options?: NoticeOptions) => void
let noticeSink: NoticeSink = () => {}
export function setDiagramNoticeSink(sink: NoticeSink): void {
  noticeSink = sink
}

/** What the canvas should do with the camera, requested by the sidebar, the top bar and the F key. */
export type ViewRequest =
  | { seq: number; kind: 'fit' }
  | { seq: number; kind: 'group'; groupId: number }
  | { seq: number; kind: 'node'; nodeId: number }
  /** Camera glide to the block Play is on. `ms` is 0 under reduced motion: then it only jumps when the block is off screen. */
  | { seq: number; kind: 'play'; nodeId: number; ms: number; first: boolean }
  /** Add a block of the palette at the middle of the visible canvas. */
  | { seq: number; kind: 'add'; spec: BlockSpec }

export interface Size {
  w: number
  h: number
}

export interface Popover {
  /** Key of the pair of blocks. */
  key: string
  /** Where it sits, in pixels from the top left corner of the canvas. */
  x: number
  y: number
}

/** What to create when a block is added: from the radial ring, the palette or a dropped wire. */
export interface BlockSpec {
  /** A block type, or 'group' for an empty group frame. */
  type: NodeInput['type'] | 'group'
  subtype?: string | null
}

/** A pending confirmation to delete blocks (FR-SUA-06). */
export interface DeleteRequest {
  ids: number[]
  /** Scenarios whose full path goes through a block that would be deleted. */
  affected: AffectedScenario[]
  /** Branches that fork at one of them and would become root scenarios. */
  detached: AffectedScenario[]
  /** Number of channels that go with the blocks. */
  linkCount: number
}

export interface Box4 {
  x: number
  y: number
  w: number
  h: number
}

export interface ViewerRequest {
  imageId: number
  /** Index of the pin to show first, -1 for the whole image. */
  pin: number
  /** Screen rectangle of the thumbnail the image grows out of. */
  from: Box4 | null
}

export interface PeekRequest {
  imageId: number
  /** Screen rectangle of the block, the preview opens beside it. */
  anchor: Box4
}

/** One step of undo and redo (TDD 8.8). Both sides return false when the call failed. */
interface Command {
  label: string
  undo(): Promise<boolean>
  redo(): Promise<boolean>
}

const history = new History<Command>()

export interface Reconnect {
  linkId: number
  /** Which end of the channel is being dragged. */
  end: 'from' | 'to'
  /** Pointer position in world coordinates. */
  x: number
  y: number
}

export interface DiagramState
  extends ScenarioSliceState, ScenarioSliceActions, DataSliceState, DataSliceActions {
  data: ProjectData | null
  channelMode: ChannelMode
  /** The sidebar filter that lights only the REQ blocks without a Function (FR-KH-08). */
  filterUncovered: boolean
  /** Pair under the pointer in one-wire mode, drawn as separate wires while it lasts. */
  hoverPair: string | null
  popover: Popover | null
  /** Channel shown in the panel and selected on the canvas. */
  detailLinkId: number | null
  /** Block a new channel is being dragged from. */
  connecting: number | null
  reconnect: Reconnect | null
  loading: boolean
  /** Block under the double click focus (FR-CV-05). */
  focusId: number | null
  /** Scenarios selected in the sidebar, for FR-CV-07. */
  selectedScenarios: number[]
  /** Block shown in the detail panel (FR-KH-07). */
  detailId: number | null
  /** Block whose title is being renamed in place. */
  editingId: number | null
  /** Measured size of each block, used by frames and channels. */
  sizes: Record<number, Size>
  /** Group frame lit up while a block hovers over it. */
  dropGroupId: number | null
  /** Relative document path to whether the file exists. Null while unknown or without a documents folder. */
  fsExists: Record<string, boolean> | null
  minimap: boolean
  viewRequest: ViewRequest | null
  /** Any overlay that should keep Esc for itself (confirmation box, popover). */
  overlayOpen: boolean
  /** Blocks selected on the canvas (FR-SUA-02). */
  selected: number[]
  /** Alignment lines shown while a block is dragged (FR-SUA-03). */
  guides: Guide[]
  deleteRequest: DeleteRequest | null
  /** Pairs the user split or merged by hand, on top of the global one wire or many wires mode. */
  pairView: Record<string, 'split' | 'merge'>
  /** Block a channel is being drawn from by the "Nối tới" ring item. */
  linking: number | null
  /** Phrase of the "Nơi sửa" filter (FR-TIM-02). */
  fixFilter: string
  searchOpen: boolean
  /** Channel whose label field should take the cursor. */
  labelFocusLinkId: number | null
  undoLabel: string | null
  redoLabel: string | null
  /** Image open in the lightbox, the pin to zoom to at once and where the thumbnail was (FLIP). */
  viewer: ViewerRequest | null
  /** Thumbnail the pointer rests on, for the enlarged preview beside the block. */
  peek: PeekRequest | null

  select(ids: number[]): void
  /** Changes the selection without opening a panel. */
  selectOnly(ids: number[]): void
  toggleSelect(id: number): void
  setGuides(guides: Guide[]): void
  beginMove(ids: number[]): void
  createBlock(
    spec: BlockSpec,
    at: { x: number; y: number },
    opts?: { groupId?: number | null; edit?: boolean; linkFrom?: number }
  ): Promise<number | null>
  requestDelete(ids: number[]): Promise<void>
  confirmDelete(): Promise<void>
  cancelDelete(): void
  copySelection(): void
  paste(): Promise<void>
  duplicate(ids: number[]): Promise<void>
  align(mode: AlignMode): Promise<void>
  distribute(axis: DistributeAxis): Promise<void>
  gatherIntoGroup(ids: number[], target: number | 'new'): Promise<void>
  renameGroup(id: number, title: string): Promise<void>
  undo(): Promise<void>
  redo(): Promise<void>
  togglePair(key: string, split: boolean): void
  startLinking(fromId: number | null): void
  setFixFilter(text: string): void
  setSearchOpen(open: boolean): void
  goToNode(id: number): void
  requestAdd(spec: BlockSpec): void
  focusLinkLabel(id: number | null): void

  /** Shows the message of an error code in the red toast. */
  reportError(code: string): void
  openViewer(request: ViewerRequest): void
  closeViewer(): void
  setPeek(peek: PeekRequest | null): void
  /** File dialog, then the chosen images are added to the block. */
  pickImages(nodeId: number): Promise<void>
  addImageFiles(nodeId: number, files: File[]): Promise<void>
  /** Ctrl+V: an image on the system clipboard goes to the selected block, otherwise blocks are pasted. */
  pasteSmart(): Promise<void>
  noteClipboardChanged(): void
  removeImage(id: number): Promise<void>
  reorderImages(nodeId: number, ids: number[]): Promise<void>
  setImageCaption(id: number, caption: string): Promise<void>
  createPin(imageId: number, input: PinInput): Promise<PinData | null>
  updatePin(id: number, patch: PinPatch): Promise<void>
  removePin(id: number): Promise<void>
  reorderPins(imageId: number, ids: number[]): Promise<void>
  setChannelMode(mode: ChannelMode): void
  toggleFilterUncovered(): void
  setHoverPair(key: string | null): void
  openPopover(popover: Popover): void
  closePopover(): void
  selectLink(id: number | null): void
  setConnecting(fromId: number | null): void
  setReconnect(reconnect: Reconnect | null): void
  createLink(fromId: number, toId: number): Promise<boolean>
  updateLink(id: number, patch: LinkPatch): Promise<boolean>
  removeLinks(ids: number[]): Promise<void>

  load(projectId: number): Promise<void>
  reload(): Promise<void>
  reset(): void

  setFocus(id: number): void
  clearHighlight(): void
  toggleScenario(id: number, additive: boolean): void
  selectNode(id: number): void
  closeDetail(): void
  startEditing(id: number | null): void
  setOverlayOpen(open: boolean): void

  setLivePositions(moves: { id: number; x: number; y: number }[]): void
  setSize(id: number, size: Size): void
  setDropGroup(id: number | null): void
  commitMove(ids: number[], groupId: number | null | undefined): Promise<void>

  renameNode(id: number, title: string): Promise<void>
  updateNode(id: number, patch: NodePatch): Promise<boolean>
  toggleNodeCollapsed(id: number): Promise<void>
  collapseAll(): Promise<void>
  toggleGroupCollapsed(id: number): Promise<void>
  removeGroup(id: number, keepNodes: boolean): Promise<void>

  checkFs(): Promise<void>
  openFs(nodeId: number): Promise<void>
  pickDocsRoot(): Promise<void>

  toggleMinimap(): void
  requestFit(): void
  zoomToGroup(groupId: number): void
  saveViewport(viewport: Viewport): void
}

const api = () => window.api.diagram

let viewSeq = 0

/** Run an IPC call. A failure goes to the error sink and the result is null. */
async function attempt<T>(call: Promise<IpcResult<T>>): Promise<{ data: T } | null> {
  try {
    const result = await call
    if (result.ok) return { data: result.data }
    if (result.code !== 'CANCELLED') errorSink(result.code)
  } catch {
    errorSink('INTERNAL')
  }
  return null
}

/** Like attempt, but returns the data itself. Calls that return null on success use attempt. */
async function run<T>(call: Promise<IpcResult<T>>): Promise<T | null> {
  return (await attempt(call))?.data ?? null
}

function replaceNode(data: ProjectData, next: NodeData): ProjectData {
  return { ...data, nodes: data.nodes.map((n) => (n.id === next.id ? next : n)) }
}

function replaceGroup(data: ProjectData, next: GroupData): ProjectData {
  return { ...data, groups: data.groups.map((g) => (g.id === next.id ? next : g)) }
}

/** All document paths the project refers to, without repeats. */
export function documentPaths(data: ProjectData): string[] {
  const set = new Set<string>()
  for (const g of data.groups) if (g.fsFile) set.add(g.fsFile)
  for (const n of data.nodes) if (n.fsFile) set.add(n.fsFile)
  return [...set]
}

const EMPTY = {
  data: null,
  filterUncovered: false,
  hoverPair: null,
  popover: null,
  detailLinkId: null,
  connecting: null,
  reconnect: null,
  loading: false,
  focusId: null,
  selectedScenarios: [],
  detailId: null,
  editingId: null,
  sizes: {},
  dropGroupId: null,
  fsExists: null,
  viewRequest: null,
  overlayOpen: false,
  selected: [] as number[],
  guides: [] as Guide[],
  deleteRequest: null,
  pairView: {} as Record<string, 'split' | 'merge'>,
  linking: null,
  fixFilter: '',
  searchOpen: false,
  labelFocusLinkId: null,
  undoLabel: null,
  redoLabel: null,
  viewer: null,
  peek: null,
  ...SCENARIO_EMPTY,
  ...DATA_EMPTY
} satisfies Partial<DiagramState>

/**
 * Whether a block can take the end of the channel being dragged (FR-LK-03): `ok` lights the port,
 * `bad` dims it, null when no channel is being dragged.
 */
export function portState(
  s: Pick<DiagramState, 'data' | 'connecting' | 'reconnect'>,
  node: Pick<NodeData, 'id' | 'type' | 'subtype'>
): 'ok' | 'bad' | null {
  const nodes = s.data?.nodes
  if (!nodes) return null
  if (s.connecting !== null) {
    const from = nodes.find((n) => n.id === s.connecting)
    if (!from || from.id === node.id) return null
    return linkProblem(from, node, defaultVia(from, node)) === null ? 'ok' : 'bad'
  }
  if (s.reconnect) {
    const link = s.data?.links.find((l) => l.id === s.reconnect?.linkId)
    if (!link) return null
    const other = nodes.find(
      (n) => n.id === (s.reconnect?.end === 'to' ? link.fromNode : link.toNode)
    )
    if (!other) return null
    const [from, to] = s.reconnect.end === 'to' ? [other, node] : [node, other]
    return linkProblem(from, to, link.via) === null ? 'ok' : 'bad'
  }
  return null
}

function replaceLink(data: ProjectData, next: LinkData): ProjectData {
  return { ...data, links: data.links.map((l) => (l.id === next.id ? next : l)) }
}

type Placement = { id: number; x: number; y: number; groupId: number | null }

/** Previous values of the fields a patch touches, so the patch can be undone. */
function previous(node: NodeData, patch: NodePatch): NodePatch {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    const value = (node as unknown as Record<string, unknown>)[key]
    out[key] = Array.isArray(value) ? [...value] : value
  }
  return out as NodePatch
}

function linkBundle(l: LinkData, data: ProjectData): BundleLink {
  const key = (id: number) => data.nodes.find((n) => n.id === id)?.key ?? ''
  const { fromNode, toNode, ...rest } = l
  return { ...rest, fromKey: key(fromNode), toKey: key(toNode) }
}

const NEW_TITLE: Record<string, string> = {
  fnc: 'Function mới',
  req: 'Yêu cầu mới',
  tech: 'Tech mới',
  ext: 'Hệ thống ngoài mới',
  start: 'Start',
  end: 'End',
  cond: 'Điều kiện mới',
  note: 'Ghi chú mới'
}

/** Remembered clipboard of Ctrl+C. Pasting again moves the copy a little further each time. */
let clipboard: { nodes: NodeData[]; links: LinkData[]; pastes: number } | null = null
let moveOrigin: Map<number, Placement> | null = null
let busy = false
/** True after Ctrl+C on blocks, until the window is left: then the system clipboard may hold something else. */
let blocksCopied = false

const byOrder = <T extends { id: number; sortOrder: number }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.id - b.id

/** One image with its pins in the form `history.restore` takes. */
function imageBundle(image: ImageData, pins: readonly PinData[], data: ProjectData): RestoreBundle {
  const { nodeId, ...rest } = image
  const nodeKey = data.nodes.find((n) => n.id === nodeId)?.key ?? ''
  return { images: [{ ...rest, nodeKey }], pins: pins.filter((p) => p.imageId === image.id) }
}

/** Mime type of a block dragged from the palette of the sidebar onto the canvas. */
export const PALETTE_MIME = 'application/x-mapapp-block'

const EMPTY_GROUP_FRAME = { w: 400, h: 260 } as const
const PASTE_STEP = 32
const GRID = 16

export const useDiagram = create<DiagramState>((set, get) => {
  /** Runs after every write that can be undone. */
  const syncHistory = () =>
    set({
      undoLabel: history.peekUndo()?.label ?? null,
      redoLabel: history.peekRedo()?.label ?? null
    })
  const record = (command: Command) => {
    history.push(command)
    syncHistory()
  }
  const ok = async (call: Promise<IpcResult<unknown>>): Promise<boolean> =>
    (await attempt(call)) !== null
  const restore = async (bundle: RestoreBundle): Promise<RestoreResult | null> => {
    const data = get().data
    if (!data) return null
    return run(api().history.restore(data.project.id, bundle))
  }
  const restoreOk = async (bundle: RestoreBundle): Promise<boolean> =>
    (await restore(bundle)) !== null

  /** Writes positions and groups, and shows them. */
  const place = async (list: readonly Placement[]): Promise<boolean> => {
    if (list.length === 0) return true
    const moved = await ok(api().node.move(list.map(({ id, x, y }) => ({ id, x, y }))))
    if (!moved) return false
    const byGroup = new Map<number | null, number[]>()
    const data = get().data
    for (const p of list) {
      const current = data?.nodes.find((n) => n.id === p.id)
      if (current && current.groupId !== p.groupId) {
        byGroup.set(p.groupId, [...(byGroup.get(p.groupId) ?? []), p.id])
      }
    }
    for (const [groupId, ids] of byGroup) {
      if (!(await ok(api().node.setGroup(ids, groupId)))) return false
    }
    const now = get().data
    if (now) {
      const by = new Map(list.map((p) => [p.id, p]))
      set({
        data: {
          ...now,
          nodes: now.nodes.map((n) => {
            const p = by.get(n.id)
            return p ? { ...n, x: p.x, y: p.y, groupId: p.groupId, hasLayout: true } : n
          })
        }
      })
    }
    return true
  }
  const placementOf = (n: NodeData): Placement => ({ id: n.id, x: n.x, y: n.y, groupId: n.groupId })

  /** Patch a block without touching the history. */
  const patchNode = async (id: number, patch: NodePatch): Promise<boolean> => {
    const saved = await run(api().node.update(id, patch))
    const data = get().data
    if (!saved || !data) return false
    set({ data: replaceNode(data, saved) })
    if ('fsFile' in patch) void get().checkFs()
    return true
  }

  const applyMoves = async (label: string, moves: readonly Move[]): Promise<void> => {
    const data = get().data
    if (!data || moves.length === 0) return
    const by = new Map(moves.map((m) => [m.id, m]))
    const before = data.nodes.filter((n) => by.has(n.id)).map(placementOf)
    const after = before.map((p) => ({
      ...p,
      x: by.get(p.id)?.x ?? p.x,
      y: by.get(p.id)?.y ?? p.y
    }))
    if (!(await place(after))) return
    record({ label, undo: () => place(before), redo: () => place(after) })
  }

  /** Inserts copies of blocks (paste and duplicate). */
  const pasteNodes = async (
    sources: readonly NodeData[],
    links: readonly LinkData[],
    step: number
  ): Promise<void> => {
    const data = get().data
    if (!data || sources.length === 0) return
    const plan = planClone({
      nodes: sources,
      links,
      ids: sources.map((n) => n.id),
      takenNodeKeys: data.nodes.map((n) => n.key),
      takenLinkKeys: data.links.map((l) => l.key),
      offset: { x: step, y: step }
    })
    const groupIds = new Set(data.groups.map((g) => g.id))
    const result = await restore({
      nodes: plan.nodes.map((n) => ({
        key: n.key,
        code: n.code,
        ...n.data,
        groupId: n.data.groupId !== null && groupIds.has(n.data.groupId) ? n.data.groupId : null
      })),
      links: plan.links
    })
    if (!result) return
    const now = get().data
    if (!now) return
    const merged: ProjectData = {
      ...now,
      nodes: [...now.nodes, ...result.nodes],
      links: [...now.links, ...result.links]
    }
    const ids = result.nodes.map((n) => n.id)
    set({
      data: merged,
      selected: ids,
      detailId: ids.length === 1 ? (ids[0] ?? null) : null,
      detailLinkId: null
    })
    const bundle: RestoreBundle = {
      nodes: result.nodes,
      links: result.links.map((l) => linkBundle(l, merged))
    }
    record({
      label: sources.length === 1 ? 'Nhân bản khối' : 'Nhân bản các khối',
      undo: () => ok(api().node.remove(ids)),
      redo: () => restoreOk(bundle)
    })
  }

  /** Shows new images and makes them one undo step. */
  const afterAdd = (added: ImageData[]) => {
    const now = get().data
    if (!now) return
    const merged = [...now.images, ...added].sort((a, b) => a.nodeId - b.nodeId || byOrder(a, b))
    const next = { ...now, images: merged }
    set({ data: next })
    const ids = added.map((i) => i.id)
    const bundle: RestoreBundle = {
      images: added.flatMap((i) => imageBundle(i, [], next).images ?? [])
    }
    record({
      label: added.length === 1 ? 'Thêm ảnh' : 'Thêm các ảnh',
      undo: async () => {
        for (const id of ids) if (!(await ok(api().image.remove(id)))) return false
        return true
      },
      redo: () => restoreOk(bundle)
    })
  }

  return {
    ...EMPTY,
    channelMode: 'one',
    minimap: false,
    playImages: false,
    yamlWidth: YAML_PANEL_DEFAULT_WIDTH,
    ...createDataSlice({
      set,
      get,
      api,
      run,
      fail: (code) => errorSink(code),
      notify: (text, options) => noticeSink(text, options),
      applyMoves,
      clearHistory: () => {
        history.clear()
        syncHistory()
      },
      requestFit: () => get().requestFit()
    }),
    ...createScenarioSlice({
      set,
      get,
      scenarioApi: () => api().scenario,
      run,
      ok,
      restoreOk,
      record,
      notify: (text) => noticeSink(text),
      nextView: () => ++viewSeq
    }),

    async load(projectId) {
      disposePlayer()
      history.clear()
      moveOrigin = null
      clipboard = null
      set({ ...EMPTY, loading: true })
      // Files of blocks deleted in an earlier session go to thung-rac/ now that undo cannot need them.
      await attempt(api().image.sweep(projectId))
      const data = await run(api().project.load(projectId))
      set({ data, loading: false })
      if (data) {
        void get().checkFs()
        // A file that was never laid out (Mermaid, or YAML without a layout section).
        if (data.nodes.some((n) => !n.hasLayout)) void get().layoutPending()
      }
    },

    async reload() {
      const current = get().data
      if (!current) return
      const data = await run(api().project.load(current.project.id))
      if (!data) return
      const ids = new Set(data.nodes.map((n) => n.id))
      const scenarioIds = new Set(data.scenarios.map((s) => s.id))
      const { focusId, detailId, detailLinkId, selected } = get()
      const linkIds = new Set(data.links.map((l) => l.id))
      set({
        data,
        focusId: focusId !== null && ids.has(focusId) ? focusId : null,
        detailId: detailId !== null && ids.has(detailId) ? detailId : null,
        detailLinkId: detailLinkId !== null && linkIds.has(detailLinkId) ? detailLinkId : null,
        selected: selected.filter((id) => ids.has(id)),
        popover: null,
        selectedScenarios: get().selectedScenarios.filter((s) => scenarioIds.has(s))
      })
      const playing = get().play
      if (playing && !scenarioIds.has(playing.scenarioId)) get().stopPlay()
      void get().checkFs()
    },

    reset() {
      disposePlayer()
      history.clear()
      const id = get().data?.project.id
      if (id !== undefined) void attempt(api().image.sweep(id))
      set({ ...EMPTY })
    },

    // Focus mode (TDD 8.2). A double click on a block sets the focus and opens its panel.
    setFocus(id) {
      set({ focusId: id, detailId: id, detailLinkId: null, popover: null, selected: [id] })
    },

    clearHighlight() {
      get().stopPlay()
      set({
        focusId: null,
        selectedScenarios: [],
        detailId: null,
        detailLinkId: null,
        popover: null,
        filterUncovered: false,
        selected: [],
        fixFilter: '',
        linking: null
      })
    },

    toggleScenario(id, additive) {
      const current = get().selectedScenarios
      if (additive) {
        set({
          selectedScenarios: current.includes(id)
            ? current.filter((s) => s !== id)
            : [...current, id]
        })
      } else {
        set({ selectedScenarios: current.length === 1 && current[0] === id ? [] : [id] })
      }
    },

    selectNode(id) {
      set({ detailId: id, detailLinkId: null, selected: [id] })
    },

    closeDetail() {
      set({ detailId: null, detailLinkId: null, selected: [] })
    },

    setChannelMode(mode) {
      if (get().channelMode !== mode) set({ channelMode: mode, hoverPair: null, popover: null })
    },

    toggleFilterUncovered() {
      set({ filterUncovered: !get().filterUncovered })
    },

    setHoverPair(key) {
      if (get().hoverPair !== key) set({ hoverPair: key })
    },

    openPopover(popover) {
      set({ popover })
    },

    closePopover() {
      if (get().popover) set({ popover: null })
    },

    selectLink(id) {
      set({
        detailLinkId: id,
        detailId: id === null ? get().detailId : null,
        selected: id === null ? get().selected : []
      })
    },

    setConnecting(fromId) {
      set({ connecting: fromId })
    },

    setReconnect(reconnect) {
      set({ reconnect })
    },

    async createLink(fromId, toId) {
      const data = get().data
      const from = data?.nodes.find((n) => n.id === fromId)
      const to = data?.nodes.find((n) => n.id === toId)
      if (!data || !from || !to) return false
      const via = defaultVia(from, to)
      const problem = linkProblem(from, to, via)
      if (problem) {
        noticeSink(problem)
        return false
      }
      const created = await run(
        api().link.create(data.project.id, { fromNode: fromId, toNode: toId, via })
      )
      const now = get().data
      if (!created || !now) return false
      const merged = { ...now, links: [...now.links, created] }
      set({ data: merged, detailLinkId: created.id, detailId: null })
      record({
        label: 'Tạo kênh',
        undo: () => ok(api().link.remove([created.id])),
        redo: () => restoreOk({ links: [linkBundle(created, merged)] })
      })
      return true
    },

    async updateLink(id, patch) {
      const data = get().data
      const link = data?.links.find((l) => l.id === id)
      if (!data || !link) return false
      const next = { ...link, ...patch }
      const from = data.nodes.find((n) => n.id === next.fromNode)
      const to = data.nodes.find((n) => n.id === next.toNode)
      if (from && to) {
        const problem = linkProblem(from, to, next.via)
        if (problem) {
          noticeSink(problem)
          return false
        }
      }
      const saved = await run(api().link.update(id, patch))
      const now = get().data
      if (!saved || !now) return false
      set({ data: replaceLink(now, saved) })
      const back: LinkPatch = {}
      for (const key of Object.keys(patch) as (keyof LinkPatch)[]) {
        ;(back as Record<string, unknown>)[key] = link[key]
      }
      const write = async (p: LinkPatch): Promise<boolean> => {
        const r = await run(api().link.update(id, p))
        const d = get().data
        if (!r || !d) return false
        set({ data: replaceLink(d, r) })
        return true
      }
      record({ label: 'Sửa kênh', undo: () => write(back), redo: () => write(patch) })
      return true
    },

    async removeLinks(ids) {
      if (ids.length === 0) return
      const before = get().data
      const removed = before ? before.links.filter((l) => ids.includes(l.id)) : []
      const bundle: RestoreBundle = {
        links: before ? removed.map((l) => linkBundle(l, before)) : []
      }
      const done = await attempt(api().link.remove(ids))
      const now = get().data
      if (!done || !now) return
      if (removed.length > 0) {
        record({
          label: removed.length === 1 ? 'Xóa kênh' : 'Xóa các kênh',
          undo: () => restoreOk(bundle),
          redo: () => ok(api().link.remove(removed.map((l) => l.id)))
        })
      }
      const gone = new Set(ids)
      const { detailLinkId, popover } = get()
      set({
        data: { ...now, links: now.links.filter((l) => !gone.has(l.id)) },
        detailLinkId: detailLinkId !== null && gone.has(detailLinkId) ? null : detailLinkId,
        popover: popover && gone.size > 0 ? null : popover
      })
    },

    startEditing(id) {
      set({ editingId: id })
    },

    setOverlayOpen(open) {
      set({ overlayOpen: open })
    },

    // Dragging updates the store on every move; the database is written once on drop.
    setLivePositions(moves) {
      const data = get().data
      if (!data || moves.length === 0) return
      const by = new Map(moves.map((m) => [m.id, m]))
      set({
        data: {
          ...data,
          nodes: data.nodes.map((n) => {
            const m = by.get(n.id)
            return m ? { ...n, x: m.x, y: m.y } : n
          })
        }
      })
    },

    setSize(id, size) {
      const old = get().sizes[id]
      if (old && Math.abs(old.w - size.w) < 0.5 && Math.abs(old.h - size.h) < 0.5) return
      set({ sizes: { ...get().sizes, [id]: size } })
    },

    setDropGroup(id) {
      if (get().dropGroupId !== id) set({ dropGroupId: id })
    },

    beginMove(ids) {
      const data = get().data
      if (!data) return
      moveOrigin = new Map(
        data.nodes.filter((n) => ids.includes(n.id)).map((n) => [n.id, placementOf(n)])
      )
    },

    async commitMove(ids, groupId) {
      const data = get().data
      const origin = moveOrigin
      moveOrigin = null
      set({ dropGroupId: null, guides: [] })
      if (!data) return
      const moved = data.nodes.filter((n) => ids.includes(n.id))
      if (moved.length === 0) return
      await run(api().node.move(moved.map((n) => ({ id: n.id, x: n.x, y: n.y }))))
      let changed: number[] = []
      if (groupId !== undefined) {
        changed = moved.filter((n) => n.groupId !== groupId).map((n) => n.id)
        if (changed.length > 0) {
          const done = await attempt(api().node.setGroup(changed, groupId))
          const now = get().data
          if (!done && now) {
            // The write was refused or failed: show what the database really has.
            await get().reload()
            return
          }
          if (now) {
            set({
              data: {
                ...now,
                nodes: now.nodes.map((n) => (changed.includes(n.id) ? { ...n, groupId } : n))
              }
            })
          }
        }
      }
      if (!origin) return
      const now = get().data
      const after = (now?.nodes ?? []).filter((n) => ids.includes(n.id)).map(placementOf)
      const before = after.map((p) => origin.get(p.id) ?? p)
      const same = after.every((p, i) => {
        const b = before[i] as Placement
        return b.x === p.x && b.y === p.y && b.groupId === p.groupId
      })
      if (same) return
      record({
        label: after.length === 1 ? 'Di chuyển khối' : 'Di chuyển các khối',
        undo: () => place(before),
        redo: () => place(after)
      })
    },

    async renameNode(id, title) {
      set({ editingId: null })
      const node = get().data?.nodes.find((n) => n.id === id)
      const next = title.trim()
      if (!node || next === '' || next === node.title) return
      await get().updateNode(id, { title: next })
    },

    async updateNode(id, patch) {
      const before = get().data?.nodes.find((n) => n.id === id)
      const saved = await patchNode(id, patch)
      if (saved && before) {
        const back = previous(before, patch)
        record({
          label: 'Sửa khối',
          undo: () => patchNode(id, back),
          redo: () => patchNode(id, patch)
        })
      }
      return saved
    },

    async toggleNodeCollapsed(id) {
      const node = get().data?.nodes.find((n) => n.id === id)
      if (node) await get().updateNode(id, { collapsed: !node.collapsed })
    },

    async collapseAll() {
      const data = get().data
      if (!data) return
      const target = data.nodes.some((n) => !n.collapsed)
      const todo = data.nodes.filter((n) => n.collapsed !== target)
      if (todo.length === 0) return
      const run1 = async (value: boolean | null) => {
        const results = await Promise.all(
          todo.map((n) => patchNode(n.id, { collapsed: value === null ? n.collapsed : value }))
        )
        return results.every(Boolean)
      }
      const originals = new Map(todo.map((n) => [n.id, n.collapsed]))
      const all = await run1(target)
      if (!all) return
      record({
        label: target ? 'Thu gọn tất cả khối' : 'Mở rộng tất cả khối',
        undo: async () =>
          (
            await Promise.all(
              todo.map((n) => patchNode(n.id, { collapsed: originals.get(n.id) ?? false }))
            )
          ).every(Boolean),
        redo: () => run1(target)
      })
    },

    async toggleGroupCollapsed(id) {
      const group = get().data?.groups.find((g) => g.id === id)
      if (!group) return
      const write = async (collapsed: boolean): Promise<boolean> => {
        const saved = await run(api().group.update(id, { collapsed }))
        const data = get().data
        if (!saved || !data) return false
        set({ data: replaceGroup(data, saved) })
        return true
      }
      if (await write(!group.collapsed)) {
        record({
          label: group.collapsed ? 'Mở rộng nhóm' : 'Thu gọn nhóm',
          undo: () => write(group.collapsed),
          redo: () => write(!group.collapsed)
        })
      }
    },

    async renameGroup(id, title) {
      const group = get().data?.groups.find((g) => g.id === id)
      const next = title.trim()
      if (!group || next === '' || next === group.title) return
      const write = async (value: string): Promise<boolean> => {
        const saved = await run(api().group.update(id, { title: value }))
        const data = get().data
        if (!saved || !data) return false
        set({ data: replaceGroup(data, saved) })
        return true
      }
      if (await write(next)) {
        record({
          label: 'Đổi tên nhóm',
          undo: () => write(group.title),
          redo: () => write(next)
        })
      }
    },

    async removeGroup(id, keepNodes) {
      const data = get().data
      const group = data?.groups.find((g) => g.id === id)
      if (!data || !group) return
      const members = data.nodes.filter((n) => n.groupId === id).map((n) => n.id)
      const bundle = keepNodes ? null : snapshotNodes(data, members, [group])
      const done = await run(api().group.remove(id, keepNodes))
      if (!done) return
      record({
        label: 'Xóa nhóm',
        undo: async () => {
          if (bundle) return restoreOk(bundle)
          if (!(await restoreOk({ groups: [group] }))) return false
          return members.length === 0 ? true : ok(api().node.setGroup(members, id))
        },
        redo: () => ok(api().group.remove(id, keepNodes))
      })
      await get().reload()
    },

    select(ids) {
      set({
        selected: ids,
        detailId: ids.length === 1 ? (ids[0] ?? null) : null,
        detailLinkId: null
      })
    },

    selectOnly(ids) {
      set({ selected: ids })
    },

    toggleSelect(id) {
      const current = get().selected
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      set({
        selected: next,
        detailId: next.length === 1 ? (next[0] ?? null) : null,
        detailLinkId: null
      })
    },

    setGuides(guides) {
      set({ guides })
    },

    async createBlock(spec, at, opts = {}) {
      const data = get().data
      if (!data) return null
      if (spec.type === 'group') {
        const frame = { x: Math.round(at.x), y: Math.round(at.y), ...EMPTY_GROUP_FRAME }
        const group = await run(api().group.create(data.project.id, { title: 'Nhóm mới', frame }))
        const now = get().data
        if (!group || !now) return null
        set({ data: { ...now, groups: [...now.groups, group] } })
        record({
          label: 'Tạo nhóm FS',
          undo: () => ok(api().group.remove(group.id, true)),
          redo: () => restoreOk({ groups: [group] })
        })
        return group.id
      }
      const type = spec.type
      const subtype = spec.subtype ?? null
      const width =
        type === 'fnc' || type === 'req' || type === 'cond' || type === 'note' ? 250 : 210
      const title =
        type === 'tech' && subtype
          ? `${subtype.charAt(0).toUpperCase()}${subtype.slice(1)} mới`
          : (NEW_TITLE[type] ?? 'Khối mới')
      const input: NodeInput = {
        type,
        subtype,
        title,
        x: Math.round((at.x - width / 2) / GRID) * GRID,
        y: Math.round((at.y - 28) / GRID) * GRID,
        hasLayout: true,
        ...(opts.groupId != null ? { groupId: opts.groupId } : {})
      }
      const node = await run(api().node.create(data.project.id, input))
      const now = get().data
      if (!node || !now) return null
      let merged: ProjectData = { ...now, nodes: [...now.nodes, node] }
      let link: LinkData | null = null
      if (opts.linkFrom !== undefined) {
        const from = merged.nodes.find((n) => n.id === opts.linkFrom)
        if (from) {
          const via = defaultVia(from, node)
          const problem = linkProblem(from, node, via)
          if (problem) {
            noticeSink(problem)
          } else {
            link = await run(
              api().link.create(data.project.id, { fromNode: from.id, toNode: node.id, via })
            )
            if (link) merged = { ...merged, links: [...merged.links, link] }
          }
        }
      }
      set({
        data: merged,
        selected: [node.id],
        detailId: node.id,
        detailLinkId: null,
        editingId: opts.edit === false ? null : node.id
      })
      const bundle: RestoreBundle = {
        nodes: [node],
        links: link ? [linkBundle(link, merged)] : []
      }
      record({
        label: link ? 'Tạo khối và kênh' : 'Tạo khối',
        undo: () => ok(api().node.remove([node.id])),
        redo: () => restoreOk(bundle)
      })
      return node.id
    },

    async requestDelete(ids) {
      const data = get().data
      if (!data || ids.length === 0) return
      const scenarios = dataScenarios(data)
      const describe = (list: (string | number)[]): AffectedScenario[] =>
        list.map((id) => {
          const sc = data.scenarios.find((x) => x.id === id)
          return { id: Number(id), key: sc?.key ?? '', title: sc?.title ?? '' }
        })
      // Same two lookups the service uses when it deletes (FR-SUA-06).
      const affected = describe(scenariosUsingNodes(scenarios, ids))
      const detached = describe(scenariosForkedAt(scenarios, ids))
      const set1 = new Set(ids)
      const linkCount = data.links.filter((l) => set1.has(l.fromNode) || set1.has(l.toNode)).length
      set({ deleteRequest: { ids: [...ids], affected, detached, linkCount } })
    },

    cancelDelete() {
      set({ deleteRequest: null })
    },

    async confirmDelete() {
      const request = get().deleteRequest
      const data = get().data
      set({ deleteRequest: null })
      if (!request || !data) return
      const bundle = snapshotNodes(data, request.ids)
      const done = await run(api().node.remove(request.ids))
      if (!done) return
      record({
        label: request.ids.length === 1 ? 'Xóa khối' : 'Xóa các khối',
        undo: () => restoreOk(bundle),
        redo: () => ok(api().node.remove(request.ids))
      })
      set({ selected: [], detailId: null, detailLinkId: null, focusId: null })
      await get().reload()
    },

    copySelection() {
      const data = get().data
      const ids = new Set(get().selected)
      if (!data || ids.size === 0) return
      blocksCopied = true
      clipboard = {
        nodes: data.nodes.filter((n) => ids.has(n.id)).map((n) => ({ ...n, chips: [...n.chips] })),
        links: data.links
          .filter((l) => ids.has(l.fromNode) && ids.has(l.toNode))
          .map((l) => ({ ...l })),
        pastes: 0
      }
    },

    async paste() {
      if (!clipboard) return
      clipboard.pastes += 1
      await pasteNodes(clipboard.nodes, clipboard.links, PASTE_STEP * clipboard.pastes)
    },

    async duplicate(ids) {
      const data = get().data
      if (!data) return
      const set1 = new Set(ids)
      await pasteNodes(
        data.nodes.filter((n) => set1.has(n.id)),
        data.links,
        PASTE_STEP
      )
    },

    async align(mode) {
      const data = get().data
      if (!data) return
      const boxes: Box[] = data.nodes
        .filter((n) => get().selected.includes(n.id))
        .map((n) => ({ id: n.id, ...blockRect(n, get().sizes) }))
      await applyMoves('Căn hàng', alignMoves(boxes, mode))
    },

    async distribute(axis) {
      const data = get().data
      if (!data) return
      const boxes: Box[] = data.nodes
        .filter((n) => get().selected.includes(n.id))
        .map((n) => ({ id: n.id, ...blockRect(n, get().sizes) }))
      await applyMoves('Giãn đều', distributeMoves(boxes, axis))
    },

    async gatherIntoGroup(ids, target) {
      const data = get().data
      if (!data || ids.length === 0) return
      const before = data.nodes.filter((n) => ids.includes(n.id)).map(placementOf)
      let created: GroupData | null = null
      let groupId: number
      if (target === 'new') {
        created = await run(api().group.create(data.project.id, { title: 'Nhóm mới' }))
        if (!created) return
        groupId = created.id
        const now = get().data
        if (now) set({ data: { ...now, groups: [...now.groups, created] } })
      } else {
        groupId = target
      }
      const after = before.map((p) => ({ ...p, groupId }))
      if (!(await place(after))) return
      const group = created
      const undoGroups = async (): Promise<boolean> => {
        if (!(await place(before))) return false
        return group ? ok(api().group.remove(group.id, true)) : true
      }
      record({
        label: 'Gom vào nhóm',
        undo: undoGroups,
        redo: async () => {
          if (group && !(await restoreOk({ groups: [group] }))) return false
          return place(after)
        }
      })
    },

    // --- images and pins (Session 07) -------------------------------------------------------

    reportError(code) {
      errorSink(code)
    },

    openViewer(request) {
      set({ viewer: request, peek: null })
    },

    closeViewer() {
      set({ viewer: null })
      get().resumePlayAfterViewer()
    },

    setPeek(peek) {
      set({ peek })
    },

    async pickImages(nodeId) {
      const added = await run(api().image.pick(nodeId))
      if (added) afterAdd(added)
    },

    async addImageFiles(nodeId, files) {
      const list = files.filter((f) => f.size >= 0)
      if (list.length === 0) return
      const paths = list.map((f) => window.api.diagram.pathOfFile(f))
      if (paths.every((p) => p !== '')) {
        const added = await run(api().image.addFromPaths(nodeId, paths))
        if (added) afterAdd(added)
        return
      }
      // The system did not tell where the files are: their bytes travel instead.
      const all: ImageData[] = []
      for (const file of list) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const one = await run(api().image.addFromBytes(nodeId, file.name, bytes))
        if (!one) break
        all.push(one)
      }
      if (all.length > 0) afterAdd(all)
    },

    async pasteSmart() {
      const only = get().selected.length === 1 ? get().selected[0] : undefined
      if (only !== undefined && !blocksCopied) {
        try {
          const result = await api().image.addFromClipboard(only)
          if (result.ok) {
            afterAdd([result.data])
            return
          }
          if (result.code !== 'CLIPBOARD_EMPTY') {
            errorSink(result.code)
            return
          }
        } catch {
          errorSink('INTERNAL')
          return
        }
      }
      await get().paste()
    },

    noteClipboardChanged() {
      blocksCopied = false
    },

    async removeImage(id) {
      const data = get().data
      const image = data?.images.find((i) => i.id === id)
      if (!data || !image) return
      const bundle = imageBundle(image, data.pins, data)
      if (!(await ok(api().image.remove(id)))) return
      const now = get().data
      if (now)
        set({
          data: {
            ...now,
            images: now.images.filter((i) => i.id !== id),
            pins: now.pins.filter((p) => p.imageId !== id)
          }
        })
      record({
        label: 'Xóa ảnh',
        undo: () => restoreOk(bundle),
        redo: () => ok(api().image.remove(id))
      })
      const viewer = get().viewer
      if (viewer?.imageId === id) set({ viewer: null })
      await get().reload()
    },

    async reorderImages(nodeId, ids) {
      const data = get().data
      if (!data) return
      const before = data.images
        .filter((i) => i.nodeId === nodeId)
        .sort(byOrder)
        .map((i) => i.id)
      const apply = async (order: number[]): Promise<boolean> => {
        if (!(await ok(api().image.reorder(nodeId, order)))) return false
        const now = get().data
        if (now) {
          const rank = new Map(order.map((id, i) => [id, i]))
          set({
            data: {
              ...now,
              images: now.images
                .map((i) => (rank.has(i.id) ? { ...i, sortOrder: rank.get(i.id) ?? 0 } : i))
                .sort((a, b) => a.nodeId - b.nodeId || byOrder(a, b))
            }
          })
        }
        return true
      }
      if (!(await apply(ids))) return
      record({ label: 'Đổi thứ tự ảnh', undo: () => apply(before), redo: () => apply(ids) })
    },

    async setImageCaption(id, caption) {
      const data = get().data
      const image = data?.images.find((i) => i.id === id)
      if (!data || !image || image.caption === caption) return
      const before = image.caption
      const apply = async (text: string): Promise<boolean> => {
        const next = await run(api().image.update(id, { caption: text }))
        if (!next) return false
        const now = get().data
        if (now) set({ data: { ...now, images: now.images.map((i) => (i.id === id ? next : i)) } })
        return true
      }
      if (!(await apply(caption))) return
      record({ label: 'Đổi tên ảnh', undo: () => apply(before), redo: () => apply(caption) })
    },

    async createPin(imageId, input) {
      const pin = await run(api().pin.create(imageId, input))
      if (!pin) return null
      const put = (p: PinData) => {
        const now = get().data
        if (now) set({ data: { ...now, pins: [...now.pins, p].sort(byOrder) } })
      }
      put(pin)
      record({
        label: 'Đặt ghim',
        undo: async () => {
          if (!(await ok(api().pin.remove(pin.id)))) return false
          return true
        },
        redo: () => restoreOk({ pins: [pin] })
      })
      return pin
    },

    async updatePin(id, patch) {
      const data = get().data
      const pin = data?.pins.find((p) => p.id === id)
      if (!data || !pin) return
      const before: PinPatch = {
        xPct: pin.xPct,
        yPct: pin.yPct,
        note: pin.note
      }
      const apply = async (p: PinPatch): Promise<boolean> => {
        const next = await run(api().pin.update(id, p))
        if (!next) return false
        const now = get().data
        if (now) set({ data: { ...now, pins: now.pins.map((x) => (x.id === id ? next : x)) } })
        return true
      }
      if (!(await apply(patch))) return
      record({
        label: patch.note !== undefined ? 'Sửa ghim' : 'Dời ghim',
        undo: () => apply(before),
        redo: () => apply(patch)
      })
    },

    async removePin(id) {
      const data = get().data
      const pin = data?.pins.find((p) => p.id === id)
      if (!data || !pin) return
      if (!(await ok(api().pin.remove(id)))) return
      const now = get().data
      if (now) set({ data: { ...now, pins: now.pins.filter((p) => p.id !== id) } })
      record({
        label: 'Xóa ghim',
        undo: () => restoreOk({ pins: [pin] }),
        redo: () => ok(api().pin.remove(id))
      })
      await get().reload()
    },

    async reorderPins(imageId, ids) {
      const data = get().data
      if (!data) return
      const before = data.pins
        .filter((p) => p.imageId === imageId)
        .sort(byOrder)
        .map((p) => p.id)
      const apply = async (order: number[]): Promise<boolean> => {
        if (!(await ok(api().pin.reorder(imageId, order)))) return false
        const now = get().data
        if (now) {
          const rank = new Map(order.map((id, i) => [id, i]))
          set({
            data: {
              ...now,
              pins: now.pins
                .map((p) => (rank.has(p.id) ? { ...p, sortOrder: rank.get(p.id) ?? 0 } : p))
                .sort((a, b) => a.imageId - b.imageId || byOrder(a, b))
            }
          })
        }
        return true
      }
      if (!(await apply(ids))) return
      record({ label: 'Đổi thứ tự ghim', undo: () => apply(before), redo: () => apply(ids) })
    },

    async undo() {
      if (busy) return
      const command = history.peekUndo()
      if (!command) return
      busy = true
      try {
        if (await command.undo()) {
          history.undone()
          await get().reload()
        }
      } finally {
        busy = false
        syncHistory()
      }
    },

    async redo() {
      if (busy) return
      const command = history.peekRedo()
      if (!command) return
      busy = true
      try {
        if (await command.redo()) {
          history.redone()
          await get().reload()
        }
      } finally {
        busy = false
        syncHistory()
      }
    },

    togglePair(key, split) {
      set({ pairView: { ...get().pairView, [key]: split ? 'split' : 'merge' } })
    },

    startLinking(fromId) {
      set({ linking: fromId })
    },

    setFixFilter(text) {
      set({ fixFilter: text })
    },

    setSearchOpen(open) {
      set({ searchOpen: open })
    },

    goToNode(id) {
      viewSeq += 1
      set({
        selected: [id],
        detailId: id,
        detailLinkId: null,
        viewRequest: { seq: viewSeq, kind: 'node', nodeId: id }
      })
    },

    requestAdd(spec) {
      viewSeq += 1
      set({ viewRequest: { seq: viewSeq, kind: 'add', spec } })
    },

    focusLinkLabel(id) {
      set({ labelFocusLinkId: id })
    },

    async checkFs() {
      const data = get().data
      if (!data) return
      if (!data.project.docsRoot) {
        set({ fsExists: null })
        return
      }
      const paths = documentPaths(data)
      if (paths.length === 0) {
        set({ fsExists: {} })
        return
      }
      const found = await run(api().fs.exists(data.project.id, paths))
      if (found) set({ fsExists: found })
    },

    async openFs(nodeId) {
      await run(api().fs.open(nodeId))
      // A missing file turns the button red right away.
      void get().checkFs()
    },

    async pickDocsRoot() {
      const data = get().data
      if (!data) return
      const info = await run(api().fs.pick(data.project.id))
      const now = get().data
      if (!info || !now) return
      set({ data: { ...now, project: info } })
      await get().checkFs()
    },

    toggleMinimap() {
      set({ minimap: !get().minimap })
    },

    requestFit() {
      viewSeq += 1
      set({ viewRequest: { seq: viewSeq, kind: 'fit' } })
    },

    zoomToGroup(groupId) {
      viewSeq += 1
      set({ viewRequest: { seq: viewSeq, kind: 'group', groupId } })
    },

    saveViewport(viewport) {
      const data = get().data
      if (!data) return
      void run(api().project.saveViewport(data.project.id, viewport))
    }
  }
})

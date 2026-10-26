/**
 * Public contract of the diagram module [TH].
 *
 * Holds the data types and the IPC contract of window.api.diagram (TDD 7).
 * Pure TypeScript, no Electron, no React, no Node.
 */

/** Standard failure shape of every IPC function (TDD 7). */
export interface IpcFailure {
  ok: false
  code: string
  message: string
}

export interface IpcSuccess<T> {
  ok: true
  data: T
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure

/** Logger the shell passes into the module. Never log content of blocks or YAML (TDD 14). */
export interface DiagramLogger {
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

/** Prefix of every IPC channel owned by the module. */
export const DIAGRAM_CHANNEL_PREFIX = 'diagram:'

/** IPC channels of the module. Every value starts with `diagram:` (checked by tests/boundary.test.ts). */
export const DIAGRAM_CHANNELS = {
  project: {
    list: 'diagram:project:list',
    create: 'diagram:project:create',
    rename: 'diagram:project:rename',
    remove: 'diagram:project:remove',
    load: 'diagram:project:load',
    setDocsRoot: 'diagram:project:set-docs-root',
    saveViewport: 'diagram:project:save-viewport',
    saveSettings: 'diagram:project:save-settings'
  },
  node: {
    create: 'diagram:node:create',
    update: 'diagram:node:update',
    remove: 'diagram:node:remove',
    impact: 'diagram:node:impact',
    move: 'diagram:node:move',
    setGroup: 'diagram:node:set-group'
  },
  group: {
    create: 'diagram:group:create',
    update: 'diagram:group:update',
    remove: 'diagram:group:remove'
  },
  link: {
    create: 'diagram:link:create',
    update: 'diagram:link:update',
    remove: 'diagram:link:remove'
  },
  scenario: {
    create: 'diagram:scenario:create',
    update: 'diagram:scenario:update',
    remove: 'diagram:scenario:remove',
    setSteps: 'diagram:scenario:set-steps'
  },
  fs: {
    open: 'diagram:fs:open',
    exists: 'diagram:fs:exists',
    pick: 'diagram:fs:pick'
  },
  history: {
    restore: 'diagram:history:restore'
  },
  image: {
    pick: 'diagram:image:pick',
    addFromPaths: 'diagram:image:add-from-paths',
    addFromBytes: 'diagram:image:add-from-bytes',
    addFromClipboard: 'diagram:image:add-from-clipboard',
    update: 'diagram:image:update',
    remove: 'diagram:image:remove',
    reorder: 'diagram:image:reorder',
    sweep: 'diagram:image:sweep'
  },
  pin: {
    create: 'diagram:pin:create',
    update: 'diagram:pin:update',
    remove: 'diagram:pin:remove',
    reorder: 'diagram:pin:reorder'
  },
  yaml: {
    export: 'diagram:yaml:export',
    preview: 'diagram:yaml:preview',
    apply: 'diagram:yaml:apply',
    pickFile: 'diagram:yaml:pick-file',
    previewNew: 'diagram:yaml:preview-new',
    applyNew: 'diagram:yaml:apply-new'
  },
  export: {
    mermaid: 'diagram:export:mermaid',
    jsonCanvas: 'diagram:export:json-canvas',
    png: 'diagram:export:png',
    openFolder: 'diagram:export:open-folder'
  }
} as const

/** Error codes the module can return. The renderer maps each code to a Vietnamese message. */
export const DIAGRAM_ERROR_CODES = [
  'NAME_EMPTY',
  'NAME_TOO_LONG',
  'NAME_DUPLICATE',
  'PROJECT_NOT_FOUND',
  'DOCS_ROOT_INVALID',
  'VIEWPORT_INVALID',
  'SETTINGS_INVALID',
  'INVALID_ARGUMENT',
  'CANCELLED',
  'NODE_NOT_FOUND',
  'GROUP_NOT_FOUND',
  'LINK_NOT_FOUND',
  'SCENARIO_NOT_FOUND',
  'KEY_INVALID',
  'KEY_DUPLICATE',
  'FIELD_REQUIRED',
  'FIELD_TOO_LONG',
  'ENUM_INVALID',
  'LINK_SELF',
  'LINK_RULE',
  'SCENARIO_RULE',
  'YAML_INVALID',
  'FS_NO_ROOT',
  'FS_NOT_FOUND',
  'FS_OPEN_FAILED',
  'IMAGE_NOT_FOUND',
  'IMAGE_FORMAT',
  'IMAGE_TOO_LARGE',
  'IMAGE_LIMIT',
  'IMAGE_UNREADABLE',
  'CLIPBOARD_EMPTY',
  'PIN_NOT_FOUND',
  'IMPORT_TOO_LARGE',
  'IMPORT_UNREADABLE',
  'EXPORT_IMAGE_INVALID',
  'EXPORT_OPEN_FAILED',
  'INTERNAL'
] as const
export type DiagramErrorCode = (typeof DIAGRAM_ERROR_CODES)[number]

/** Max length of a project name (FR-DA-02). */
export const PROJECT_NAME_MAX = 80

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type Theme = 'dark' | 'light'
export type ChannelMode = 'one' | 'many'

/** Per project settings stored in dg_projects.settings_json. */
export interface ProjectSettings {
  channelMode: ChannelMode
  playImages: boolean
  theme: Theme
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  channelMode: 'one',
  playImages: true,
  theme: 'dark'
}

/** Row of dg_projects as the renderer sees it. docsRoot is the only absolute path (MASTER 4.5). */
export interface ProjectInfo {
  id: number
  code: number
  name: string
  /** Relative to the Kho, for example `du-an/0003-moe-ea`. */
  folder: string
  docsRoot: string | null
  createdAt: string
  updatedAt: string
}

/** Item of the project list on the welcome screen. */
export interface ProjectSummary extends ProjectInfo {
  nodeCount: number
}

/** Rectangle of a group that has no blocks yet, in world units. */
export interface GroupFrame {
  x: number
  y: number
  w: number
  h: number
}

export interface GroupData {
  id: number
  key: string
  title: string
  fsFile: string | null
  collapsed: boolean
  sortOrder: number
  /** Only used while the group has no blocks. Otherwise the frame follows its members. */
  frame: GroupFrame | null
}

export interface NodeData {
  id: number
  key: string
  type: NodeType
  subtype: string | null
  code: string
  title: string
  body: string
  fixText: string
  chips: string[]
  fsFile: string | null
  fsSection: string | null
  groupId: number | null
  x: number
  y: number
  hasLayout: boolean
  collapsed: boolean
}

export interface ImageData {
  id: number
  nodeId: number
  relPath: string
  width: number
  height: number
  caption: string
  sortOrder: number
}

export interface PinData {
  id: number
  imageId: number
  xPct: number
  yPct: number
  note: string
  sortOrder: number
}

export interface LinkData {
  id: number
  key: string
  fromNode: number
  toNode: number
  via: ViaType
  label: string
  note: string
  sortOrder: number
}

export interface ScenarioData {
  id: number
  key: string
  type: ScenarioType
  title: string
  parentId: number | null
  forkNodeId: number | null
  sortOrder: number
}

export interface StepData {
  id: number
  scenarioId: number
  idx: number
  nodeId: number
  note: string
}

/** Everything of one project, returned by project.load in a single call (TDD 10). */
export interface ProjectData {
  project: ProjectInfo
  groups: GroupData[]
  nodes: NodeData[]
  images: ImageData[]
  pins: PinData[]
  links: LinkData[]
  scenarios: ScenarioData[]
  steps: StepData[]
  viewport: Viewport | null
  settings: ProjectSettings
}

/** Field limits of FSD FR-KH-02, FR-LK-01 and FR-KB-02. Counted in characters, not bytes. */
export const LIMITS = {
  id: 40,
  code: 40,
  title: 80,
  body: 600,
  chips: 6,
  chip: 24,
  fix: 200,
  section: 80,
  label: 80,
  note: 300,
  stepNote: 160
} as const

export const TECH_SUBTYPES = [
  'api',
  'database',
  'service',
  'ui',
  'queue',
  'storage',
  'job'
] as const
export const START_SUBTYPES = ['user', 'schedule', 'api', 'event'] as const
export const END_SUBTYPES = ['ok', 'fail', 'warn'] as const

export interface ProjectApi {
  list(): Promise<IpcResult<ProjectSummary[]>>
  create(name: string): Promise<IpcResult<ProjectSummary>>
  rename(id: number, name: string): Promise<IpcResult<ProjectSummary>>
  /** Moves the project folder into thung-rac/ and deletes the database rows. */
  remove(id: number): Promise<IpcResult<{ trashFolder: string | null }>>
  load(id: number): Promise<IpcResult<ProjectData>>
  /** Opens the folder dialog. Returns CANCELLED when the user closes it. */
  setDocsRoot(id: number): Promise<IpcResult<ProjectInfo>>
  saveViewport(id: number, viewport: Viewport): Promise<IpcResult<null>>
  saveSettings(id: number, patch: Partial<ProjectSettings>): Promise<IpcResult<ProjectSettings>>
}

/** Input of node.create. Everything but type and title is optional. */
export interface NodeInput {
  key?: string
  type: NodeType
  subtype?: string | null
  code?: string
  title: string
  body?: string
  fixText?: string
  chips?: string[]
  fsFile?: string | null
  fsSection?: string | null
  groupId?: number | null
  x?: number
  y?: number
  /** True when x and y are real coordinates. Omitted or false puts the block on the temporary grid. */
  hasLayout?: boolean
}

export type NodePatch = Partial<
  Omit<NodeInput, 'key' | 'type' | 'x' | 'y' | 'hasLayout'> & { collapsed: boolean }
>

export interface NodeMove {
  id: number
  x: number
  y: number
}

export interface AffectedScenario {
  id: number
  key: string
  title: string
}

/** Result of node.remove, used for the confirmation text and the toast (FR-SUA-06). */
export interface NodeRemoveResult {
  removed: number[]
  /** Scenarios whose full path contained a removed block. Their steps were renumbered. */
  affected: AffectedScenario[]
  /** Branches that forked at a removed block and became root scenarios. */
  detached: AffectedScenario[]
}

export interface GroupInput {
  key?: string
  title: string
  fsFile?: string | null
  frame?: GroupFrame | null
}

export type GroupPatch = Partial<
  Pick<GroupData, 'title' | 'fsFile' | 'collapsed' | 'sortOrder' | 'frame'>
>

export interface LinkInput {
  key?: string
  fromNode: number
  toNode: number
  via: ViaType
  label?: string
  note?: string
}

export type LinkPatch = Partial<Pick<LinkInput, 'fromNode' | 'toNode' | 'via' | 'label' | 'note'>>

export interface ScenarioStepInput {
  nodeId: number
  note?: string
}

export interface ScenarioInput {
  key?: string
  type: ScenarioType
  title: string
  parentId?: number | null
  forkNodeId?: number | null
  steps?: ScenarioStepInput[]
}

export type ScenarioPatch = Partial<
  Pick<ScenarioInput, 'type' | 'title' | 'parentId' | 'forkNodeId'> & { sortOrder: number }
>

/** What to do with the branches of a scenario that is being deleted (FR-KB-07). */
export type ChildPolicy = 'cascade' | 'promote'

/** The scenarios that changed after a scenario was removed, with their new parent. */
export interface ScenarioRemoveResult {
  removed: number[]
  promoted: AffectedScenario[]
}

export interface NodeApi {
  create(projectId: number, input: NodeInput): Promise<IpcResult<NodeData>>
  update(id: number, patch: NodePatch): Promise<IpcResult<NodeData>>
  remove(ids: number[]): Promise<IpcResult<NodeRemoveResult>>
  /** Same lookup as remove, without deleting. Names the scenarios for the confirmation box. */
  impact(ids: number[]): Promise<IpcResult<AffectedScenario[]>>
  move(batch: NodeMove[]): Promise<IpcResult<null>>
  setGroup(ids: number[], groupId: number | null): Promise<IpcResult<null>>
}

export interface GroupApi {
  create(projectId: number, input: GroupInput): Promise<IpcResult<GroupData>>
  update(id: number, patch: GroupPatch): Promise<IpcResult<GroupData>>
  remove(id: number, keepNodes: boolean): Promise<IpcResult<NodeRemoveResult>>
}

export interface LinkApi {
  create(projectId: number, input: LinkInput): Promise<IpcResult<LinkData>>
  update(id: number, patch: LinkPatch): Promise<IpcResult<LinkData>>
  remove(ids: number[]): Promise<IpcResult<null>>
}

export interface ScenarioWithSteps {
  scenario: ScenarioData
  steps: StepData[]
}

export interface ScenarioApi {
  create(projectId: number, input: ScenarioInput): Promise<IpcResult<ScenarioWithSteps>>
  update(id: number, patch: ScenarioPatch): Promise<IpcResult<ScenarioData>>
  remove(id: number, childPolicy: ChildPolicy): Promise<IpcResult<ScenarioRemoveResult>>
  setSteps(id: number, steps: ScenarioStepInput[]): Promise<IpcResult<StepData[]>>
}

/** Options of yaml.preview and yaml.apply. */
export interface MergeOptions {
  /** The box "Xóa những khối không có trong file" (FR-YM-02). */
  removeMissing: boolean
}

export type FlowmapIssueSeverity = 'error' | 'warning'

/** One problem found in a Flowmap YAML text (TDD 6.4). Line and column start at 1. */
export interface FlowmapIssue {
  line: number
  col: number
  path: string
  code: FlowmapIssueCode
  severity: FlowmapIssueSeverity
  message: string
}

export const FLOWMAP_ISSUE_CODES = [
  'YAML_SYNTAX',
  'VERSION',
  'REQUIRED',
  'ID_FORMAT',
  'ID_DUPLICATE',
  'ENUM',
  'REF_MISSING',
  'LINK_SELF',
  'LINK_RULE',
  'SCN_CYCLE',
  'SCN_FORK',
  'LENGTH',
  'UNKNOWN_KEY'
] as const
export type FlowmapIssueCode = (typeof FLOWMAP_ISSUE_CODES)[number]

export interface FlowmapGroup {
  id: string
  title: string
  fs: string | null
}

export interface FlowmapNode {
  id: string
  type: NodeType
  subtype: string | null
  group: string | null
  code: string
  title: string
  body: string
  fix: string
  chips: string[]
  /** Already resolved: the node's own file, else the file of its group. */
  fs: string | null
  section: string | null
}

export interface FlowmapLink {
  /** Always filled: the explicit id from the file, or the derived key (ids.deriveLinkKey). */
  id: string
  from: string
  to: string
  via: ViaType
  label: string
  note: string
}

export interface FlowmapStep {
  node: string
  note: string
}

export interface FlowmapScenario {
  id: string
  type: ScenarioType
  title: string
  parent: string | null
  at: string | null
  steps: FlowmapStep[]
}

export type FlowmapLayout = Record<string, [number, number]>

/** A project written in terms of ids from the file, the shape that parse, serialize and merge share. */
export interface FlowmapDoc {
  project: { name: string | null; docsRoot: string | null }
  groups: FlowmapGroup[]
  nodes: FlowmapNode[]
  links: FlowmapLink[]
  scenarios: FlowmapScenario[]
  layout: FlowmapLayout
}

export type MergeKind = 'groups' | 'nodes' | 'links' | 'scenarios'

/** One entry of merge.update: the new value and the names of the fields that differ. */
export interface MergeChange<T> {
  id: string
  after: T
  /** Field names that differ, or `layout` when only the coordinates change. */
  fields: string[]
}

export interface MergePlan {
  add: {
    groups: FlowmapGroup[]
    nodes: FlowmapNode[]
    links: FlowmapLink[]
    scenarios: FlowmapScenario[]
  }
  update: {
    groups: MergeChange<FlowmapGroup>[]
    nodes: MergeChange<FlowmapNode>[]
    links: MergeChange<FlowmapLink>[]
    scenarios: MergeChange<FlowmapScenario>[]
  }
  /** Ids to delete. Empty unless removeMissing is on. */
  remove: Record<MergeKind, string[]>
  /** Ids that are the same on both sides. */
  keep: Record<MergeKind, string[]>
  /** Coordinates to write: new blocks that have one and existing blocks whose position changes. */
  layout: FlowmapLayout
}

export interface MergeSummary {
  add: Record<MergeKind, number>
  update: Record<MergeKind, number>
  remove: Record<MergeKind, number>
  keep: Record<MergeKind, number>
  /** True when add, update and remove are all zero. */
  unchanged: boolean
}

/** Result of yaml.preview. Nothing is written. */
export type YamlPreview =
  | {
      ok: true
      issues: FlowmapIssue[]
      summary: MergeSummary
      plan: MergePlan
      /** `project.name` of the file, null when it has none (Mermaid never has one). */
      projectName: string | null
    }
  | { ok: false; issues: FlowmapIssue[] }

export interface YamlExportResult {
  text: string
  /** Relative to the Kho, for example `xuat/moe-education-account.flowmap.yaml`. */
  file: string
}

export interface FsApi {
  /** Opens the source document of a block with the operating system. Never writes. */
  open(nodeId: number): Promise<IpcResult<null>>
  /** Existence of each document path (relative to the documents folder). */
  exists(projectId: number, relPaths: string[]): Promise<IpcResult<Record<string, boolean>>>
  /** Folder dialog for the documents folder. Returns CANCELLED when the user closes it. */
  pick(projectId: number): Promise<IpcResult<ProjectInfo>>
}

/** A file chosen in the import dialog: Flowmap YAML or a Mermaid flowchart. */
export interface ImportFile {
  /** File name without the folder. */
  name: string
  text: string
}

export interface YamlApi {
  export(projectId: number): Promise<IpcResult<YamlExportResult>>
  /** Flowmap YAML, or a Mermaid flowchart (TDD 6.7). Nothing is written. */
  preview(projectId: number, text: string, options: MergeOptions): Promise<IpcResult<YamlPreview>>
  apply(
    projectId: number,
    text: string,
    options: MergeOptions
  ): Promise<IpcResult<{ summary: MergeSummary; data: ProjectData }>>
  /** File dialog for the import. Returns CANCELLED when the user closes it. */
  pickFile(): Promise<IpcResult<ImportFile>>
  /** Like preview, against an empty project: the import of the welcome screen. */
  previewNew(text: string): Promise<IpcResult<YamlPreview>>
  /** Creates a project called `name` and imports the text into it. */
  applyNew(
    name: string,
    text: string
  ): Promise<IpcResult<{ project: ProjectSummary; summary: MergeSummary }>>
}

/** Where an export was written, relative to the Kho. */
export interface ExportResult {
  file: string
}

export interface ExportApi {
  mermaid(projectId: number): Promise<IpcResult<ExportResult>>
  jsonCanvas(projectId: number): Promise<IpcResult<ExportResult>>
  /** The renderer draws the picture, main only checks it is a PNG and writes the file. */
  png(projectId: number, dataUrl: string): Promise<IpcResult<ExportResult>>
  /** Opens `xuat/` of the Kho with the operating system. */
  openFolder(): Promise<IpcResult<null>>
}

/**
 * Rows to put back, or to insert as copies (undo, redo, paste). A row with an `id` is restored
 * under that id, a row without one gets a new id. Links, steps and forks refer to blocks by key so
 * that copies can point at each other before their ids exist.
 */
export interface BundleGroup extends Omit<GroupData, 'id'> {
  id?: number
}
export interface BundleNode extends Omit<NodeData, 'id'> {
  id?: number
}
export interface BundleLink {
  id?: number
  key: string
  fromKey: string
  toKey: string
  via: ViaType
  label: string
  note: string
  sortOrder?: number
}
export interface BundleImage extends Omit<ImageData, 'id' | 'nodeId'> {
  id: number
  nodeKey: string
}
/** A scenario that was deleted, put back under its old id. Parents are listed before their branches. */
export interface BundleScenario {
  id: number
  key: string
  type: ScenarioType
  title: string
  parentId: number | null
  forkNodeKey: string | null
  sortOrder: number
}
/** The complete ordered steps of a scenario. */
export interface BundleSteps {
  scenarioId: number
  steps: { nodeKey: string; note: string }[]
}
export interface BundleFork {
  scenarioId: number
  parentId: number | null
  forkNodeKey: string | null
}
export interface RestoreBundle {
  groups?: BundleGroup[]
  nodes?: BundleNode[]
  links?: BundleLink[]
  images?: BundleImage[]
  pins?: PinData[]
  scenarios?: BundleScenario[]
  steps?: BundleSteps[]
  forks?: BundleFork[]
}
export interface RestoreResult {
  groups: GroupData[]
  nodes: NodeData[]
  links: LinkData[]
}

export interface HistoryApi {
  restore(projectId: number, bundle: RestoreBundle): Promise<IpcResult<RestoreResult>>
}

export interface ImagePatch {
  caption?: string
}

export interface PinInput {
  xPct: number
  yPct: number
  note?: string
}

export interface PinPatch {
  xPct?: number
  yPct?: number
  note?: string
}

export interface ImageApi {
  /** Opens the file dialog and adds the chosen images. Returns CANCELLED when nothing was chosen. */
  pick(nodeId: number): Promise<IpcResult<ImageData[]>>
  addFromPaths(nodeId: number, absPaths: string[]): Promise<IpcResult<ImageData[]>>
  /** For a dropped file whose path is unknown: the bytes travel instead. */
  addFromBytes(nodeId: number, fileName: string, bytes: Uint8Array): Promise<IpcResult<ImageData>>
  addFromClipboard(nodeId: number): Promise<IpcResult<ImageData>>
  update(id: number, patch: ImagePatch): Promise<IpcResult<ImageData>>
  /** Deletes the row and its pins. The file stays in anh/ until the project is closed (undo). */
  remove(id: number): Promise<IpcResult<null>>
  reorder(nodeId: number, ids: number[]): Promise<IpcResult<null>>
  /** Moves files nothing refers to any more into thung-rac/. */
  sweep(projectId: number): Promise<IpcResult<{ moved: number }>>
}

export interface PinApi {
  create(imageId: number, input: PinInput): Promise<IpcResult<PinData>>
  update(id: number, patch: PinPatch): Promise<IpcResult<PinData>>
  remove(id: number): Promise<IpcResult<null>>
  reorder(imageId: number, ids: number[]): Promise<IpcResult<null>>
}

/** Object exposed as window.api.diagram. */
export interface DiagramApi {
  project: ProjectApi
  node: NodeApi
  group: GroupApi
  link: LinkApi
  scenario: ScenarioApi
  fs: FsApi
  history: HistoryApi
  yaml: YamlApi
  export: ExportApi
  image: ImageApi
  pin: PinApi
  /** Absolute path of a dropped file, or '' when the system does not know it. */
  pathOfFile(file: File): string
}

/** Block types, same set as the dg_nodes CHECK constraint (TDD 5.2). */
export const NODE_TYPES = ['fnc', 'req', 'tech', 'ext', 'start', 'end', 'cond', 'note'] as const
export type NodeType = (typeof NODE_TYPES)[number]

/** Channel kinds, same set as the dg_links CHECK constraint (TDD 5.2). */
export const VIA_TYPES = [
  'impl',
  'rest',
  'webhook',
  'db',
  'ui',
  'call',
  'redirect',
  'job',
  'event',
  'queue',
  'file'
] as const
export type ViaType = (typeof VIA_TYPES)[number]

/** Scenario kinds: Positive, Negative, Alternative, Edge case. */
export const SCENARIO_TYPES = ['pos', 'neg', 'alt', 'edge'] as const
export type ScenarioType = (typeof SCENARIO_TYPES)[number]

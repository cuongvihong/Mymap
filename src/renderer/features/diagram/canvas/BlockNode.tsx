import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BlockDisplay } from '../../../../shared/diagram/display'
import { blockWidth } from '../../../../shared/diagram/frames'
import type { NodeData, ScenarioType } from '../../../../shared/diagram/types'
import { ChevronIcon, DocIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { portState, useDiagram } from '../store/diagramStore'
import { ThumbStrip } from '../images/ThumbStrip'
import { imageExtension } from '../../../../shared/diagram/imagerules'
import styles from './Block.module.css'

/** `ok`: file found, `missing`: red button, `unknown`: not checked yet or no documents folder. */
export type FsState = 'ok' | 'missing' | 'unknown'

export interface BlockData extends Record<string, unknown> {
  node: NodeData
  display: BlockDisplay
  /** The detail panel shows this block. */
  selected: boolean
  fsState: FsState
  /** Full path for the tooltip of the document button. */
  fsLabel: string
  /** Functions behind a REQ block, null for the other types. */
  coverage: number | null
  /** Type of the scenario Play is on at this block: it glows in that colour (FR-KB-06). */
  running: ScenarioType | null
  /** Codes of the selected branches that leave their parent at this block. */
  forks: string[]
}

export type BlockFlowNode = Node<BlockData, 'block'>

/** Colour variable of the bar on the left. An end block takes the colour of its outcome. */
export function typeColor(node: Pick<NodeData, 'type' | 'subtype'>): string {
  if (node.type === 'end') return `var(--dg-t-${node.subtype ?? 'ok'})`
  return `var(--dg-t-${node.type})`
}

const CLASS: Record<BlockDisplay, string> = {
  normal: '',
  focus: styles.focus ?? '',
  lit: '',
  dim: styles.dim ?? ''
}

function TitleEditor({ node }: { node: NodeData }) {
  const [value, setValue] = useState(node.title)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const s = useDiagram.getState()
    if (save) void s.renameNode(node.id, value)
    else s.startEditing(null)
  }
  return (
    <input
      ref={ref}
      className={`${styles.titleInput} nodrag nopan`}
      value={value}
      maxLength={80}
      aria-label={t.block.renameLabel}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  )
}

function Body({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 1)
  }, [text, open])
  if (!text) return null
  return (
    <>
      <p ref={ref} className={open ? styles.bodyOpen : styles.body}>
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          className={`${styles.more} nodrag`}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {open ? t.block.less : t.block.more}
        </button>
      )}
    </>
  )
}

/** The eight block types share one layout (ảnh 01); only the colour bar and the width differ. */
function BlockNodeView({ data }: NodeProps<BlockFlowNode>) {
  const { node, display, selected, fsState, fsLabel, coverage, running, forks } = data
  const editing = useDiagram((s) => s.editingId === node.id)
  const [dropping, setDropping] = useState(false)
  const port = useDiagram((s) => portState(s, node))
  const collapsed = node.collapsed
  const classes = [
    styles.block,
    CLASS[display],
    selected ? styles.selected : '',
    port === 'ok' ? styles.portOk : '',
    port === 'bad' ? styles.portBad : '',
    collapsed ? styles.collapsedBlock : '',
    dropping ? styles.dropping : '',
    running ? styles.running : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      style={{
        width: blockWidth(node.type),
        ...(running ? { ['--dg-run' as string]: `var(--dg-s-${running})` } : {})
      }}
      data-running={running ?? undefined}
      data-type={node.type}
      data-id={node.key}
      data-display={display}
      onDragOver={(e) => {
        // Image files dropped from the file manager are added to this block (FR-AN-01).
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (!dropping) setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setDropping(false)
        const files = [...e.dataTransfer.files].filter((f) => imageExtension(f.name) !== null)
        if (files.length === 0) {
          useDiagram.getState().reportError('IMAGE_FORMAT')
          return
        }
        void useDiagram.getState().addImageFiles(node.id, files)
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={styles.port}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectableEnd={false}
        className={`${styles.port} ${styles.portOut}`}
        title={t.channel.port}
        aria-label={t.channel.port}
      />
      <div className={styles.bar} style={{ background: typeColor(node) }} />
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.code}>{node.code}</span>
          {forks.length > 0 && (
            <span
              className={styles.forkTag}
              data-fork={forks.join(' ')}
              title={t.scenario.forkTitle.replace('{keys}', forks.join(', '))}
            >
              {t.scenario.forkBadge}
            </span>
          )}
          {node.fsFile && (
            <button
              type="button"
              className={`${styles.iconBtn} ${fsState === 'missing' ? styles.missing : ''} nodrag`}
              title={fsState === 'missing' ? t.block.fsMissing : fsLabel}
              aria-label={`${t.block.openFs}: ${node.fsFile}${fsState === 'missing' ? `. ${t.block.fsMissing}` : ''}`}
              data-fs={fsState}
              onClick={(e) => {
                e.stopPropagation()
                void useDiagram.getState().openFs(node.id)
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <DocIcon size={15} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.fold} nodrag`}
            aria-label={collapsed ? t.block.expand : t.block.collapse}
            title={collapsed ? t.block.expand : t.block.collapse}
            aria-expanded={!collapsed}
            onClick={(e) => {
              e.stopPropagation()
              void useDiagram.getState().toggleNodeCollapsed(node.id)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <span className={collapsed ? styles.chevronClosed : ''}>
              <ChevronIcon size={13} />
            </span>
          </button>
        </div>

        {editing ? (
          <TitleEditor node={node} />
        ) : (
          <div
            className={styles.title}
            title={t.block.renameHint}
            onDoubleClick={(e) => {
              e.stopPropagation()
              useDiagram.getState().startEditing(node.id)
            }}
          >
            {node.title}
          </div>
        )}

        {!collapsed && (
          <>
            <Body text={node.body} />
            <ThumbStrip nodeId={node.id} />
            {node.chips.length > 0 && (
              <div className={styles.chips}>
                {node.chips.map((c) => (
                  <span key={c} className={styles.chip}>
                    {c}
                  </span>
                ))}
              </div>
            )}
            {node.fixText && (
              <div className={styles.fix}>
                <b>{t.block.fixLabel}</b> {node.fixText}
              </div>
            )}
          </>
        )}
        {coverage !== null && (
          <div className={styles.coverageRow}>
            <span
              className={coverage === 0 ? styles.coverageNone : styles.coverageOk}
              data-coverage={coverage}
              title={t.block.coverage}
            >
              {coverage === 0 ? t.req.uncovered : t.req.covered.replace('{n}', String(coverage))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export const BlockNodeComponent = memo(BlockNodeView)

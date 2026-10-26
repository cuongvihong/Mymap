import { ViewportPortal } from '@xyflow/react'
import { memo, useEffect, useRef, useState } from 'react'
import { ChevronIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import type { FrameModel } from './model'
import styles from './Layers.module.css'

interface FramesProps {
  frames: readonly FrameModel[]
  onRemove: (frame: FrameModel) => void
}

/**
 * Group frames drawn behind the blocks. They are computed from the member rectangles, so a frame
 * grows and shrinks while a block is dragged, and a collapsed group is one tile (FR-NH-03).
 */
function GroupTitleEditor({
  id,
  title,
  onDone
}: {
  id: number
  title: string
  onDone: () => void
}) {
  const [value, setValue] = useState(title)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save) void useDiagram.getState().renameGroup(id, value)
    onDone()
  }
  return (
    <input
      ref={ref}
      className={`${styles.titleInput} nodrag nopan`}
      value={value}
      maxLength={80}
      aria-label={t.group.renameLabel}
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

function FramesView({ frames, onRemove }: FramesProps) {
  const dropGroupId = useDiagram((s) => s.dropGroupId)
  const [renaming, setRenaming] = useState<number | null>(null)
  return (
    <>
      {frames.map((f) => {
        const classes = [
          f.collapsed ? styles.tile : styles.frame,
          f.display === 'dim' ? styles.dim : '',
          dropGroupId === f.group.id ? styles.drop : ''
        ]
          .filter(Boolean)
          .join(' ')
        const toggle = () => void useDiagram.getState().toggleGroupCollapsed(f.group.id)
        return (
          <div
            key={f.group.id}
            className={classes}
            data-group={f.group.key}
            data-collapsed={f.collapsed}
            style={{ left: f.rect.x, top: f.rect.y, width: f.rect.w, height: f.rect.h }}
          >
            <div className={styles.label}>
              <b>{f.group.key}</b>
              {renaming === f.group.id ? (
                <GroupTitleEditor
                  id={f.group.id}
                  title={f.group.title}
                  onDone={() => setRenaming(null)}
                />
              ) : (
                <span
                  className={`${styles.labelTitle} nodrag nopan`}
                  title={t.group.renameHint}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setRenaming(f.group.id)
                  }}
                >
                  {f.collapsed ? `${f.memberIds.length} ${t.group.tileCount}` : f.group.title}
                </span>
              )}
              <button
                type="button"
                className={`${styles.labelBtn} nodrag nopan`}
                aria-label={`${f.collapsed ? t.group.expand : t.group.collapse}: ${f.group.key}`}
                title={f.collapsed ? t.group.expand : t.group.collapse}
                aria-expanded={!f.collapsed}
                onClick={toggle}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <span className={f.collapsed ? styles.chevronClosed : ''}>
                  <ChevronIcon size={12} />
                </span>
              </button>
              <button
                type="button"
                className={`${styles.labelBtn} nodrag nopan`}
                aria-label={`${t.group.remove}: ${f.group.key}`}
                title={t.group.remove}
                onClick={() => onRemove(f)}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <TrashIcon size={12} />
              </button>
            </div>
            {f.collapsed && <div className={styles.tileTitle}>{f.group.title}</div>}
          </div>
        )
      })}
    </>
  )
}

export const FramesLayer = memo(function FramesLayer(props: FramesProps) {
  return (
    <ViewportPortal>
      <FramesView {...props} />
    </ViewportPortal>
  )
})

/** Alignment lines shown while blocks are dragged (FR-SUA-03). */
function GuidesView() {
  const guides = useDiagram((s) => s.guides)
  if (guides.length === 0) return null
  return (
    <svg className={styles.guides} width={1} height={1} aria-hidden>
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <line key={i} x1={g.at} x2={g.at} y1={g.from} y2={g.to} data-guide="x" />
        ) : (
          <line key={i} y1={g.at} y2={g.at} x1={g.from} x2={g.to} data-guide="y" />
        )
      )}
    </svg>
  )
}

export const GuidesLayer = memo(function GuidesLayer() {
  return (
    <ViewportPortal>
      <GuidesView />
    </ViewportPortal>
  )
})

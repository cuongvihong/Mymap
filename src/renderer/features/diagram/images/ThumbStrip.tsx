import { useEffect, useMemo, useRef } from 'react'
import type { ImageData } from '../../../../shared/diagram/types'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { ImageThumb } from './ImageThumb'
import styles from './Images.module.css'

/** Hover waits this long before the enlarged preview opens, so passing the pointer over is quiet. */
export const PEEK_DELAY_MS = 250
const STRIP_MAX = 3

const boxOf = (r: DOMRect) => ({ x: r.left, y: r.top, w: r.width, h: r.height })

const EMPTY: ImageData[] = []

/** Up to three thumbnails on a block and "+N" for the rest (FR-AN-02). */
export function ThumbStrip({ nodeId }: { nodeId: number }) {
  const all = useDiagram((s) => s.data?.images ?? EMPTY)
  const projectId = useDiagram((s) => s.data?.project.id ?? 0)
  const images = useMemo(() => all.filter((i) => i.nodeId === nodeId), [all, nodeId])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])

  if (images.length === 0) return null
  const shown = images.slice(0, STRIP_MAX)
  const extra = images.length - shown.length

  return (
    <div className={`${styles.strip} nodrag nopan`} data-strip={nodeId}>
      {shown.map((image) => (
        <button
          key={image.id}
          type="button"
          className={styles.stripThumb}
          data-thumb={image.id}
          title={image.caption}
          aria-label={`${t.image.open}: ${image.caption}`}
          onClick={(e) => {
            e.stopPropagation()
            clear()
            useDiagram.getState().openViewer({
              imageId: image.id,
              pin: -1,
              from: boxOf(e.currentTarget.getBoundingClientRect())
            })
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerEnter={(e) => {
            clear()
            const block = e.currentTarget.closest('.react-flow__node') ?? e.currentTarget
            const anchor = boxOf(block.getBoundingClientRect())
            timer.current = setTimeout(() => {
              useDiagram.getState().setPeek({ imageId: image.id, anchor })
            }, PEEK_DELAY_MS)
          }}
          onPointerLeave={() => {
            clear()
            useDiagram.getState().setPeek(null)
          }}
        >
          <ImageThumb projectId={projectId} image={image} />
        </button>
      ))}
      {extra > 0 && (
        <button
          type="button"
          className={styles.more}
          data-more={nodeId}
          title={t.image.moreImages.replace('{n}', String(extra))}
          aria-label={t.image.moreImages.replace('{n}', String(extra))}
          onClick={(e) => {
            e.stopPropagation()
            useDiagram.getState().selectNode(nodeId)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          +{extra}
        </button>
      )}
    </div>
  )
}

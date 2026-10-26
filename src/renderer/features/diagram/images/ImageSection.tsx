import { useMemo, useState } from 'react'
import { IMAGE_LIMITS } from '../../../../shared/diagram/imagerules'
import type { ImageData, NodeData } from '../../../../shared/diagram/types'
import { GripIcon, ImageIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { ImageThumb } from './ImageThumb'
import styles from './Images.module.css'

const EMPTY: ImageData[] = []

function CaptionField({ image }: { image: ImageData }) {
  const [value, setValue] = useState(image.caption)
  const [seen, setSeen] = useState(image.caption)
  if (seen !== image.caption) {
    setSeen(image.caption)
    setValue(image.caption)
  }
  const commit = () => {
    const next = value.trim()
    if (next === '') setValue(image.caption)
    else if (next !== image.caption) void useDiagram.getState().setImageCaption(image.id, next)
  }
  return (
    <input
      value={value}
      maxLength={300}
      aria-label={t.image.caption}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

/** Images of the block in the detail panel: add, open, rename, drag to reorder, delete (FR-AN-02). */
export function ImageSection({ node }: { node: NodeData }) {
  const all = useDiagram((s) => s.data?.images ?? EMPTY)
  const pins = useDiagram((s) => s.data?.pins)
  const projectId = useDiagram((s) => s.data?.project.id ?? 0)
  const images = useMemo(() => all.filter((i) => i.nodeId === node.id), [all, node.id])
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const full = images.length >= IMAGE_LIMITS.maxPerBlock
  const act = useDiagram.getState

  return (
    <section className={styles.section} data-images={node.id}>
      <div className={styles.sectionHead}>
        <h4>{t.image.section}</h4>
        <span className={styles.count}>{t.image.count.replace('{n}', String(images.length))}</span>
      </div>
      {images.length === 0 && <p>{t.image.none}</p>}
      <ul className={styles.list}>
        {images.map((image, i) => (
          <li
            key={image.id}
            className={`${styles.item} ${dragFrom === i ? styles.itemDrag : ''} ${over === i && dragFrom !== i ? styles.itemOver : ''}`}
            draggable
            data-image-row={image.id}
            onDragStart={(e) => {
              if ((e.target as HTMLElement).closest('input')) {
                e.preventDefault()
                return
              }
              e.dataTransfer.setData('text/plain', String(i))
              e.dataTransfer.effectAllowed = 'move'
              setDragFrom(i)
            }}
            onDragOver={(e) => {
              if (dragFrom === null) return
              e.preventDefault()
              setOver(i)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              const from = dragFrom
              setDragFrom(null)
              setOver(null)
              if (from === null || from === i) return
              const order = images.map((x) => x.id)
              const [moved] = order.splice(from, 1)
              if (moved === undefined) return
              order.splice(i, 0, moved)
              void act().reorderImages(node.id, order)
            }}
            onDragEnd={() => {
              setDragFrom(null)
              setOver(null)
            }}
          >
            <span className={styles.grip} title={t.image.drag}>
              <GripIcon size={12} />
            </span>
            <button
              type="button"
              className={styles.detailThumb}
              aria-label={`${t.image.open}: ${image.caption}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                act().openViewer({
                  imageId: image.id,
                  pin: -1,
                  from: { x: r.left, y: r.top, w: r.width, h: r.height }
                })
              }}
            >
              <ImageThumb projectId={projectId} image={image} />
            </button>
            <div className={styles.meta}>
              <CaptionField image={image} />
              <span>
                {image.width} x {image.height},{' '}
                {t.image.pins.replace(
                  '{n}',
                  String(pins?.filter((p) => p.imageId === image.id).length ?? 0)
                )}
              </span>
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`${t.image.remove}: ${image.caption}`}
              title={t.image.remove}
              data-image-remove={image.id}
              onClick={() => void act().removeImage(image.id)}
            >
              <TrashIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div>
        <button
          type="button"
          className={styles.btn}
          data-add-image
          disabled={full}
          title={full ? t.image.full : t.image.add}
          onClick={() => void act().pickImages(node.id)}
        >
          <ImageIcon size={14} /> {t.image.add}
        </button>
      </div>
    </section>
  )
}

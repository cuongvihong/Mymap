import { useMemo } from 'react'
import { imageUrl } from '../../../../shared/diagram/imagerules'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import styles from './Images.module.css'

const PEEK_MAX = { w: 340, h: 300 }
const GAP = 12

/** The image of a thumbnail enlarged beside its block, after the pointer rested for 250 ms. */
export function HoverPeek() {
  const peek = useDiagram((s) => s.peek)
  const data = useDiagram((s) => s.data)
  const image = peek ? data?.images.find((i) => i.id === peek.imageId) : undefined

  const place = useMemo(() => {
    if (!peek || !image) return null
    const k = Math.min(1, PEEK_MAX.w / image.width, PEEK_MAX.h / image.height)
    const w = Math.max(80, Math.round(image.width * k))
    const h = Math.max(60, Math.round(image.height * k))
    const a = peek.anchor
    const right = a.x + a.w + GAP
    const left = right + w + 16 <= window.innerWidth ? right : Math.max(8, a.x - GAP - w - 2)
    const top = Math.min(Math.max(8, a.y), Math.max(8, window.innerHeight - h - 56))
    return { w, h, left, top }
  }, [peek, image])

  if (!peek || !image || !place || !data) return null
  return (
    <div
      className={styles.hoverPeek}
      style={{ left: place.left, top: place.top, width: place.w + 2 }}
      role="img"
      aria-label={`${t.image.peek}: ${image.caption}`}
      data-peek={image.id}
    >
      <img
        src={imageUrl(data.project.id, image.relPath)}
        alt=""
        width={place.w}
        height={place.h}
        draggable={false}
      />
      <span>{image.caption}</span>
    </div>
  )
}

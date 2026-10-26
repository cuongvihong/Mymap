import { useState } from 'react'
import { imageUrl, thumbPath } from '../../../../shared/diagram/imagerules'
import type { ImageData } from '../../../../shared/diagram/types'
import styles from './Images.module.css'

export interface ImageThumbProps {
  projectId: number
  image: Pick<ImageData, 'id' | 'relPath' | 'caption'>
  className?: string
}

/** Thumbnail of an image. When the 240 px copy is missing the protocol serves the original. */
export function ImageThumb({ projectId, image, className }: ImageThumbProps) {
  const [failed, setFailed] = useState(false)
  return (
    <img
      className={`${styles.thumbImg} ${className ?? ''}`}
      src={imageUrl(projectId, failed ? image.relPath : thumbPath(image.relPath))}
      alt={image.caption}
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

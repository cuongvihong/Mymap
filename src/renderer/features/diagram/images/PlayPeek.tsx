import { useMemo } from 'react'
import { imageUrl } from '../../../../shared/diagram/imagerules'
import { cssTransform, PEEK_FRAME, playPeekModel } from '../../../../shared/diagram/pinview'
import type { ImageData, PinData } from '../../../../shared/diagram/types'
import styles from './Images.module.css'

export interface PlayPeekProps {
  projectId: number
  image: ImageData
  /** Pins of this image, in their order. */
  pins: readonly PinData[]
  /** The scenario step note: the pin whose note shares the most words with it is shown. */
  stepNote?: string
  /** Shows this pin instead of choosing one from `stepNote`. */
  pinIndex?: number
  /** Clicked: the caller opens the lightbox at the same pin. */
  onOpen?: (pinIndex: number) => void
}

/**
 * Card shown beside the block while a scenario plays (FR-KB-08): 280 x 170, the image cropped
 * around one pin, the pin blinking, the image name and the pin note under it. Session 08 places it.
 */
export function PlayPeek({
  projectId,
  image,
  pins,
  stepNote = '',
  pinIndex,
  onOpen
}: PlayPeekProps) {
  const { index, view, markerScale } = useMemo(
    () => playPeekModel({ w: image.width, h: image.height }, pins, stepNote, pinIndex),
    [image.width, image.height, pins, stepNote, pinIndex]
  )
  const pin = index >= 0 ? pins[index] : undefined
  return (
    <div
      className={styles.playPeek}
      style={{ width: PEEK_FRAME.w }}
      data-play-peek={image.id}
      data-pin-index={index}
    >
      <button
        type="button"
        className={styles.playView}
        style={{ height: PEEK_FRAME.h }}
        aria-label={image.caption}
        onClick={() => onOpen?.(index)}
      >
        <div
          className={styles.playImg}
          style={{ width: image.width, height: image.height, transform: cssTransform(view) }}
        >
          <img
            src={imageUrl(projectId, image.relPath)}
            alt=""
            width={image.width}
            height={image.height}
            draggable={false}
          />
          {pin && (
            <span
              className={styles.pin}
              style={{
                left: `${pin.xPct}%`,
                top: `${pin.yPct}%`,
                transform: `scale(${markerScale})`
              }}
              data-play-pin={index}
            >
              {index + 1}
            </span>
          )}
        </div>
      </button>
      <div className={styles.playCaption}>
        <b>{image.caption}</b>
        {pin && pin.note && (
          <>
            <br />
            {pin.note}
          </>
        )}
      </div>
    </div>
  )
}

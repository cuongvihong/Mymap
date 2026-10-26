import { useMemo } from 'react'
import { pickPeek } from '../../../../shared/diagram/pinpick'
import { PlayPeek } from '../images/PlayPeek'
import { useDiagram } from '../store/diagramStore'
import styles from './Play.module.css'

/**
 * The card of the image behind the block Play is on, at the top right of the canvas (FR-ANH-06).
 * It shows when the switch "Ảnh khi Play" is on and the block has an image. The pin comes from
 * the note of the step. A click opens the lightbox at that pin and holds Play until it closes.
 */
export function PlayPeekHost() {
  const play = useDiagram((s) => s.play)
  const data = useDiagram((s) => s.data)
  const enabled = useDiagram((s) => s.playImages)
  const step = play ? play.steps[play.index] : undefined

  const shown = useMemo(() => {
    if (!data || !step) return null
    const images = data.images
      .filter((i) => i.nodeId === step.nodeId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    if (images.length === 0) return null
    const pinsOf = (imageId: number) =>
      data.pins
        .filter((p) => p.imageId === imageId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    const pick = pickPeek(
      images.map((i) => ({ imageId: i.id, pins: pinsOf(i.id) })),
      step.note
    )
    const image = images.find((i) => i.id === pick?.imageId)
    return image && pick ? { image, pins: pinsOf(image.id), pinIndex: pick.pinIndex } : null
  }, [data, step])

  if (!play || !enabled || !data || !shown) return null
  return (
    <div className={styles.peek} data-play-peek-host>
      <PlayPeek
        key={`${play.index}-${shown.image.id}`}
        projectId={data.project.id}
        image={shown.image}
        pins={shown.pins}
        stepNote={step?.note ?? ''}
        pinIndex={shown.pinIndex}
        onOpen={(pinIndex) => {
          const st = useDiagram.getState()
          const box = document
            .querySelector('[data-play-peek-host] button')
            ?.getBoundingClientRect()
          st.pausePlayForViewer()
          st.openViewer({
            imageId: shown.image.id,
            pin: pinIndex,
            from: box ? { x: box.left, y: box.top, w: box.width, h: box.height } : null
          })
        }}
      />
    </div>
  )
}

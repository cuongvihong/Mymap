import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import styles from './Play.module.css'

/** Card at the middle of the lower edge: "P-01 · 7/13", the block and the note of the step (FR-KB-06). */
export function PlayCaption() {
  const play = useDiagram((s) => s.play)
  const data = useDiagram((s) => s.data)
  if (!play || !data) return null
  const step = play.steps[play.index]
  const node = step ? data.nodes.find((n) => n.id === step.nodeId) : undefined
  const scenario = data.scenarios.find((s) => s.id === play.scenarioId)
  if (!step || !node || !scenario) return null
  return (
    <div
      className={styles.caption}
      role="status"
      aria-label={t.play.caption}
      data-play-caption
      data-step={play.index + 1}
      data-total={play.steps.length}
    >
      <span className={styles.captionCode}>
        {scenario.key} · {play.index + 1}/{play.steps.length}
      </span>
      <div className={styles.captionText}>
        <b>
          {node.code} · {node.title}
        </b>
        {step.note && <span>{step.note}</span>}
      </div>
    </div>
  )
}

import { PLAY_SPEEDS } from '../../../../shared/diagram/player'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import styles from './Play.module.css'

/** Pause, stop and speed in the top bar while a scenario plays (FR-KB-06). Nothing when idle. */
export function PlayControls() {
  const play = useDiagram((s) => s.play)
  if (!play) return null
  const act = useDiagram.getState
  return (
    <div className={styles.controls} role="group" aria-label={t.play.controls} data-play-controls>
      <button
        type="button"
        className={styles.btn}
        aria-pressed={play.paused}
        data-play-pause
        onClick={() => act().togglePausePlay()}
      >
        {play.paused ? t.play.resume : t.play.pause}
      </button>
      <button type="button" className={styles.btn} data-play-stop onClick={() => act().stopPlay()}>
        {t.play.stop}
      </button>
      <div className={styles.seg} role="group" aria-label={t.play.speed}>
        {PLAY_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={play.speed === speed}
            data-play-speed={speed}
            onClick={() => act().setPlaySpeed(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  )
}

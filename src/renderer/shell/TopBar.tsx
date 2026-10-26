import type { ReactNode } from 'react'
import type { ChannelMode, Theme } from '../../shared/diagram/types'
import type { SaveState } from './store'
import { shellStrings as t } from './strings'
import styles from './TopBar.module.css'

export interface TopBarProps {
  projectName: string
  subtitle: string
  saveState: SaveState
  onBack: () => void
  theme: Theme
  onToggleTheme: () => void
  channelMode: ChannelMode
  onChannelMode: (mode: ChannelMode) => void
  playImages: boolean
  onPlayImages: (value: boolean) => void
  onFit: () => void
  /** Search box of the diagram, placed by the app. */
  search?: ReactNode
  /** Pause, stop and speed of Play, shown by the diagram only while a scenario plays. */
  playControls?: ReactNode
  /** Import, export and the YAML switch of the diagram. */
  dataTools?: ReactNode
}

/** Top bar of the shell. Only the theme button works in Session 01. */
export function TopBar(props: TopBarProps) {
  const { theme, channelMode, playImages } = props
  return (
    <header className={styles.top} aria-label={t.topbar.label}>
      <button type="button" className={styles.btn} onClick={props.onBack} title={t.topbar.backHint}>
        {t.topbar.back}
      </button>

      <div className={styles.brand}>
        <h1 className={styles.title}>{props.projectName}</h1>
        <small>{props.subtitle}</small>
        <small role="status" className={styles.saveState}>
          {props.saveState === 'saving' ? t.topbar.saving : t.topbar.saved}
        </small>
      </div>

      {props.search}

      <div className={styles.seg} role="group" aria-label={t.topbar.channelMode}>
        <button
          type="button"
          aria-pressed={channelMode === 'one'}
          onClick={() => props.onChannelMode('one')}
        >
          {t.topbar.oneWire}
        </button>
        <button
          type="button"
          aria-pressed={channelMode === 'many'}
          onClick={() => props.onChannelMode('many')}
        >
          {t.topbar.manyWires}
        </button>
      </div>

      <label className={styles.btn}>
        <input
          type="checkbox"
          checked={playImages}
          onChange={(e) => props.onPlayImages(e.target.checked)}
        />
        {t.topbar.playImages}
      </label>

      {props.playControls}

      {props.dataTools}

      <button
        type="button"
        className={styles.btn}
        title={t.topbar.fitViewHint}
        onClick={props.onFit}
      >
        {t.topbar.fitView}
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={props.onToggleTheme}
        aria-label={theme === 'dark' ? t.topbar.themeToLight : t.topbar.themeToDark}
        title={theme === 'dark' ? t.topbar.themeToLight : t.topbar.themeToDark}
      >
        {t.topbar.theme}
      </button>
    </header>
  )
}

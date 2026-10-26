import { useEffect } from 'react'
import { DataTools } from '../features/diagram/data/DataMenus'
import { DiagramPage } from '../features/diagram/DiagramPage'
import { SearchBox } from '../features/diagram/panels/SearchBox'
import { PlayControls } from '../features/diagram/play/PlayControls'
import { Sidebar } from '../features/diagram/panels/Sidebar'
import {
  setDiagramErrorSink,
  setDiagramNoticeSink,
  useDiagram
} from '../features/diagram/store/diagramStore'
import { errorText } from './errors'
import { LostOverlay, Toast } from './Overlays'
import { shellStrings as t } from './strings'
import { useShell } from './store'
import { TopBar } from './TopBar'
import { WelcomeScreen } from './WelcomeScreen'
import styles from './App.module.css'

const pad4 = (n: number) => String(n).padStart(4, '0')

/**
 * Application shell. `dg-root` carries the module tokens and the theme attribute.
 * Flow: no Kho or no open project shows the welcome screen, an open project shows the map.
 */
export function App() {
  const ready = useShell((s) => s.ready)
  const current = useShell((s) => s.current)
  const theme = useShell((s) => s.theme)
  const health = useShell((s) => s.health)
  const toast = useShell((s) => s.toast)
  const saveState = useShell((s) => s.saveState)
  const dismissToast = useShell((s) => s.dismissToast)

  useEffect(() => {
    setDiagramErrorSink((code) => useShell.getState().showError(errorText(code)))
    setDiagramNoticeSink((text, options) => useShell.getState().showToast(text, options))
    const started = useShell.getState().init()
    return () => {
      void started.then((off) => off())
    }
  }, [])

  const actions = useShell.getState()

  return (
    <div className={`dg-root ${styles.root}`} data-theme={theme}>
      <div className={styles.content} inert={health === 'lost'}>
        {!ready ? (
          <p className={styles.loading} role="status">
            {t.loading}
          </p>
        ) : current ? (
          <>
            <TopBar
              projectName={current.project.name}
              subtitle={`${t.topbar.projectCode} ${pad4(current.project.code)}`}
              saveState={saveState}
              onBack={() => void actions.closeProject()}
              theme={theme}
              onToggleTheme={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')}
              channelMode={current.settings.channelMode}
              onChannelMode={(channelMode) => actions.saveSettings({ channelMode })}
              playImages={current.settings.playImages}
              onPlayImages={(playImages) => actions.saveSettings({ playImages })}
              onFit={() => useDiagram.getState().requestFit()}
              search={<SearchBox />}
              playControls={<PlayControls />}
              dataTools={<DataTools />}
            />
            <div className={styles.main}>
              <Sidebar />
              <DiagramPage
                projectId={current.project.id}
                channelMode={current.settings.channelMode}
                playImages={current.settings.playImages}
              />
            </div>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>
      {health === 'lost' && <LostOverlay />}
      {toast && (
        <Toast
          key={toast.id}
          text={toast.text}
          kind={toast.kind}
          {...(toast.action ? { action: toast.action } : {})}
          onDismiss={dismissToast}
        />
      )}
    </div>
  )
}

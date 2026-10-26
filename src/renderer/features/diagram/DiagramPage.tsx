import { useEffect } from 'react'
import { FlowCanvas } from './canvas/FlowCanvas'
import { ImportDialog } from './data/ImportDialog'
import { YamlPanel } from './data/YamlPanel'
import { HoverPeek } from './images/HoverPeek'
import { Lightbox } from './images/Lightbox'
import type { ChannelMode } from '../../../shared/diagram/types'
import { warmElk } from './layout/elkClient'
import { diagramStrings as t } from './strings'
import { useDiagram } from './store/diagramStore'
import './styles/dg-tokens.css'
import styles from './diagram.module.css'

export interface DiagramPageProps {
  projectId: number
  /** Saved in the project settings, set by the top bar. */
  channelMode: ChannelMode
  /** The switch "Ảnh khi Play" of the top bar. */
  playImages: boolean
}

/** Single entry point of the diagram module [TH]. Loads the project into the diagram store. */
export function DiagramPage({ projectId, channelMode, playImages }: DiagramPageProps) {
  const ready = useDiagram((s) => s.data?.project.id === projectId)
  const yamlOpen = useDiagram((s) => s.yamlOpen)

  useEffect(() => {
    void useDiagram.getState().load(projectId)
    // Closing the project: files nothing refers to any more leave anh/ for thung-rac/.
    return () => useDiagram.getState().reset()
  }, [projectId])

  // Idle time after the map has opened: get the layout engine ready for the L key.
  useEffect(() => {
    const id = window.setTimeout(warmElk, 1500)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    useDiagram.getState().setChannelMode(channelMode)
  }, [channelMode])

  useEffect(() => {
    useDiagram.getState().setPlayImages(playImages)
  }, [playImages])

  // FR-KH-06: documents are checked when the project opens and whenever the window gets focus back.
  useEffect(() => {
    const recheck = () => {
      void useDiagram.getState().checkFs()
      // Something else may have been copied while the window was away.
      useDiagram.getState().noteClipboardChanged()
    }
    window.addEventListener('focus', recheck)
    return () => window.removeEventListener('focus', recheck)
  }, [])

  // A file dropped outside a block must not make the window navigate to it.
  useEffect(() => {
    const guard = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', guard)
    window.addEventListener('drop', guard)
    return () => {
      window.removeEventListener('dragover', guard)
      window.removeEventListener('drop', guard)
    }
  }, [])

  return (
    <div className={styles.workspace}>
      <main className={styles.stage} aria-label={t.canvas.region} data-project-id={projectId}>
        {ready ? (
          <>
            <FlowCanvas />
            <HoverPeek />
            <Lightbox />
          </>
        ) : (
          <p className={styles.placeholder} role="status">
            {t.canvas.loading}
          </p>
        )}
      </main>
      {ready && yamlOpen && <YamlPanel />}
      <ImportDialog mode="merge" />
    </div>
  )
}

import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { Menu } from './Menu'
import styles from './data.module.css'

const act = () => useDiagram.getState()

/** Top bar slot: Import, Xuất and the YAML switch. Shown while a project is open. */
export function DataTools() {
  const yamlOpen = useDiagram((s) => s.yamlOpen)
  const exporting = useDiagram((s) => s.exporting)
  return (
    <div className={styles.tools} role="group" aria-label={t.data.toolsLabel}>
      <Menu
        name="import"
        label={t.data.importMenu}
        ariaLabel={t.data.importMenuLabel}
        items={[
          {
            id: 'import-file',
            label: t.data.importFile,
            hint: t.data.importFileHint,
            run: () => void act().importFromFile('merge')
          },
          {
            id: 'copy-prompt',
            label: t.data.copyPrompt,
            hint: t.data.copyPromptHint,
            run: () => void act().copyPrompt()
          }
        ]}
      />
      <Menu
        name="export"
        label={t.data.exportMenu}
        ariaLabel={t.data.exportMenuLabel}
        items={[
          {
            id: 'export-yaml',
            label: t.data.exportYaml,
            disabled: exporting,
            run: () => void act().exportAs('yaml')
          },
          {
            id: 'export-mermaid',
            label: t.data.exportMermaid,
            disabled: exporting,
            run: () => void act().exportAs('mermaid')
          },
          {
            id: 'export-canvas',
            label: t.data.exportCanvas,
            disabled: exporting,
            run: () => void act().exportAs('canvas')
          },
          {
            id: 'export-png',
            label: t.data.exportPng,
            disabled: exporting,
            run: () => void act().exportAs('png')
          },
          {
            id: 'open-folder',
            label: t.data.openFolder,
            run: () => void act().openExportFolder()
          }
        ]}
      />
      <button
        type="button"
        className={styles.menuButton}
        data-yaml-toggle
        aria-pressed={yamlOpen}
        title={t.data.yamlToggleHint}
        onClick={() => act().toggleYaml()}
      >
        {t.data.yamlToggle}
      </button>
    </div>
  )
}

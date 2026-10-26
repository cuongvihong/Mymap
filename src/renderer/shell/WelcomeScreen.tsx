import { useState } from 'react'
import { formatDateTime } from '../../shared/diagram/format'
import type { ProjectSummary } from '../../shared/diagram/types'
import { ImportDialog } from '../features/diagram/data/ImportDialog'
import { useDiagram } from '../features/diagram/store/diagramStore'
import { NameDialog, RemoveDialog } from './ProjectDialogs'
import { shellStrings as t } from './strings'
import { useShell } from './store'
import styles from './WelcomeScreen.module.css'

type DialogState =
  | null
  | { kind: 'create' }
  | { kind: 'rename'; project: ProjectSummary }
  | { kind: 'remove'; project: ProjectSummary }

const pad4 = (n: number) => String(n).padStart(4, '0')

/** SCR-01: Kho buttons, project list, create project. */
export function WelcomeScreen() {
  const kho = useShell((s) => s.kho)
  const projects = useShell((s) => s.projects)
  const s = useShell.getState
  const [dialog, setDialog] = useState<DialogState>(null)
  const hasKho = Boolean(kho?.root)
  const otherKho = (kho?.recent ?? []).filter((p) => p !== kho?.root)

  return (
    <main className={styles.page}>
      <ImportDialog
        mode="new"
        onCreated={(project) => {
          void (async () => {
            await s().refreshProjects()
            await s().openProject(project.id)
          })()
        }}
      />
      <div className={styles.column}>
        <header className={styles.header}>
          <h1>{t.appTitle}</h1>
          <p>{t.tagline}</p>
        </header>

        <div className={styles.actions} role="group" aria-label={t.welcome.projects}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={!hasKho}
            onClick={() => setDialog({ kind: 'create' })}
          >
            {t.welcome.createProject}
          </button>
          <button type="button" className={styles.button} onClick={() => void s().openKho()}>
            {t.welcome.openKho}
          </button>
          <button type="button" className={styles.button} onClick={() => void s().createKho()}>
            {t.welcome.createKho}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={!hasKho}
            title={t.welcome.importYamlHint}
            data-welcome-import
            onClick={() => void useDiagram.getState().importFromFile('new')}
          >
            {t.welcome.importYaml}
          </button>
        </div>

        <section className={styles.kho} aria-label={t.welcome.khoOpen}>
          {hasKho ? (
            <p>
              {t.welcome.khoOpen}: <code>{kho?.root}</code>
            </p>
          ) : (
            <p>{t.welcome.noKho}</p>
          )}
          {otherKho.length > 0 && (
            <>
              <h2>{t.welcome.recentKho}</h2>
              <ul className={styles.recent}>
                {otherKho.map((root) => (
                  <li key={root}>
                    <button type="button" onClick={() => void s().openRecent(root)}>
                      {root}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {hasKho && (
          <section aria-labelledby="project-list-title">
            <h2 id="project-list-title" className={styles.listTitle}>
              {t.welcome.projects}
            </h2>
            {projects.length === 0 ? (
              <p className={styles.empty}>{t.welcome.emptyProjects}</p>
            ) : (
              <ul className={styles.list}>
                {projects.map((p) => (
                  <li key={p.id} className={styles.row}>
                    <button
                      type="button"
                      className={styles.open}
                      aria-label={`${t.welcome.openProject}: ${p.name}`}
                      onClick={() => void s().openProject(p.id)}
                    >
                      <span className={styles.name}>{p.name}</span>
                      <span className={styles.meta}>
                        {p.nodeCount} {t.welcome.blocks} · {t.welcome.lastEdit}{' '}
                        {formatDateTime(p.updatedAt)} · {t.welcome.code} {pad4(p.code)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.small}
                      aria-label={`${t.welcome.rename}: ${p.name}`}
                      onClick={() => setDialog({ kind: 'rename', project: p })}
                    >
                      {t.welcome.rename}
                    </button>
                    <button
                      type="button"
                      className={styles.small}
                      aria-label={`${t.welcome.remove}: ${p.name}`}
                      onClick={() => setDialog({ kind: 'remove', project: p })}
                    >
                      {t.welcome.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {dialog?.kind === 'create' && (
        <NameDialog
          mode="create"
          onSubmit={(name) => s().createProject(name)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          mode="rename"
          project={dialog.project}
          onSubmit={(name) => s().renameProject(dialog.project.id, name)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveDialog
          project={dialog.project}
          onSubmit={() => s().removeProject(dialog.project.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}

import { useEffect, useRef } from 'react'
import type { ProjectSummary } from '../../../../shared/diagram/types'
import type { MergeKind } from '../../../../shared/diagram/types'
import { useDiagram } from '../store/diagramStore'
import { diagramStrings as t } from '../strings'
import styles from './importDialog.module.css'

const KINDS: readonly MergeKind[] = ['groups', 'nodes', 'links', 'scenarios']
const act = () => useDiagram.getState()
const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (m, key: string) => String(values[key] ?? m))

export interface ImportDialogProps {
  /** `new` on the welcome screen, `merge` inside a project. */
  mode: 'merge' | 'new'
  /** The welcome screen opens the project that was created. */
  onCreated?: (project: ProjectSummary) => void
}

/** SCR-06: result of checking an import. Errors with lines, or what will change and an Apply button. */
export function ImportDialog({ mode, onCreated }: ImportDialogProps) {
  const state = useDiagram((s) => s.importDialog)
  if (!state || state.mode !== mode) return null
  return <Body onCreated={onCreated} />
}

function Body({ onCreated }: { onCreated: ImportDialogProps['onCreated'] }) {
  const d = useDiagram((s) => s.importDialog)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    act().setOverlayOpen(true)
    return () => {
      dialog?.close()
      act().setOverlayOpen(false)
    }
  }, [])

  if (!d) return null
  const preview = d.preview
  const errors = preview ? preview.issues.filter((i) => i.severity === 'error') : []
  const warnings = preview ? preview.issues.filter((i) => i.severity === 'warning') : []
  const clickable = d.mode === 'merge'

  const confirm = async () => {
    const created = await act().confirmImport()
    if (created) onCreated?.(created)
  }

  return (
    <dialog
      ref={ref}
      className={`dg-root ${styles.dialog}`}
      aria-labelledby="dg-import-title"
      data-import-dialog
      onCancel={(e) => {
        e.preventDefault()
        act().closeImport()
      }}
    >
      <h2 id="dg-import-title" className={styles.title}>
        {fill(t.importDialog.titleFile, { name: d.fileName })}
      </h2>

      {!preview && (
        <p className={styles.status} role="status">
          {t.importDialog.checking}
        </p>
      )}

      {preview && !preview.ok && (
        <section aria-label={t.importDialog.title} data-import-errors>
          <p className={styles.heading} role="alert">
            {fill(t.importDialog.errorsHeading, { n: errors.length })}
          </p>
          <p className={styles.hint}>
            {clickable ? t.importDialog.errorsHint : t.importDialog.errorsHintNew}
          </p>
          <ul className={styles.issues}>
            {errors.map((issue, i) => (
              <li key={`${issue.line}:${issue.col}:${i}`}>
                {clickable ? (
                  <button
                    type="button"
                    className={styles.issue}
                    data-import-error
                    data-line={issue.line}
                    onClick={() => act().goToImportError(issue)}
                  >
                    {issue.message}
                  </button>
                ) : (
                  <span className={styles.issue} data-import-error data-line={issue.line}>
                    {issue.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview && preview.ok && (
        <section aria-label={t.importDialog.summaryHeading} data-import-summary>
          {d.mode === 'new' && (
            <div className={styles.field}>
              <label htmlFor="dg-import-name">{t.importDialog.nameLabel}</label>
              <input
                id="dg-import-name"
                value={d.name}
                autoComplete="off"
                placeholder={t.importDialog.namePlaceholder}
                aria-invalid={d.nameError !== null}
                data-import-name
                onChange={(e) => act().setImportName(e.target.value)}
              />
              <p className={styles.fieldError} role="alert">
                {d.nameError}
              </p>
            </div>
          )}
          <p className={styles.heading}>{t.importDialog.summaryHeading}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.importDialog.colKind}</th>
                <th scope="col">{t.importDialog.colAdd}</th>
                <th scope="col">{t.importDialog.colUpdate}</th>
                <th scope="col">{t.importDialog.colRemove}</th>
                <th scope="col">{t.importDialog.colKeep}</th>
              </tr>
            </thead>
            <tbody>
              {KINDS.map((kind) => (
                <tr key={kind} data-import-row={kind}>
                  <th scope="row">{t.importDialog.kinds[kind]}</th>
                  <td data-cell="add">{preview.summary.add[kind]}</td>
                  <td data-cell="update">{preview.summary.update[kind]}</td>
                  <td data-cell="remove">{preview.summary.remove[kind]}</td>
                  <td data-cell="keep">{preview.summary.keep[kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.summary.unchanged && d.mode === 'merge' && (
            <p className={styles.status} data-import-unchanged>
              {t.importDialog.unchanged}
            </p>
          )}
          {d.mode === 'merge' && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={d.removeMissing}
                data-import-remove-missing
                onChange={(e) => void act().setImportRemoveMissing(e.target.checked)}
              />
              <span>
                {t.importDialog.removeMissing}
                <small>{t.importDialog.removeMissingHint}</small>
              </span>
            </label>
          )}
          <p className={styles.note}>{t.importDialog.layoutNote}</p>
          {d.mode === 'merge' && <p className={styles.note}>{t.importDialog.undoNote}</p>}
        </section>
      )}

      {warnings.length > 0 && (
        <details className={styles.warnings} data-import-warnings>
          <summary>{fill(t.importDialog.warningsHeading, { n: warnings.length })}</summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.actions}>
        {preview && !preview.ok && (
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            data-import-copy-errors
            onClick={() => void act().copyImportErrors()}
          >
            {t.importDialog.copyErrors}
          </button>
        )}
        <button
          type="button"
          className={styles.btn}
          data-import-close
          onClick={() => act().closeImport()}
        >
          {preview && !preview.ok ? t.importDialog.close : t.importDialog.cancel}
        </button>
        {preview && preview.ok && (
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            data-import-apply
            disabled={d.busy || (d.mode === 'merge' && preview.summary.unchanged)}
            onClick={() => void confirm()}
          >
            {d.busy
              ? t.importDialog.working
              : d.mode === 'new'
                ? t.importDialog.createButton
                : t.importDialog.applyButton}
          </button>
        )}
      </div>
    </dialog>
  )
}

import { useState, type FormEvent } from 'react'
import type { ProjectSummary } from '../../shared/diagram/types'
import { Modal } from './ui/Modal'
import styles from './ui/Modal.module.css'
import { shellStrings as t } from './strings'

interface NameDialogProps {
  mode: 'create' | 'rename'
  project?: ProjectSummary
  /** Returns an error text to show inside the dialog, or null when it worked. */
  onSubmit: (name: string) => Promise<string | null>
  onClose: () => void
}

/** Create or rename a project. The server validates the name, the dialog only shows its message. */
export function NameDialog({ mode, project, onSubmit, onClose }: NameDialogProps) {
  const copy = mode === 'create' ? t.dialogs.create : t.dialogs.rename
  const [name, setName] = useState(project?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const message = await onSubmit(name)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal title={copy.title} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        <div className={styles.field}>
          <label htmlFor="project-name">{copy.label}</label>
          <input
            id="project-name"
            value={name}
            autoFocus
            autoComplete="off"
            aria-describedby="project-name-error"
            aria-invalid={error !== null}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </div>
        {mode === 'create' && <p className={styles.hint}>{t.dialogs.create.hint}</p>}
        <p id="project-name-error" className={styles.error} role="alert">
          {error}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>
            {t.dialogs.cancel}
          </button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>
            {copy.submit}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface RemoveDialogProps {
  project: ProjectSummary
  onSubmit: () => Promise<string | null>
  onClose: () => void
}

/** Deleting asks the user to type the project name again (FR-DA-02). */
export function RemoveDialog({ project, onSubmit, onClose }: RemoveDialogProps) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const matches = typed === project.name

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!matches) return
    setBusy(true)
    const message = await onSubmit()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal title={t.dialogs.remove.title} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        <p className={styles.hint}>
          {t.dialogs.remove.intro} <strong>{project.name}</strong>
        </p>
        <div className={styles.field}>
          <label htmlFor="confirm-name">{t.dialogs.remove.label}</label>
          <input
            id="confirm-name"
            value={typed}
            autoFocus
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <p className={styles.hint}>{t.dialogs.remove.note}</p>
        <p className={styles.error} role="alert">
          {error}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>
            {t.dialogs.cancel}
          </button>
          <button
            type="submit"
            className={`${styles.button} ${styles.danger}`}
            disabled={!matches || busy}
          >
            {t.dialogs.remove.submit}
          </button>
        </div>
      </form>
    </Modal>
  )
}

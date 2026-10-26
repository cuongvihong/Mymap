import { useEffect } from 'react'
import { shellStrings as t } from './strings'
import styles from './Overlays.module.css'

/** Blocks the app while the Kho cannot be reached. It goes away by itself when the Kho is back. */
export function LostOverlay() {
  return (
    <div
      className={styles.lost}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lost-title"
      aria-describedby="lost-body"
    >
      <div className={styles.card}>
        <h2 id="lost-title">{t.lost.title}</h2>
        <p id="lost-body">{t.lost.body}</p>
        <p className={styles.retry} role="status">
          {t.lost.retrying}
        </p>
      </div>
    </div>
  )
}

interface ToastProps {
  text: string
  kind: 'info' | 'error'
  action?: { label: string; run: () => void }
  onDismiss: () => void
}

/** Toast at the lower right: red for unexpected errors (TDD 14), green for a result. Closes itself. */
export function Toast({ text, kind, action, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, action ? 10000 : 6000)
    return () => clearTimeout(timer)
  }, [text, action, onDismiss])

  return (
    <div
      className={`${styles.toast} ${kind === 'info' ? styles.info : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
      data-toast={kind}
    >
      <span>{text}</span>
      {action && (
        <button type="button" data-toast-action onClick={action.run}>
          {action.label}
        </button>
      )}
      <button type="button" aria-label={t.toast.dismiss} onClick={onDismiss}>
        {t.dialogs.close}
      </button>
    </div>
  )
}

import { useEffect, useRef, type ReactNode } from 'react'
import { useDiagram } from '../store/diagramStore'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  title: string
  children: ReactNode
  /** Buttons, last one is the main action. */
  actions: { label: string; onClick: () => void; kind?: 'primary' | 'danger' | 'plain' }[]
  onClose: () => void
}

/** Native dialog: focus trap and Esc come from the browser. It also tells the canvas that Esc is taken. */
export function ConfirmDialog({ title, children, actions, onClose }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    useDiagram.getState().setOverlayOpen(true)
    return () => {
      dialog?.close()
      useDiagram.getState().setOverlayOpen(false)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dg-root ${styles.dialog}`}
      aria-labelledby="dg-confirm-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <h2 id="dg-confirm-title" className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`${styles.btn} ${a.kind === 'primary' ? styles.primary : ''} ${a.kind === 'danger' ? styles.danger : ''}`}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </dialog>
  )
}

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './data.module.css'

export interface MenuItem {
  id: string
  label: string
  hint?: string
  disabled?: boolean
  run: () => void
}

export interface MenuProps {
  /** Text of the button. */
  label: string
  ariaLabel: string
  /** Used by tests and styles, for example `import`. */
  name: string
  items: readonly MenuItem[]
  icon?: ReactNode
}

/** Button with a list under it. Esc and a click outside close it; arrows move through the items. */
export function Menu({ label, ariaLabel, name, items, icon }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // The menu takes this Esc, so the canvas does not also clear its selection.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        root.current?.querySelector<HTMLButtonElement>('[data-menu-button]')?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const entries = [
          ...(root.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)'
          ) ?? [])
        ]
        if (entries.length === 0) return
        const at = entries.indexOf(document.activeElement as HTMLButtonElement)
        const step = e.key === 'ArrowDown' ? 1 : -1
        entries[(at + step + entries.length) % entries.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className={styles.menu} ref={root} data-menu={name}>
      <button
        type="button"
        className={styles.menuButton}
        data-menu-button
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {label}
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>
      {open && (
        <ul id={listId} className={styles.menuList} role="menu" aria-label={ariaLabel}>
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-menu-item={item.id}
                disabled={item.disabled}
                title={item.hint}
                onClick={() => {
                  setOpen(false)
                  item.run()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNodes } from '../../../../shared/diagram/search'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import styles from './SearchBox.module.css'

/** Search over code, title, body and "Nơi sửa" (FR-TIM-01). The "/" key puts the cursor here. */
export function SearchBox() {
  const data = useDiagram((s) => s.data)
  const searchOpen = useDiagram((s) => s.searchOpen)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) input.current?.focus()
  }, [searchOpen])

  const hits = useMemo(
    () => (data && query.trim() !== '' ? searchNodes(data.nodes, query, 12) : []),
    [data, query]
  )
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])

  const close = () => {
    setQuery('')
    setActive(0)
    useDiagram.getState().setSearchOpen(false)
    input.current?.blur()
  }
  const go = (id: number) => {
    useDiagram.getState().goToNode(id)
    close()
  }
  const open = focused && query.trim() !== ''

  return (
    <div className={styles.box} role="search">
      <input
        ref={input}
        type="search"
        className={styles.input}
        value={query}
        placeholder={t.search.placeholder}
        aria-label={t.search.label}
        role="combobox"
        aria-expanded={open}
        aria-controls="dg-search-list"
        aria-activedescendant={hits[active] ? `dg-hit-${hits[active]?.id}` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // A click on a result must land before the list disappears.
          window.setTimeout(() => {
            setFocused(false)
            useDiagram.getState().setSearchOpen(false)
          }, 120)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            const hit = hits[active]
            if (hit) go(hit.id)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            close()
          }
        }}
      />
      {open && (
        <ul
          id="dg-search-list"
          className={styles.list}
          role="listbox"
          aria-label={t.search.results}
        >
          {hits.length === 0 && <li className={styles.none}>{t.search.none}</li>}
          {hits.map((h, i) => {
            const n = byId.get(h.id)
            if (!n) return null
            return (
              <li
                key={h.id}
                id={`dg-hit-${h.id}`}
                role="option"
                aria-selected={i === active}
                className={`${styles.item} ${i === active ? styles.on : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  go(h.id)
                }}
              >
                <span className={styles.bar} style={{ background: `var(--dg-t-${n.type})` }} />
                <code>{n.code}</code>
                <span className={styles.title}>{n.title}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { useLayoutEffect, useRef, useState } from 'react'
import { CloseIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import type { PairModel } from './model'
import styles from './ChannelPopover.module.css'

const WIDTH = 300
const GAP = 12

/**
 * Lists every channel of a pair of blocks: via tag, direction as "mã nguồn → mã đích", label and
 * description (FR-LK-04). Sits in screen space next to the badge and closes on a click outside, on
 * Esc, or when the camera moves.
 */
export function ChannelPopover({ pair }: { pair: PairModel }) {
  const data = useDiagram((s) => s.data)
  const popover = useDiagram((s) => s.popover)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent
    if (!el || !parent || !popover) return
    const room = { w: parent.clientWidth, h: parent.clientHeight }
    const left = Math.max(8, Math.min(popover.x + GAP, room.w - WIDTH - 8))
    const top = Math.max(8, Math.min(popover.y + GAP, room.h - el.offsetHeight - 8))
    setPos({ left, top })
  }, [popover, pair.links.length])

  if (!data || !popover) return null
  const node = (id: number) => data.nodes.find((n) => n.id === id)
  const first = pair.links[0]
  const a = first ? node(first.fromNode) : undefined
  const b = first ? node(first.toNode) : undefined

  return (
    <div
      ref={ref}
      className={`${styles.pop} nopan nowheel`}
      role="dialog"
      aria-label={t.channel.popoverLabel}
      data-popover={pair.key}
      style={{ left: pos?.left ?? popover.x + GAP, top: pos?.top ?? popover.y + GAP, width: WIDTH }}
    >
      <div className={styles.head}>
        <span>
          {a?.title} ↔ {b?.title}
        </span>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t.channel.close}
          onClick={() => useDiagram.getState().closePopover()}
        >
          <CloseIcon size={14} />
        </button>
      </div>
      <ul className={styles.list}>
        {pair.links.map((l) => (
          <li key={l.id} className={styles.item} data-link={l.key}>
            <span className={styles.vtag}>
              <i style={{ background: `var(--dg-v-${l.via})` }} />
              {t.via[l.via]}
            </span>
            <div className={styles.text}>
              <div>
                {node(l.fromNode)?.code} {t.channel.arrow} {node(l.toNode)?.code}
                {l.label ? `: ${l.label}` : ''}
              </div>
              {l.note && <small>{l.note}</small>}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => {
                  const s = useDiagram.getState()
                  s.closePopover()
                  s.selectLink(l.id)
                }}
              >
                {t.channel.edit}
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`${t.channel.remove}: ${l.label || l.key}`}
                title={t.channel.remove}
                onClick={() => void useDiagram.getState().removeLinks([l.id])}
              >
                <TrashIcon size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { currentSub, type Ring, type RadialItem } from '../../../../shared/diagram/radialMenus'
import { diagramStrings as t } from '../strings'
import { RadialIcon } from './radialIcons'
import styles from './RadialMenu.module.css'

const R_IN = 46
const R_OUT = 124
const HALF = 21
const CENTRE = 130

const point = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [CENTRE + r * Math.cos(a), CENTRE + r * Math.sin(a)]
}

/** Path of one 42 degree slot between the inner and outer rim (TDD 8.4). */
function sector(a0: number, a1: number): string {
  const [x1, y1] = point(R_OUT, a0)
  const [x2, y2] = point(R_OUT, a1)
  const [x3, y3] = point(R_IN, a1)
  const [x4, y4] = point(R_IN, a0)
  return `M${x1} ${y1}A${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${R_IN} ${R_IN} 0 0 0 ${x4} ${y4}Z`
}

const toneColor = (tone: RadialItem['tone']): string =>
  tone === 'danger'
    ? 'var(--dg-t-fail)'
    : tone === 'neutral'
      ? 'var(--dg-edge-hi)'
      : tone === 'accent'
        ? 'var(--dg-accent)'
        : `var(--dg-t-${tone})`

export interface RadialMenuProps {
  ring: Ring
  /** Centre in pixels from the top left corner of the canvas. */
  centre: { x: number; y: number }
  hover: number
  /** The ring stays open until a click (quick tap). */
  sticky: boolean
  /** Sub-item chosen for each slot id. */
  subs: Readonly<Record<string, string>>
  isDisabled: (item: RadialItem, subId: string | null) => boolean
}

/** The ring itself: SVG 260 by 260, hover scales a slot to 1.07 and tints it with 28% of its colour. */
export function RadialMenu({ ring, centre, hover, sticky, subs, isDisabled }: RadialMenuProps) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const hovered = hover >= 0 ? ring[hover] : null
  const hoveredSub = hovered ? currentSub(hovered, subs[hovered.id]) : null

  return (
    <div
      className={`${styles.wheel} ${shown ? styles.on : ''}`}
      style={{ left: centre.x, top: centre.y }}
      role="menu"
      aria-label={t.radial.label}
      data-radial
    >
      <svg width={260} height={260} viewBox="0 0 260 260">
        {ring.map((item, i) => {
          const angle = -90 + i * 45
          const on = i === hover
          const [tx, ty] = point(86, angle)
          const sub = item ? currentSub(item, subs[item.id]) : null
          const dim = item ? isDisabled(item, sub?.id ?? null) || item.soon !== undefined : false
          const color = item ? toneColor(item.tone) : 'var(--dg-edge)'
          return (
            <g
              key={i}
              className={`${styles.slot} ${on && item ? styles.hover : ''}`}
              data-slot={i}
              data-item={item?.id}
              opacity={dim ? 0.35 : 1}
            >
              <path
                d={sector(angle - HALF, angle + HALF)}
                style={{
                  fill:
                    on && item
                      ? `color-mix(in srgb, ${color} 28%, var(--dg-panel-2))`
                      : 'var(--dg-panel-2)',
                  stroke: on && item ? color : 'var(--dg-edge)',
                  strokeWidth: on && item ? 1.5 : 0.5,
                  opacity: item ? 1 : 0.4
                }}
              />
              {item && (
                <>
                  <text
                    x={tx}
                    y={sub ? ty - 7 : ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: 12, fontWeight: 500, fill: 'var(--dg-ink)' }}
                  >
                    {item.label}
                  </text>
                  {sub && (
                    <text
                      x={tx}
                      y={ty + 9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontSize: 11, fill: 'var(--dg-ink-2)' }}
                    >
                      ‹ {sub.label} ›
                    </text>
                  )}
                </>
              )}
            </g>
          )
        })}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={42}
          style={{ fill: 'var(--dg-panel-2)', stroke: 'var(--dg-edge)', strokeWidth: 0.5 }}
        />
      </svg>
      <div className={styles.centre}>
        {hovered ? (
          <>
            <span style={{ color: toneColor(hovered.tone) }}>
              <RadialIcon name={hovered.icon} size={20} />
            </span>
            <b style={{ fontWeight: 500 }}>{hoveredSub?.label ?? hovered.label}</b>
            {hovered.soon && <span className={styles.soon}>{hovered.soon}</span>}
          </>
        ) : (
          <span className={styles.muted}>{sticky ? t.radial.clickToPick : t.radial.cancel}</span>
        )}
      </div>
    </div>
  )
}

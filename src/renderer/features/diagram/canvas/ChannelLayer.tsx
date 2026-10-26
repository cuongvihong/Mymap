import { useStore, ViewportPortal } from '@xyflow/react'
import { memo, useRef } from 'react'
import { viaSet } from '../../../../shared/diagram/channels'
import type { Connection } from '../../../../shared/diagram/geometry'
import { VIA_TYPES, type ChannelMode, type LinkData } from '../../../../shared/diagram/types'
import { useDiagram } from '../store/diagramStore'
import type { PairModel } from './model'
import styles from './ChannelLayer.module.css'

/** Below this zoom the labels would only be noise. */
const LABEL_MIN_ZOOM = 0.4
const BADGE_MAX_SCALE = 2.4
const GRIP_RADIUS = 6

const viaColor = (via: LinkData['via']) => `var(--dg-v-${via})`
const dashOf = (via: LinkData['via']): string | undefined =>
  via === 'db' ? '6 4' : via === 'impl' ? '2 4' : undefined

function Markers() {
  const items: { id: string; color: string }[] = [
    { id: 'edge', color: 'var(--dg-edge)' },
    { id: 'hi', color: 'var(--dg-edge-hi)' },
    { id: 'sel', color: 'var(--dg-accent)' },
    ...VIA_TYPES.map((v) => ({ id: v, color: viaColor(v) }))
  ]
  return (
    <defs>
      {items.map((m) => (
        <marker
          key={m.id}
          id={`dgm-${m.id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" style={{ fill: m.color }} />
        </marker>
      ))}
    </defs>
  )
}

export interface ChannelLayerProps {
  pairs: readonly PairModel[]
  mode: ChannelMode
  onOpenPair: (pair: PairModel, mid: readonly [number, number]) => void
  onGripDown: (event: React.PointerEvent, link: LinkData, end: 'from' | 'to') => void
}

function Badge({ pair, scale, onOpen }: { pair: PairModel; scale: number; onOpen: () => void }) {
  const vias = viaSet(pair.links)
  const width = 24 + vias.length * 8
  const [mx, my] = pair.base.mid
  return (
    <g
      className={`${styles.badge} nopan nodrag`}
      data-badge={pair.key}
      data-count={pair.links.length}
      transform={`translate(${mx} ${my}) scale(${scale})`}
      opacity={pair.display === 'dim' ? 0.3 : 1}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      onPointerEnter={() => useDiagram.getState().setHoverPair(pair.key)}
      onPointerLeave={() => useDiagram.getState().setHoverPair(null)}
    >
      <rect x={-width / 2} y={-10} width={width} height={20} rx={10} className={styles.badgeBox} />
      <text x={-vias.length * 4 - 2} y={4} textAnchor="middle" className={styles.badgeText}>
        {pair.links.length}
      </text>
      {vias.map((v, i) => (
        <circle
          key={v}
          cx={i * 8 + 6 - vias.length * 4 + 4}
          cy={0}
          r={3}
          style={{ fill: viaColor(v) }}
        />
      ))}
    </g>
  )
}

function Wires({
  pair,
  showLabels,
  selectedId
}: {
  pair: PairModel
  showLabels: boolean
  selectedId: number | null
}) {
  const dim = pair.display === 'dim'
  return (
    <g className={dim ? styles.dim : undefined} data-pair={pair.key} data-wires="many">
      {pair.wires.map(({ link, conn }) => (
        <g key={link.id}>
          <path
            d={conn.d}
            className={`${styles.wire} ${selectedId === link.id ? styles.wireSelected : ''}`}
            data-link={link.key}
            data-via={link.via}
            style={{ stroke: viaColor(link.via) }}
            strokeDasharray={dashOf(link.via)}
            markerEnd={`url(#dgm-${link.via})`}
          />
          {showLabels && !dim && link.label && (
            <text
              x={conn.mid[0]}
              y={conn.mid[1] - 5}
              textAnchor="middle"
              className={styles.label}
              style={{ fill: viaColor(link.via) }}
            >
              {link.label}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

/**
 * Channels, one drawing per pair of blocks (TDD 8.3). One-wire mode merges a pair into a neutral
 * wire with a badge and expands it while the pointer is over it; many-wire mode draws every channel
 * side by side in its via colour. Hit areas are separate transparent paths, so hovering never swaps
 * the element under the pointer and cannot flicker.
 */
function ChannelsView({ pairs, mode, onOpenPair, onGripDown }: ChannelLayerProps) {
  const zoom = useStore((s) => s.transform[2])
  const hoverPair = useDiagram((s) => s.hoverPair)
  const selectedId = useDiagram((s) => s.detailLinkId)
  const reconnect = useDiagram((s) => s.reconnect)
  const pairView = useDiagram((s) => s.pairView)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showLabels = zoom >= LABEL_MIN_ZOOM
  const badgeScale = Math.min(BADGE_MAX_SCALE, Math.max(1, 1 / zoom))

  const selected =
    selectedId !== null
      ? pairs.flatMap((p) => p.wires).find((w) => w.link.id === selectedId)
      : undefined

  const enter = (key: string) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = null
    useDiagram.getState().setHoverPair(key)
  }
  const leave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => useDiagram.getState().setHoverPair(null), 90)
  }

  /** Pairs the user split or merged by hand override the global mode. */
  const modeOf = (key: string): ChannelMode =>
    pairView[key] === 'split' ? 'many' : pairView[key] === 'merge' ? 'one' : mode

  const fixedPoint = (conn: Connection, end: 'from' | 'to') => (end === 'to' ? conn.p1 : conn.p2)

  return (
    <>
      <svg className={styles.svg} width={1} height={1} aria-hidden>
        <Markers />

        {/* Drawing */}
        {pairs.map((pair) => {
          const expanded = modeOf(pair.key) === 'many' || hoverPair === pair.key
          if (expanded) {
            return (
              <Wires key={pair.key} pair={pair} showLabels={showLabels} selectedId={selectedId} />
            )
          }
          const lit = pair.display === 'lit'
          const dim = pair.display === 'dim'
          return (
            <path
              key={pair.key}
              d={pair.base.d}
              data-pair={pair.key}
              data-display={pair.display}
              data-wires="one"
              className={`${styles.wire} ${styles.base} ${lit ? styles.baseLit : ''} ${dim ? styles.dim : ''}`}
              markerEnd={`url(#dgm-${lit ? 'hi' : 'edge'})`}
              markerStart={pair.bothWays ? `url(#dgm-${lit ? 'hi' : 'edge'})` : undefined}
            />
          )
        })}

        {/* Hit areas */}
        {pairs.flatMap((pair) =>
          modeOf(pair.key) === 'one'
            ? [
                <path
                  key={`h-${pair.key}`}
                  d={pair.base.d}
                  className={`${styles.hit} nopan nodrag`}
                  data-hit={pair.key}
                  onPointerEnter={() => enter(pair.key)}
                  onPointerLeave={leave}
                  onClick={() => onOpenPair(pair, pair.base.mid)}
                />
              ]
            : pair.wires.map(({ link, conn }) => (
                <path
                  key={`h-${link.id}`}
                  d={conn.d}
                  className={`${styles.hit} nopan nodrag`}
                  data-hit-link={link.key}
                  onClick={() => useDiagram.getState().selectLink(link.id)}
                />
              ))
        )}

        {/* Badges */}
        {pairs
          .filter((p) => modeOf(p.key) === 'one' && hoverPair !== p.key)
          .map((pair) => (
            <Badge
              key={`b-${pair.key}`}
              pair={pair}
              scale={badgeScale}
              onOpen={() => onOpenPair(pair, pair.base.mid)}
            />
          ))}
      </svg>
      {/* Above the blocks: the ends of a channel touch block borders, so the grips must not sit under them. */}
      <svg className={styles.svgTop} width={1} height={1} aria-hidden>
        {selected && (
          <g>
            <path
              d={selected.conn.d}
              className={styles.selectedWire}
              markerEnd="url(#dgm-sel)"
              data-selected={selected.link.key}
            />
            {(['from', 'to'] as const).map((end) => {
              const [x, y] = end === 'from' ? selected.conn.p1 : selected.conn.p2
              return (
                <circle
                  key={end}
                  cx={x}
                  cy={y}
                  r={GRIP_RADIUS / Math.max(0.5, Math.min(zoom, 1))}
                  className={`${styles.grip} nopan nodrag`}
                  data-grip={end}
                  onPointerDown={(e) => onGripDown(e, selected.link, end)}
                />
              )
            })}
          </g>
        )}
        {reconnect && selected && selected.link.id === reconnect.linkId && (
          <line
            x1={fixedPoint(selected.conn, reconnect.end)[0]}
            y1={fixedPoint(selected.conn, reconnect.end)[1]}
            x2={reconnect.x}
            y2={reconnect.y}
            className={styles.reconnectLine}
          />
        )}
      </svg>
    </>
  )
}

export const ChannelLayer = memo(function ChannelLayer(props: ChannelLayerProps) {
  return (
    <ViewportPortal>
      <ChannelsView {...props} />
    </ViewportPortal>
  )
})

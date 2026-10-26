import { useStore, ViewportPortal } from '@xyflow/react'
import { memo, useEffect, useRef } from 'react'
import { easeInOutQuad } from '../../../../shared/diagram/player'
import { SCENARIO_TYPES } from '../../../../shared/diagram/types'
import { playProgress } from '../store/scenarioSlice'
import { useDiagram } from '../store/diagramStore'
import type { ScenarioLine } from './scenarioLines'
import styles from './ScenarioLayer.module.css'

const color = (type: string) => `var(--dg-s-${type})`

function Markers() {
  return (
    <defs>
      {SCENARIO_TYPES.map((type) => (
        <marker
          key={type}
          id={`dgs-${type}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" style={{ fill: color(type) }} />
        </marker>
      ))}
    </defs>
  )
}

/**
 * The dot of Play: 7 px with a white rim, running along the hop between two blocks. The progress
 * comes from the player on every animation frame, so pausing freezes it (FR-KB-06).
 */
function PlayDot({ d, type }: { d: string; type: string }) {
  const path = useRef<SVGPathElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const zoom = useStore((s) => s.transform[2])
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const p = path.current
      const c = dot.current
      if (p && c) {
        const at = p.getPointAtLength(p.getTotalLength() * easeInOutQuad(playProgress()))
        c.setAttribute('cx', String(at.x))
        c.setAttribute('cy', String(at.y))
        c.style.visibility = 'visible'
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [d])
  return (
    <>
      <path ref={path} d={d} fill="none" stroke="none" />
      <circle
        ref={dot}
        r={3.5 / zoom}
        className={styles.dot}
        style={{ fill: color(type), visibility: 'hidden' }}
        data-play-dot
      />
    </>
  )
}

export interface ScenarioLayerProps {
  lines: readonly ScenarioLine[]
  /** Hop the Play dot is on, as path data, with the type of the playing scenario. */
  dot: { d: string; type: string } | null
}

function LinesView({ lines, dot }: ScenarioLayerProps) {
  const hasPlay = useDiagram((s) => s.play !== null)
  return (
    <svg className={styles.svg} width={1} height={1} aria-hidden>
      <Markers />
      {lines.map((line) => (
        <g key={line.key} data-scenario-line={line.key} data-type={line.type}>
          {line.hops.map((d, i) => (
            <path
              key={i}
              d={d}
              className={`${styles.line} ${line.key === 'draft' ? styles.draft : ''}`}
              style={{ stroke: color(line.type) }}
              markerEnd={`url(#dgs-${line.type})`}
            />
          ))}
        </g>
      ))}
      {hasPlay && dot && <PlayDot key={dot.d} d={dot.d} type={dot.type} />}
    </svg>
  )
}

/** Paths of scenarios, above the channels and below the blocks. */
export const ScenarioLayer = memo(function ScenarioLayer(props: ScenarioLayerProps) {
  return (
    <ViewportPortal>
      <LinesView {...props} />
    </ViewportPortal>
  )
})

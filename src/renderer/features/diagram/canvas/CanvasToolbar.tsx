import { useReactFlow } from '@xyflow/react'
import {
  CloseIcon,
  CollapseAllIcon,
  FitIcon,
  LayoutIcon,
  MapIcon,
  MinusIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon
} from '../icons'
import { layoutScope } from '../data/layoutScope'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import styles from './CanvasToolbar.module.css'

export function CanvasToolbar({ highlighted }: { highlighted: boolean }) {
  const rf = useReactFlow()
  const minimap = useDiagram((s) => s.minimap)
  const anyOpen = useDiagram((s) => s.data?.nodes.some((n) => !n.collapsed) ?? false)
  const undoLabel = useDiagram((s) => s.undoLabel)
  const redoLabel = useDiagram((s) => s.redoLabel)
  const layoutBusy = useDiagram((s) => s.layoutBusy)
  const act = useDiagram.getState

  return (
    <div className={styles.bar} role="toolbar" aria-label={t.canvas.toolbar}>
      <button
        type="button"
        title={t.canvas.zoomIn}
        aria-label={t.canvas.zoomIn}
        onClick={() => void rf.zoomIn({ duration: 150 })}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        title={t.canvas.zoomOut}
        aria-label={t.canvas.zoomOut}
        onClick={() => void rf.zoomOut({ duration: 150 })}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        title={t.canvas.fit}
        aria-label={t.canvas.fit}
        onClick={() => act().requestFit()}
      >
        <FitIcon />
      </button>
      <button
        type="button"
        title={t.data.layoutButton}
        aria-label={t.data.layoutButton}
        data-layout-button
        disabled={layoutBusy}
        onClick={() => void act().autoLayout(layoutScope())}
      >
        <LayoutIcon />
      </button>
      <button
        type="button"
        title={t.canvas.minimap}
        aria-label={t.canvas.minimap}
        aria-pressed={minimap}
        onClick={() => act().toggleMinimap()}
      >
        <MapIcon />
      </button>
      <button
        type="button"
        title={anyOpen ? t.canvas.collapseAll : t.canvas.expandAll}
        aria-label={anyOpen ? t.canvas.collapseAll : t.canvas.expandAll}
        onClick={() => void act().collapseAll()}
      >
        <CollapseAllIcon />
      </button>
      <button
        type="button"
        className={styles.undo}
        title={undoLabel ? `${t.history.undo}: ${undoLabel} (Ctrl+Z)` : t.history.nothing}
        aria-label={t.history.undo}
        disabled={!undoLabel}
        onClick={() => void act().undo()}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        title={redoLabel ? `${t.history.redo}: ${redoLabel} (Ctrl+Y)` : t.history.redo}
        aria-label={t.history.redo}
        disabled={!redoLabel}
        onClick={() => void act().redo()}
      >
        <RedoIcon />
      </button>
      {highlighted && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => act().clearHighlight()}
          title={t.canvas.clearHighlight}
        >
          <CloseIcon size={12} />
          <span>{t.canvas.clearHighlight}</span>
        </button>
      )}
    </div>
  )
}

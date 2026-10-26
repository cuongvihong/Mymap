import type { LayoutScope } from '../../../../shared/diagram/layoutPlan'
import { useDiagram } from '../store/diagramStore'

/** The L key and the toolbar button: the chosen blocks when several are chosen, else the whole map. */
export function layoutScope(): LayoutScope {
  const { selected } = useDiagram.getState()
  return selected.length > 1 ? { kind: 'selection', ids: selected } : { kind: 'all' }
}

import type { Database } from 'better-sqlite3'
import { dataScenarios } from '../../../shared/diagram/flowmap'
import type { ScenarioNode } from '../../../shared/diagram/scenario'
import * as scenarios from '../repo/scenarios'

/** The scenarios of a project with database ids, in the shape the pure functions use. */
export function scenarioNodes(db: Database, projectId: number): ScenarioNode[] {
  return dataScenarios({
    scenarios: scenarios.listScenarios(db, projectId),
    steps: scenarios.listSteps(db, projectId)
  })
}

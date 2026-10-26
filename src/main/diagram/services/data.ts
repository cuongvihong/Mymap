import type { Database } from 'better-sqlite3'
import { parseSettings, validateViewport } from '../../../shared/diagram/settings'
import type { ProjectData, Viewport } from '../../../shared/diagram/types'
import * as groups from '../repo/groups'
import * as images from '../repo/images'
import * as links from '../repo/links'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import * as scenarios from '../repo/scenarios'

function readViewport(json: string | null): Viewport | null {
  if (!json) return null
  try {
    const parsed: unknown = JSON.parse(json)
    return validateViewport(parsed) ? (parsed as Viewport) : null
  } catch {
    return null
  }
}

/** Everything of one project in a single read (project.load, TDD 10). */
export function loadProjectData(db: Database, record: projects.ProjectRecord): ProjectData {
  return {
    project: projects.toInfo(record),
    groups: groups.listGroups(db, record.id),
    nodes: nodes.listNodes(db, record.id),
    images: images.listImages(db, record.id),
    pins: images.listPins(db, record.id),
    links: links.listLinks(db, record.id),
    scenarios: scenarios.listScenarios(db, record.id),
    steps: scenarios.listSteps(db, record.id),
    viewport: readViewport(record.viewportJson),
    settings: parseSettings(record.settingsJson)
  }
}

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as projects from './repo/projects'
import type { DiagramContext } from './context'
import { createProjectService } from './services/project'
import { createYamlService } from './services/yaml'
import { slugify } from '../../shared/diagram/normalize'

/** Name of the project that the dev seed creates. */
export const SEED_PROJECT_NAME = 'MOE Education Account'

/** Where the sample can be found when the app runs from the source tree. */
export function findSampleFile(cwd: string): string | null {
  const candidates = [
    join(cwd, 'docs', 'samples', 'moe-ea.flowmap.yaml'),
    join(cwd, 'tests', 'fixtures', 'moe-ea.flowmap.yaml')
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/**
 * Dev only (MAPAPP_SEED=1): creates the project "MOE Education Account" from the sample file when
 * no project of that name exists. Returns the project id, or null when nothing was done.
 */
export function seedSampleProject(ctx: DiagramContext, sampleFile: string): number | null {
  const exists = projects
    .listProjects(ctx.db)
    .some((p) => slugify(p.name) === slugify(SEED_PROJECT_NAME))
  if (exists) return null
  const text = readFileSync(sampleFile, 'utf8')
  const project = createProjectService(ctx).create(SEED_PROJECT_NAME)
  createYamlService(ctx).apply(project.id, text, { removeMissing: false })
  ctx.logger.info('sample project seeded', { id: project.id })
  return project.id
}

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Sub folders of a Kho (TDD 4). `app/` belongs to the portable build and is not created here. */
export const KHO_SUBDIRS = ['data', 'du-an', 'backup', 'xuat', 'thung-rac'] as const

export interface KhoPaths {
  root: string
  db: string
  data: string
  projects: string
  backup: string
  export: string
  trash: string
}

export function khoPaths(root: string): KhoPaths {
  return {
    root,
    db: join(root, 'data', 'mapapp.db'),
    data: join(root, 'data'),
    projects: join(root, 'du-an'),
    backup: join(root, 'backup'),
    export: join(root, 'xuat'),
    trash: join(root, 'thung-rac')
  }
}

/** A folder is a Kho when it has data/mapapp.db (TDD 4). */
export function isKho(root: string, exists: (p: string) => boolean = existsSync): boolean {
  return exists(khoPaths(root).db)
}

import init from './001_init.sql?raw'
import groupFrame from './002_group_frame.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** Ordered list. Never edit a file that has shipped, add a new NNN_name.sql instead (MASTER 4.7). */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'init', sql: init },
  { version: 2, name: 'group_frame', sql: groupFrame }
]

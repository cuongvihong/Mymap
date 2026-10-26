import Database from 'better-sqlite3'

/** Open the Kho database with the three pragmas of TDD 5.1. Does not touch PRAGMA user_version. */
export function openDatabase(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('journal_mode = DELETE')
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  return db
}

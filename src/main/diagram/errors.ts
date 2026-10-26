import type { DiagramErrorCode, IpcFailure } from '../../shared/diagram/types'

/** Error with a stable code. Services throw it, ipc.ts turns it into `{ ok: false, code, message }`. */
export class DiagramError extends Error {
  readonly code: DiagramErrorCode

  constructor(code: DiagramErrorCode, message: string) {
    super(message)
    this.name = 'DiagramError'
    this.code = code
  }
}

export function toFailure(error: unknown): IpcFailure {
  if (error instanceof DiagramError) return { ok: false, code: error.code, message: error.message }
  return { ok: false, code: 'INTERNAL', message: 'Unexpected error' }
}

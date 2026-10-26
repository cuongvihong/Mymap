import type { IpcFailure } from '../../../shared/diagram/types'
import type { KhoErrorCode } from '../../../shared/api'
import { DiagramError } from '../../diagram/errors'

export class KhoError extends Error {
  readonly code: KhoErrorCode

  constructor(code: KhoErrorCode, message: string) {
    super(message)
    this.name = 'KhoError'
    this.code = code
  }
}

export function toShellFailure(error: unknown): IpcFailure {
  if (error instanceof KhoError || error instanceof DiagramError) {
    return { ok: false, code: error.code, message: error.message }
  }
  return { ok: false, code: 'INTERNAL', message: 'Unexpected error' }
}

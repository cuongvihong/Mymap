import type { IpcResult } from '../../shared/diagram/types'
import { shellStrings } from './strings'

/** Vietnamese text for an error code. Unknown codes get the generic message. */
export function errorText(code: string): string {
  return shellStrings.errors[code] ?? shellStrings.errors['fallback'] ?? ''
}

export class IpcError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'IpcError'
    this.code = code
  }
}

/** Return the data of a successful result, or throw an IpcError with the code. */
export function unwrap<T>(result: IpcResult<T>): T {
  if (result.ok) return result.data
  throw new IpcError(result.code)
}

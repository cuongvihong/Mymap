/** Number of steps kept for undo (TDD 8.8). FR-SUA-05 asks for at least 100. */
export const HISTORY_LIMIT = 200

/**
 * Two stacks of commands. The stack never runs a command itself: the caller reads `peekUndo`,
 * runs it, and only calls `undone` when it worked, so a failed call leaves the history intact.
 */
export class History<C> {
  private past: C[] = []
  private future: C[] = []

  constructor(private readonly limit: number = HISTORY_LIMIT) {}

  /** A new action clears everything that could be redone. */
  push(command: C): void {
    this.past.push(command)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  peekUndo(): C | undefined {
    return this.past[this.past.length - 1]
  }

  peekRedo(): C | undefined {
    return this.future[this.future.length - 1]
  }

  /** The command at the top of the undo stack was undone. */
  undone(): void {
    const c = this.past.pop()
    if (c !== undefined) this.future.push(c)
  }

  /** The command at the top of the redo stack was redone. */
  redone(): void {
    const c = this.future.pop()
    if (c !== undefined) this.past.push(c)
  }

  clear(): void {
    this.past = []
    this.future = []
  }

  get undoCount(): number {
    return this.past.length
  }

  get redoCount(): number {
    return this.future.length
  }
}

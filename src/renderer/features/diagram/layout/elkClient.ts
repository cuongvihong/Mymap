import ELK from 'elkjs/lib/elk-api.js'
import type { ElkLike, ElkNode } from '../../../../shared/diagram/autolayout'

/**
 * The engine the page uses: ELK with a Web Worker created on the first layout and kept for the
 * next ones. It has the same `layout(graph)` as ELK, so the planning code does not know the difference.
 */
export function createElkClient(): ElkLike & { dispose(): void } {
  let elk: InstanceType<typeof ELK> | null = null
  const start = () =>
    new ELK({
      workerFactory: () =>
        new Worker(new URL('./elk.worker.ts', import.meta.url), { type: 'module' })
    })
  return {
    layout(graph: ElkNode) {
      elk ??= start()
      return elk.layout(graph as never) as unknown as Promise<ElkNode>
    },
    dispose() {
      elk?.terminateWorker()
      elk = null
    }
  }
}

let shared: ReturnType<typeof createElkClient> | null = null

/** One client for the whole page. */
export function elkEngine(): ElkLike {
  shared ??= createElkClient()
  return shared
}

/**
 * Starts the worker and runs a graph of two blocks, so that loading the 2.7 MB script and the
 * first run of the engine are not paid by the layout the user is waiting for (NFR-04).
 * Safe to call many times, it runs once.
 */
let warmed: Promise<unknown> | null = null
export function warmElk(): void {
  warmed ??= elkEngine()
    .layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' },
      children: [
        { id: 'a', width: 40, height: 30 },
        { id: 'b', width: 40, height: 30 }
      ],
      edges: [{ id: 'e', sources: ['a'], targets: ['b'] }]
    })
    .catch(() => {
      // A failed warm up only means the first layout is slower. The real one reports its own error.
      warmed = null
    })
}

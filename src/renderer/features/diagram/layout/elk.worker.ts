/**
 * Runs ELK off the main thread (TDD 8.7). The worker script of elkjs installs its own message
 * handler when it is loaded inside a Web Worker, so importing it is all this file does.
 * `elkClient.ts` talks to it through the ELK API (`elk-api.js`).
 */
import 'elkjs/lib/elk-worker.min.js'

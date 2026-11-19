/**
 * The worker entry point (TOOLING.md §2.2).
 *
 * Binding only. Everything it does lives in `evaluate.ts`, which has no
 * globals and so can be tested without a worker.
 */

import { evaluate } from './evaluate.js';
import type { RunReply, RunRequest } from './evaluate.js';

/**
 * The part of the worker global this file uses.
 *
 * TypeScript cannot load the DOM and WebWorker libraries together — they
 * define overlapping globals — and the rest of the playground needs the DOM
 * one. Naming the two members used here is cheaper than fighting that.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: RunReply) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<RunRequest>): void => {
  scope.postMessage(evaluate(event.data));
};

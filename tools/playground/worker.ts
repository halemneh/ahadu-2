/**
 * The worker entry point (TOOLING.md §2.2).
 *
 * Binding only. Everything it does lives in `session.ts`, which has no
 * globals and so can be tested without a worker.
 */

import { runSession } from './session.js';
import type { SessionReply, SessionRequest } from './session.js';

/**
 * The part of the worker global this file uses.
 *
 * TypeScript cannot load the DOM and WebWorker libraries together — they
 * define overlapping globals — and the rest of the playground needs the DOM
 * one. Naming the two members used here is cheaper than fighting that.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<SessionRequest>) => void) | null;
  postMessage: (message: SessionReply) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<SessionRequest>): void => {
  scope.postMessage(runSession(event.data));
};

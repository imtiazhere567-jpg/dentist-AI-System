import { ensureDb, flushDb } from "./db";

/** Wrap a route handler: hydrate the DB before it runs, persist queued writes before it returns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDb<T extends (...args: any[]) => Promise<Response>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    await ensureDb();
    try {
      return await handler(...args);
    } finally {
      await flushDb();
    }
  }) as T;
}

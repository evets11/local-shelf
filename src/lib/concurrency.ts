// Shared by the live client, the sync and the enrich scripts.

/** Our own limits (slot queue, time budget, missing BRN), not a sign an upstream is unwell. */
export class LocalLimitError extends Error {}

/** Counting semaphore. A released slot is handed straight to the next waiter, so it can't be stolen. */
export class Limiter {
  private active = 0;
  private waiters: (() => void)[] = [];
  constructor(private readonly max: number) {}

  /** Take a slot. With a deadline, give up (and leave the queue) once it passes. */
  async take(deadline?: number): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer =
        deadline === undefined
          ? undefined
          : setTimeout(
              () => {
                this.waiters.splice(this.waiters.indexOf(waiter), 1);
                reject(
                  new LocalLimitError("Timed out waiting for a request slot"),
                );
              },
              Math.max(0, deadline - Date.now()),
            );
      this.waiters.push(waiter);
    });
  }

  release() {
    const next = this.waiters.shift();
    if (next) next();
    else this.active--;
  }
}

/** Run fn over items with at most n in flight. */
export async function pool<T>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

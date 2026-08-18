/**
 * Bounded-concurrency map.
 *
 * The original fill walked the tree depth-first with `await` inside a for-loop,
 * so a 65-node topic was 65 serial round trips. The only real dependency is
 * parent -> child: siblings are independent once the parent's text exists. This
 * lets each level fan out while still respecting provider rate limits.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const width = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: width }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Like mapPool, but a failure on one item doesn't abort the rest — it resolves
 * to an error entry. A single bad node should not cost you the other sixty-four.
 */
export type Settled<R> = { ok: true; value: R } | { ok: false; error: Error };

export async function mapPoolSettled<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Settled<R>[]> {
  return mapPool(items, limit, async (item, index) => {
    try {
      return { ok: true as const, value: await fn(item, index) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err : new Error(String(err)) };
    }
  });
}

/** Default fan-out width. Override with KBFORGE_CONCURRENCY. */
export function defaultConcurrency(): number {
  const raw = Number(process.env.KBFORGE_CONCURRENCY);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6;
}

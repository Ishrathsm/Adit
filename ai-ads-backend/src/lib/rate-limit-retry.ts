// Nano Banana and Veo on this project 429 (RESOURCE_EXHAUSTED) after a handful of calls — it was
// the single biggest cause of failed storyboard shots. Quota refills within a minute or so, so a
// few spaced retries turn most of those failures into a short wait.
const DELAYS_MS = [20_000, 45_000, 90_000];

function isRateLimited(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string } | null;
  return e?.status === 429 || e?.code === 429 || /RESOURCE_EXHAUSTED|\b429\b/.test(e?.message ?? String(err));
}

export async function withRateLimitRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err) || attempt >= DELAYS_MS.length) throw err;
      console.warn(`[${label}] rate limited, retrying in ${DELAYS_MS[attempt] / 1000}s (attempt ${attempt + 1}/${DELAYS_MS.length})`);
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
    }
  }
}

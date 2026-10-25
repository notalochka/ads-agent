import { TimeoutError } from "./errors.js";

export { TimeoutError };

/**
 * Race a promise against a timeout. Does not cancel the underlying work,
 * but ensures the caller fails fast with TimeoutError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new TimeoutError(`${label} timed out after ${timeoutMs}ms`, {
          timeoutMs,
          label,
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function resolveRequestTimeoutMs(fallback = 120_000): number {
  const raw = process.env.AGENT_REQUEST_TIMEOUT_MS;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

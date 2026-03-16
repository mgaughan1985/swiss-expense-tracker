// lib/withRetry.ts
// Wraps async operations with retry logic and basic network detection.
// Designed for Supabase calls in a mobile environment with patchy connectivity.
//
// Usage:
//   const result = await withRetry(() => supabase.from('receipts').insert(data));
//
// Bulk usage (e.g. saving multiple receipts):
//   const { succeeded, failed } = await withRetryBulk(receipts, r => saveReceipt(r));

import NetInfo from '@react-native-community/netinfo';

// ─── Single operation with retry ─────────────────────────────────────────────

interface RetryOptions {
  attempts?: number;       // Total attempts (default: 3)
  delayMs?: number;        // Initial delay in ms (default: 800)
  backoff?: number;        // Multiplier per retry (default: 1.5)
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, delayMs = 800, backoff = 1.5 } = options;
  let lastError: unknown;
  let delay = delayMs;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(delay);
        delay = Math.round(delay * backoff);
      }
    }
  }

  throw lastError;
}

// ─── Bulk operations with partial success handling ────────────────────────────
// Returns succeeded and failed items separately rather than failing everything.
// Suitable for bulk receipt saves where partial success is acceptable.

interface BulkResult<T> {
  succeeded: T[];
  failed: T[];
  errors: unknown[];
}

export async function withRetryBulk<T>(
  items: T[],
  operation: (item: T) => Promise<unknown>,
  options: RetryOptions = {}
): Promise<BulkResult<T>> {
  const succeeded: T[] = [];
  const failed: T[] = [];
  const errors: unknown[] = [];

  await Promise.all(
    items.map(async (item) => {
      try {
        await withRetry(() => operation(item), options);
        succeeded.push(item);
      } catch (error) {
        failed.push(item);
        errors.push(error);
      }
    })
  );

  return { succeeded, failed, errors };
}

// ─── Network check ────────────────────────────────────────────────────────────
// Call before bulk operations to give the user early feedback.

export async function isConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// ─── User-facing error messages ───────────────────────────────────────────────
// Converts raw errors into plain English for the ErrorBanner component.
// Extend this as new error types are encountered in production.

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('network') || message.includes('fetch') || message.includes('Network')) {
    return 'Connection lost. Check your signal and try again.';
  }
  if (message.includes('timeout')) {
    return 'Request timed out. Try again when you have a stronger connection.';
  }
  if (message.includes('storage') || message.includes('upload')) {
    return 'Receipt image could not be uploaded. The expense was saved without the image.';
  }
  if (message.includes('auth') || message.includes('JWT') || message.includes('session')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'This record already exists.';
  }

  return 'Something went wrong. Please try again.';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
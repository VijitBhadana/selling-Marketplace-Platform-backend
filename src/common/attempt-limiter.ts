import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Caps attempts per key (an email) inside a time window, so a password or a 6-digit OTP
 * can't be guessed by trying again and again. Kept in memory: no new dependency or table.
 * With several backend instances each one counts on its own, which still caps guessing
 * at a handful of tries per window.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Counts one attempt, or throws 429 once the key has used up its window. Synchronous on
   * purpose: called before any await, so parallel requests can't all slip past the check.
   */
  attempt(key: string, tooMany: (minutesLeft: number) => string): number {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + this.windowMs };
    if (entry.count >= this.maxAttempts) {
      throw new HttpException(tooMany(Math.max(1, Math.ceil((entry.resetAt - now) / 60_000))), HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
    this.hits.set(key, entry);
    if (this.hits.size > 10_000) this.sweep(now);
    return entry.count;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

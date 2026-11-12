import { createHash } from 'crypto';

/**
 * A short fingerprint of the account's current password hash, carried in every JWT as
 * `pwv`. bcrypt salts each hash, so any password change gives a new fingerprint and every
 * token issued before it stops working — no extra column needed. Only a truncated SHA-256
 * of the bcrypt hash goes into the (client-readable) token, never the hash itself.
 */
export function passwordVersion(passwordHash: string) {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);
}

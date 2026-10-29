/**
 * Reads a security-sensitive setting (a secret or a privileged credential).
 *
 * In production a missing or blank value is fatal: the app refuses to boot rather than
 * fall back to a public, guessable default (e.g. a known JWT secret or admin password).
 * In development the fallback is used, but a loud warning is logged — so the weak default
 * can never slip into production unnoticed.
 */
export function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[security] ${name} must be set in production — refusing to start with an insecure default.`);
  }
  // eslint-disable-next-line no-console
  console.warn(`[security] ${name} is not set — using an INSECURE development default. Never run production like this.`);
  return devFallback;
}

export const isProduction = () => process.env.NODE_ENV === 'production';

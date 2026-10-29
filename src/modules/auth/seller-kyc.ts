import { createHmac } from 'crypto';
import { requireSecret } from '../../common/env';

// Level-1 (offline) checks for the seller sign-up KYC fields. These catch typos and
// made-up numbers whose checksum doesn't add up — they do NOT prove the number is
// issued to this person (that needs a paid Aadhaar-OTP / GSTN lookup API).

// Verhoeff tables — Aadhaar's 12th digit is a Verhoeff check digit over the first 11.
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function normalizeAadhaar(value: string) {
  return value.replace(/[\s-]/g, '');
}

/** 12 digits, can't start with 0 or 1, and the last digit must be the Verhoeff check digit. */
export function isValidAadhaar(value: string) {
  const digits = normalizeAadhaar(value);
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let c = 0;
  digits
    .split('')
    .reverse()
    .forEach((ch, i) => {
      c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(ch)]];
    });
  return c === 0;
}

// Aadhaar numbers must not be stored in plain text, so uniqueness is enforced on a keyed
// hash instead. Keep AADHAAR_HASH_SECRET fixed once set — changing it breaks the
// duplicate check against existing sellers.
export function hashAadhaar(value: string) {
  // Falls back to JWT_SECRET, which in production must be a real secret (requireSecret
  // throws there otherwise) — so Aadhaar hashes are never keyed with a public default.
  const secret = process.env.AADHAAR_HASH_SECRET ?? requireSecret('JWT_SECRET', 'dev-secret');
  return createHmac('sha256', secret).update(normalizeAadhaar(value)).digest('hex');
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// 01–38 are states/UTs; 97 = Other Territory, 99 = Centre Jurisdiction.
const GSTIN_STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
]);

export function normalizeGstin(value: string) {
  return value.replace(/\s/g, '').toUpperCase();
}

/** State code + PAN + entity no. + 'Z' + mod-36 check character. */
export function isValidGstin(value: string) {
  const gstin = normalizeGstin(value);
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  if (!GSTIN_STATE_CODES.has(gstin.slice(0, 2))) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
}

// PAN: 5 letters + 4 digits + 1 letter. There is no public checksum, but the 4th letter
// is the holder type (P = person, C = company, F = firm, H = HUF, ...) and for a person
// the 5th is their surname's initial — enough to reject most made-up numbers.
const PAN_HOLDER_TYPES = new Set(['A', 'B', 'C', 'F', 'G', 'H', 'J', 'L', 'P', 'T']);

export function normalizePan(value: string) {
  return value.replace(/\s/g, '').toUpperCase();
}

export function isValidPan(value: string) {
  const pan = normalizePan(value);
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) && PAN_HOLDER_TYPES.has(pan[3]) && pan.slice(5, 9) !== '0000';
}

/** For a personal PAN, some word of the name must start with its 5th letter (name order varies). */
export function panMatchesName(value: string, name: string) {
  const pan = normalizePan(value);
  const words = name.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  return pan[3] !== 'P' || words.length < 2 || words.some((w) => w[0] === pan[4]);
}

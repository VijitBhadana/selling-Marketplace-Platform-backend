// Offline checks for the delivery partner sign-up papers (the Aadhaar number itself is
// checked by seller-kyc.ts). Like the seller checks, these catch typos and junk — they
// don't prove the licence is real; the admin can open both photos from the user details.

export const VEHICLE_TYPES = ['BIKE', 'SCOOTER', 'BICYCLE', 'E_RICKSHAW', 'AUTO', 'CAR'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

const VEHICLE_LABELS: Record<string, string> = {
  BIKE: 'Motorcycle',
  SCOOTER: 'Scooter',
  BICYCLE: 'Bicycle',
  E_RICKSHAW: 'E-rickshaw',
  AUTO: 'Auto',
  CAR: 'Car',
};

/** "Motorcycle UP15AB1234" — how a partner's ride is described in notifications. */
export function describeVehicle(type: string | null | undefined, number: string | null | undefined) {
  return [type ? VEHICLE_LABELS[type] ?? type : null, number].filter(Boolean).join(' ');
}

/**
 * Shops and buyers see who's carrying the order, but not the whole licence number —
 * "UP14•••••••2345" is enough to match it against the card. The admin sees it in full.
 */
export function maskLicense(value: string) {
  return value.length <= 8 ? value : `${value.slice(0, 4)}${'•'.repeat(value.length - 8)}${value.slice(-4)}`;
}

export function normalizeLicense(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * State code (2 letters) + RTO code (2 digits) + the rest — "UP14 20190012345" style.
 * Older licences vary in length, so the tail is 9–13 characters.
 */
export function isValidLicense(value: string) {
  return /^[A-Z]{2}\d{2}[0-9A-Z]{9,13}$/.test(normalizeLicense(value));
}

export function normalizeVehicleNumber(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** "UP15AB1234", "DL3C1234", or a BH-series "22BH1234AA". */
export function isValidVehicleNumber(value: string) {
  const v = normalizeVehicleNumber(value);
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(v) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(v);
}

// A resized photo is a few hundred KB; this leaves room without letting huge uploads in.
const MAX_IMAGE_CHARS = 4_000_000;

export function isImageDataUrl(value: string | undefined) {
  return !!value && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(value) && value.length <= MAX_IMAGE_CHARS;
}

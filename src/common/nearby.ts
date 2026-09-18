import { Prisma } from '@prisma/client';

/**
 * The visitor's location from the navbar location picker. Any part may be missing —
 * a typed city has no pincode, and older shops were saved without coordinates.
 */
export type NearQuery = { city?: string; pincode?: string; lat?: number; lng?: number };

// ~25 km either way. A lat/lng box (not a true circle) is plenty for "near me".
const RADIUS_DEG_LAT = 0.225;

export function parseNear(q: { city?: string; pincode?: string; lat?: string | number; lng?: string | number }): NearQuery {
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const hasCoords = q.lat != null && q.lng != null && q.lat !== '' && q.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);
  return {
    city: q.city?.trim() || undefined,
    pincode: q.pincode?.trim() || undefined,
    lat: hasCoords ? lat : undefined,
    lng: hasCoords ? lng : undefined,
  };
}

/**
 * Indian pincodes share their first three digits within a sorting district, so a
 * matching prefix is a good "same area" signal for shops that have no coordinates.
 */
function pincodeZone(pincode?: string) {
  return pincode && /^\d{6}$/.test(pincode) ? pincode.slice(0, 3) : undefined;
}

/**
 * Shops in the visitor's city or one of its sub-areas ("Meerut Cantt" for "Meerut"),
 * in the same pincode zone, or within ~25 km when the shop saved its coordinates.
 */
export function listingNearWhere(near: NearQuery): Prisma.ListingWhereInput | undefined {
  const or: Prisma.ListingWhereInput[] = [];
  if (near.city) or.push({ city: { contains: near.city, mode: 'insensitive' } });
  const zone = pincodeZone(near.pincode);
  if (zone) or.push({ pincode: { startsWith: zone } });
  if (near.lat != null && near.lng != null) {
    const dLng = RADIUS_DEG_LAT / Math.max(Math.cos((near.lat * Math.PI) / 180), 0.2);
    or.push({
      latitude: { gte: near.lat - RADIUS_DEG_LAT, lte: near.lat + RADIUS_DEG_LAT },
      longitude: { gte: near.lng - dLng, lte: near.lng + dLng },
    });
  }
  return or.length ? { OR: or } : undefined;
}

/** Jobs based in the visitor's city / pincode zone. Remote jobs suit everyone, so they always match. */
export function jobNearWhere(near: NearQuery): Prisma.JobWhereInput | undefined {
  const or: Prisma.JobWhereInput[] = [];
  if (near.city) or.push({ location: { contains: near.city, mode: 'insensitive' } });
  const zone = pincodeZone(near.pincode);
  if (zone) or.push({ pincode: { startsWith: zone } });
  if (!or.length) return undefined;
  or.push({ workMode: 'REMOTE' });
  return { OR: or };
}

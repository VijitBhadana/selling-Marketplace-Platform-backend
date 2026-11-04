import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type Place = { city: string | null; area: string | null; pincode: string | null };

type OlaComponent = { long_name?: string; types?: string[] };
type OlaResult = { address_components?: OlaComponent[] };

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;
const TIMEOUT_MS = 4000;

/**
 * Coordinates → colony, city and pincode via Ola Maps, whose Indian data names colonies
 * (e.g. "Ganga Nagar") that OpenStreetMap often doesn't. The key never leaves the server.
 * Ola gives 100,000 free calls a month, so lookups are cached (~11 m grid) and capped per
 * day; over the cap, without a key, or when Ola fails this throws 503 and the browser
 * falls back to OpenStreetMap on its own.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly cache = new Map<string, { place: Place; at: number }>();
  private readonly inflight = new Map<string, Promise<Place>>();
  private day = '';
  private usedToday = 0;

  async reverse(lat: number, lng: number): Promise<Place> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.place;

    const pending = this.inflight.get(key);
    if (pending) return pending;
    const promise = this.fetchOla(lat, lng).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    const place = await promise;

    this.cache.delete(key);
    this.cache.set(key, { place, at: Date.now() });
    // Map keeps insertion order — drop the oldest entry once full.
    if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    return place;
  }

  private async fetchOla(lat: number, lng: number): Promise<Place> {
    // Read when needed: ConfigModule loads .env once, after modules are imported.
    const apiKey = process.env.OLA_MAPS_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException('Ola Maps is not configured');
    this.countCall();

    const url =
      `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}` +
      `&api_key=${encodeURIComponent(apiKey)}`;
    let body: { status?: string; results?: OlaResult[]; error_message?: string };
    try {
      const res = await fetch(url, {
        headers: { 'X-Request-Id': randomUUID() },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      body = await res.json();
      if (!res.ok || body.status !== 'ok') throw new Error(`HTTP ${res.status} ${body.error_message ?? body.status ?? ''}`);
    } catch (err) {
      this.logger.warn(`Ola reverse geocode failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Ola Maps lookup failed');
    }

    const place = parsePlace(body.results ?? []);
    if (!place.city) throw new ServiceUnavailableException('Ola Maps found no city here');
    return place;
  }

  /** Counts one paid-quota call, or throws once today's cap is used up. */
  private countCall() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.usedToday = 0;
    }
    const limit = Number(process.env.OLA_MAPS_DAILY_LIMIT) || 3000;
    if (this.usedToday >= limit) throw new ServiceUnavailableException('Ola Maps daily limit reached');
    this.usedToday += 1;
  }
}

/** The first city / colony / pincode across Ola's results (nearest first). */
export function parsePlace(results: OlaResult[]): Place {
  const first = (...types: string[]) => {
    for (const type of types) {
      for (const r of results) {
        const c = r.address_components?.find((c) => c.types?.includes(type) && c.long_name?.trim());
        if (c) return c.long_name!.trim();
      }
    }
    return null;
  };
  const city = first('locality', 'administrative_area_level_3', 'administrative_area_level_2');
  let area = first('sublocality_level_1', 'sublocality', 'neighborhood');
  if (area && city && area.toLowerCase() === city.toLowerCase()) area = null;
  const pincode = first('postal_code');
  return { city, area, pincode: pincode && /^\d{6}$/.test(pincode) ? pincode : null };
}

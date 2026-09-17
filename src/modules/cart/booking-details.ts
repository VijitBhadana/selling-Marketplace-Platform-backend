import { BadRequestException } from '@nestjs/common';

// Booking Cloude (and Wedding Cloude's booking categories): products in these
// categories can't just be "bought" — the buyer has to say what they're booking
// (dates, guests, rooms, pickup/drop, budget...). Mirrors frontend/lib/booking-details.ts.
export type BookingKind = 'STAY' | 'EVENT' | 'VEHICLE' | 'GOODS' | 'TOUR' | 'WEDDING' | 'PROPERTY' | 'TRANSPORT' | 'RENT';

// Property Cloude: places listed for rent (or sale). The type decides which details
// the seller fills in when listing one (see products/property-details.ts) and what
// the buyer is asked when renting it. Property Professionals shops sell normal products.
export type PropertyType = 'HOSTEL' | 'PG' | 'GUEST_HOUSE' | 'ROOM' | 'FLAT' | 'SHOP' | 'OFFICE' | 'WAREHOUSE' | 'PLOT';

export const PROPERTY_TYPE_BY_CATEGORY: Record<string, PropertyType> = {
  'hostel-rent': 'HOSTEL',
  'guest-house-rent': 'GUEST_HOUSE',
  'room-rent': 'ROOM',
  'pg-rent': 'PG',
  'shop-rent-or-sale': 'SHOP',
  'office-rent-or-sale': 'OFFICE',
  'flat-rent-or-sale': 'FLAT',
  'warehouse-rent-or-sale': 'WAREHOUSE',
  'plot-rent-or-sale': 'PLOT',
};

/** People live here — the buyer says how many will stay; for the rest they say what it's for. */
export const RESIDENTIAL_TYPES: PropertyType[] = ['HOSTEL', 'PG', 'GUEST_HOUSE', 'ROOM', 'FLAT'];
export const TENANT_TYPES = ['Family', 'Bachelors', 'Students', 'Working professionals'];
export const PAYMENT_PLANS = ['Full payment', 'Home loan', 'Not decided yet'];

// Rent Cloude: every category in it is rented out by the day, so the kind is decided by
// the Cloude, not the category. What the buyer is asked on top of the dates depends on
// what is being rented: a vehicle needs the renter's licence and Aadhaar, a place needs
// the head count, everything else (furniture, a camera, a drill) needs neither.
export const RENT_CLOUDE_SLUG = 'rent';
export type RentSubject = 'VEHICLE' | 'PLACE' | 'ITEM';

const RENT_VEHICLE_CATEGORIES = ['cars', 'bikes-scooters', 'commercial-vehicles'];
const RENT_PLACE_CATEGORIES = ['flats-apartments', 'shops-offices', 'rooms-pg'];

export function getRentSubject(cloudeSlug?: string | null, categorySlug?: string | null): RentSubject | null {
  if (cloudeSlug !== RENT_CLOUDE_SLUG || !categorySlug) return null;
  if (RENT_VEHICLE_CATEGORIES.includes(categorySlug)) return 'VEHICLE';
  if (RENT_PLACE_CATEGORIES.includes(categorySlug)) return 'PLACE';
  return 'ITEM';
}

const KIND_BY_CATEGORY: Record<string, Record<string, BookingKind>> = {
  property: Object.fromEntries(Object.keys(PROPERTY_TYPE_BY_CATEGORY).map((slug) => [slug, 'PROPERTY' as const])),
  booking: {
    hotels: 'STAY',
    'rooms-guest-houses': 'STAY',
    'party-events-birthday-function-booking': 'EVENT',
    'cab-bus-truck': 'VEHICLE',
    'delivery-package-movers-services': 'GOODS',
    'courier-services': 'GOODS',
    'tour-packages': 'TOUR',
  },
  // Wedding Cloude: venues and pandits are booked for some days and a guest count;
  // everything else (pooja items, furniture...) is bought like a normal product.
  wedding: {
    'hotel-booking': 'WEDDING',
    'banquet-hall-booking': 'WEDDING',
    'wedding-venue-booking': 'WEDDING',
    'pandit-booking': 'WEDDING',
  },
  // Agriculture & Farmer Cloude: vehicles for goods delivery or on hire by the hour — the
  // seller's rates live in products/transport-details.ts. Vegetables, fruits, machines
  // on rent, pesticides... are bought like normal products.
  agriculture: {
    'tata-ace-mini-truck': 'TRANSPORT',
    'goods-loading-transport': 'TRANSPORT',
    'farm-to-market-delivery': 'TRANSPORT',
  },
};

/** Cab/Bus/Truck vehicles that carry people (ask passengers + dates) — the rest carry goods. */
const PASSENGER_VEHICLES = ['Car / Cab', 'SUV / Innova', 'Tempo Traveller', 'Bus'];
const GOODS_VEHICLES = ['Mini Truck (Tata Ace)', 'Pickup / Tempo', 'Truck'];
const DELIVERY_VEHICLES = ['Bike / Scooter', 'Three-wheeler (Auto)', 'Mini Truck (Tata Ace)', 'Pickup / Tempo', 'Truck', 'Container Truck'];

export function getBookingKind(cloudeSlug?: string | null, categorySlug?: string | null): BookingKind | null {
  if (!cloudeSlug || !categorySlug) return null;
  if (cloudeSlug === RENT_CLOUDE_SLUG) return 'RENT';
  return KIND_BY_CATEGORY[cloudeSlug]?.[categorySlug] ?? null;
}

// What a booking product's price is per. The seller picks one when adding the
// product; the first option for each kind is the default (also used for products
// saved before the seller could choose).
export const PRICE_UNITS = ['FIXED', 'PER_ROOM_NIGHT', 'PER_NIGHT', 'PER_HOUR', 'PER_DAY', 'PER_PERSON', 'PER_MONTH', 'PER_YEAR', 'PER_KM'] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const PRICE_UNIT_OPTIONS: Record<BookingKind, PriceUnit[]> = {
  STAY: ['PER_ROOM_NIGHT', 'PER_NIGHT', 'FIXED'],
  EVENT: ['FIXED', 'PER_HOUR', 'PER_PERSON'],
  VEHICLE: ['PER_DAY', 'FIXED'],
  GOODS: ['FIXED'],
  TOUR: ['FIXED', 'PER_DAY', 'PER_PERSON'],
  WEDDING: ['PER_DAY', 'PER_PERSON', 'FIXED'],
  // Rent is per day/month/year; a property for sale has a FIXED price. The seller's
  // choices are narrowed per property type in products/property-details.ts.
  PROPERTY: ['PER_MONTH', 'PER_DAY', 'PER_YEAR', 'FIXED'],
  // Set from the seller's rates and the buyer's choice — see transportQuote().
  TRANSPORT: ['FIXED', 'PER_KM', 'PER_HOUR'],
  // Rent Cloude: everything is quoted per day, so the seller has nothing to choose.
  RENT: ['PER_DAY'],
};

/** Which booking-details field holds the rent duration for a property's price unit. */
export const RENT_DURATION_KEY: Partial<Record<PriceUnit, 'days' | 'months' | 'years'>> = {
  PER_DAY: 'days',
  PER_MONTH: 'months',
  PER_YEAR: 'years',
};
const RENT_DURATION_MAX = { days: 365, months: 120, years: 30 };

export function effectivePriceUnit(kind: BookingKind, unit?: string | null): PriceUnit {
  const options = PRICE_UNIT_OPTIONS[kind];
  return options.includes(unit as PriceUnit) ? (unit as PriceUnit) : options[0];
}

const count = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

/** How many times the unit price applies to this booking (2 rooms × 3 nights = 6). */
export function bookingUnits(unit: PriceUnit, d: Record<string, unknown>): number {
  switch (unit) {
    case 'PER_ROOM_NIGHT':
      return count(d.rooms) * count(d.nights);
    case 'PER_NIGHT':
      return count(d.nights);
    case 'PER_HOUR':
      return count(d.durationHours);
    case 'PER_DAY':
      return count(d.days);
    case 'PER_PERSON':
      return count(d.guests ?? d.travellers ?? d.passengers);
    case 'PER_MONTH':
      return count(d.months);
    case 'PER_YEAR':
      return count(d.years);
    case 'PER_KM':
      return count(d.distanceKm);
    default:
      return 1;
  }
}

/** Rent vs sale, as the seller listed the property (rent unless they chose sale). */
export function propertyListingFor(propertyDetails: unknown): 'RENT' | 'SALE' {
  return (propertyDetails as Raw | null)?.listingFor === 'SALE' ? 'SALE' : 'RENT';
}

/**
 * True when the seller changed rent ↔ sale or the rent unit (month → day...) after the
 * buyer filled in their details — the saved duration would then be priced wrongly.
 */
export function propertyTermsChanged(
  bookingDetails: unknown,
  product: { priceUnit?: string | null; propertyDetails?: unknown },
): boolean {
  const d = (bookingDetails ?? {}) as Raw;
  const listingFor = propertyListingFor(product.propertyDetails);
  if (d.listingFor !== listingFor) return true;
  return listingFor === 'RENT' && d.priceUnit !== effectivePriceUnit('PROPERTY', product.priceUnit);
}

/**
 * End of the (latest) booking day, IST. Stored as the booking order's pickupEta so
 * the existing no-show rule applies: the seller can report a Cash booking only
 * once the booked day is over.
 */
export function bookingNoShowAfter(detailsList: Record<string, unknown>[]): Date | null {
  const dates = detailsList
    .map((d) => d.checkIn ?? d.eventDate ?? d.startDate)
    .filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
    .sort();
  const last = dates[dates.length - 1];
  return last ? new Date(`${last}T23:59:59+05:30`) : null;
}

type Raw = Record<string, unknown>;

function text(raw: Raw, key: string, label: string, max = 300): string {
  const value = typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
  if (!value) throw new BadRequestException(`Please fill in: ${label}.`);
  return value.slice(0, max);
}

function optionalText(raw: Raw, key: string, max = 500): string | undefined {
  const value = typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
  return value ? value.slice(0, max) : undefined;
}

function int(raw: Raw, key: string, label: string, max: number): number {
  const value = Number(raw[key]);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new BadRequestException(`${label} must be a whole number between 1 and ${max}.`);
  }
  return value;
}

function date(raw: Raw, key: string, label: string): string {
  const value = typeof raw[key] === 'string' ? (raw[key] as string) : '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Please pick a valid date for: ${label}.`);
  }
  // One day of slack so a buyer a few hours ahead of/behind UTC can still pick "today".
  if (parsed.getTime() < Date.now() - 2 * 86_400_000) {
    throw new BadRequestException(`${label} can't be in the past.`);
  }
  return value;
}

function oneOf<T extends string>(raw: Raw, key: string, label: string, options: readonly T[]): T {
  const value = raw[key];
  if (typeof value !== 'string' || !options.includes(value as T)) {
    throw new BadRequestException(`Please choose: ${label}.`);
  }
  return value as T;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

/** The product being booked — only Property Cloude bookings look at it. */
type BookedProduct = {
  priceUnit?: string | null;
  propertyDetails?: unknown;
  /** From the shop's category — decides whether we ask who will stay or what it's for. */
  propertyType?: PropertyType | null;
  /** Agriculture transport: the seller's services and rates (products/transport-details.ts). */
  transportDetails?: unknown;
  /** Rent Cloude: from the shop's category — a vehicle needs KYC, a place needs a head count. */
  rentSubject?: RentSubject | null;
};

function optionalDate(raw: Raw, key: string, label: string): string | undefined {
  return raw[key] ? date(raw, key, label) : undefined;
}

function optionalOneOf<T extends string>(raw: Raw, key: string, label: string, options: readonly T[]): T | undefined {
  return raw[key] ? oneOf(raw, key, label, options) : undefined;
}

function phone(raw: Raw): string {
  const digits = typeof raw.phone === 'string' ? raw.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') : '';
  if (!/^[6-9]\d{9}$/.test(digits)) throw new BadRequestException('Please enter a valid 10-digit mobile number.');
  return digits;
}

/**
 * Property Cloude: what the buyer fills in to rent a place (move-in date, for how
 * long, who will stay / what for) or to enquire about buying one. Rent duration is
 * in the seller's price unit, and never shorter than their minimum rent period.
 */
function normalizePropertyRequest(raw: Raw, product: BookedProduct) {
  const property = (product.propertyDetails ?? {}) as Raw;
  const listingFor = propertyListingFor(property);
  const notes = optionalText(raw, 'notes');

  if (listingFor === 'SALE') {
    return {
      kind: 'PROPERTY',
      listingFor,
      visitDate: optionalDate(raw, 'visitDate', 'Site visit date'),
      paymentPlan: optionalOneOf(raw, 'paymentPlan', 'How will you pay', PAYMENT_PLANS),
      phone: phone(raw),
      notes,
    };
  }

  const priceUnit = effectivePriceUnit('PROPERTY', product.priceUnit);
  const durationKey = RENT_DURATION_KEY[priceUnit] ?? 'months';
  const word = durationKey.slice(0, -1);
  const duration = int(raw, durationKey, `Number of ${durationKey}`, RENT_DURATION_MAX[durationKey]);
  const minDuration = Number(property.minDuration) || 1;
  if (duration < minDuration) {
    throw new BadRequestException(`The owner rents this out for at least ${minDuration} ${word}${minDuration === 1 ? '' : 's'}.`);
  }

  const startDate = date(raw, 'startDate', 'Move-in date');
  if (typeof property.availableFrom === 'string' && startDate < property.availableFrom) {
    throw new BadRequestException(`This property is available from ${property.availableFrom} — pick that date or later.`);
  }

  const residential = RESIDENTIAL_TYPES.includes((product.propertyType ?? property.type) as PropertyType);
  return {
    kind: 'PROPERTY',
    listingFor,
    priceUnit,
    startDate,
    [durationKey]: duration,
    ...(residential
      ? {
          occupants: int(raw, 'occupants', 'Number of people', 1000),
          tenantType: optionalOneOf(raw, 'tenantType', 'Who will stay', TENANT_TYPES),
        }
      : { purpose: text(raw, 'purpose', 'What you will use it for') }),
    phone: phone(raw),
    notes,
  };
}

/**
 * Agriculture transport: what the buyer pays per unit and what it's per, from the seller's
 * current rates and the service the buyer chose — a delivery is per trip (FIXED) or per km,
 * a truck on hire is per hour. null when the seller no longer offers that service.
 */
export function transportQuote(transportDetails: unknown, bookingDetails: unknown): { unitPrice: number; priceUnit: PriceUnit } | null {
  const t = (transportDetails ?? {}) as Raw;
  const services = Array.isArray(t.services) ? t.services : [];
  const service = ((bookingDetails ?? {}) as Raw).service;
  if (service === 'HOURLY' && services.includes('HOURLY')) return { unitPrice: Number(t.hourlyRate) || 0, priceUnit: 'PER_HOUR' };
  if (service === 'DELIVERY' && services.includes('DELIVERY')) {
    return { unitPrice: Number(t.deliveryCharge) || 0, priceUnit: t.deliveryChargeUnit === 'PER_KM' ? 'PER_KM' : 'FIXED' };
  }
  return null;
}

/** True when the seller stopped offering the buyer's service, or switched per trip ↔ per km, after they booked. */
export function transportTermsChanged(bookingDetails: unknown, transportDetails: unknown): boolean {
  const quote = transportQuote(transportDetails, bookingDetails);
  return !quote || quote.priceUnit !== ((bookingDetails ?? {}) as Raw).priceUnit;
}

/**
 * Agriculture transport: from where to where, what goods and how much, and when. A hired
 * truck also needs the hours (never below the seller's minimum); a per-km delivery needs
 * the distance, since the charge is worked out from it.
 */
function normalizeTransportRequest(raw: Raw, product: BookedProduct) {
  const t = product.transportDetails as Raw | null | undefined;
  if (!t || !Array.isArray(t.services) || t.services.length === 0) {
    throw new BadRequestException("The seller hasn't added delivery / hire rates for this vehicle yet — chat with them instead.");
  }
  const service = oneOf(raw, 'service', 'Goods delivery or truck on hire', t.services as string[]);
  const { priceUnit } = transportQuote(t, { service })!;

  const startTime = optionalText(raw, 'startTime', 5);
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new BadRequestException('Please pick a valid time.');

  const details: Raw = {
    kind: 'TRANSPORT',
    service,
    priceUnit,
    pickup: text(raw, 'pickup', 'Pickup location (from)'),
    drop: text(raw, 'drop', 'Drop location (to)'),
    goodsDescription: text(raw, 'goodsDescription', 'What goods'),
    goodsQuantity: text(raw, 'goodsQuantity', 'How much goods'),
    startDate: date(raw, 'startDate', service === 'HOURLY' ? 'Date needed' : 'Pickup date'),
    startTime,
  };
  if (service === 'HOURLY') {
    const hours = int(raw, 'durationHours', 'Hours needed', 72);
    const minHours = Number(t.minHours) || 1;
    if (hours < minHours) throw new BadRequestException(`This truck is hired out for at least ${minHours} hours.`);
    details.durationHours = hours;
  } else if (priceUnit === 'PER_KM') {
    details.distanceKm = int(raw, 'distanceKm', 'Distance (km)', 3000);
  }
  details.phone = phone(raw);
  details.notes = optionalText(raw, 'notes');
  return details;
}

// Rent Cloude KYC: a renter's driving licence and Aadhaar card, kept with the booking as
// base64 photos (the same way finance papers and listing photos are stored). Resized by
// the browser before upload, so 3 MB each is generous for a phone snap.
const RENT_DOC_MAX_BYTES = 3 * 1024 * 1024;
const RENT_DOC_LABELS = { drivingLicence: 'driving licence', aadhaarCard: 'Aadhaar card' } as const;
const RENT_DAYS_MAX = 365;
const RENT_OCCUPANTS_MAX = 1000;

/** Roughly how many bytes a base64 data URL carries — 4 base64 chars per 3 bytes. */
function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

function rentDocument(raw: Raw, key: keyof typeof RENT_DOC_LABELS) {
  const label = RENT_DOC_LABELS[key];
  const doc = raw[key];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new BadRequestException(`Please upload a photo of your ${label}.`);
  }
  const { fileName, dataUrl } = doc as Raw;
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!/^data:image\/(jpeg|png|webp|heic);base64,/.test(url)) {
    throw new BadRequestException(`Upload your ${label} as a photo (JPG, PNG or WEBP).`);
  }
  if (dataUrlBytes(url) > RENT_DOC_MAX_BYTES) {
    throw new BadRequestException(`Your ${label} photo must be 3 MB or smaller.`);
  }
  return { fileName: typeof fileName === 'string' && fileName.trim() ? fileName.trim().slice(0, 200) : `${key}.jpg`, dataUrl: url };
}

/**
 * Rent Cloude: what the buyer fills in to rent something — from when to when (the day
 * count is worked out from the dates and is what the per-day rent multiplies by), plus
 * the renter's licence and Aadhaar for a vehicle, or how many people for a place.
 */
function normalizeRentRequest(raw: Raw, product: BookedProduct) {
  const startDate = date(raw, 'startDate', 'Rent from date');
  const endDate = date(raw, 'endDate', 'Rent until date');
  if (endDate < startDate) throw new BadRequestException('The "until" date must be on or after the "from" date.');
  const days = daysBetween(startDate, endDate);
  if (days > RENT_DAYS_MAX) throw new BadRequestException(`You can rent this for at most ${RENT_DAYS_MAX} days at a time.`);

  const subject = product.rentSubject ?? 'ITEM';
  return {
    kind: 'RENT',
    subject,
    priceUnit: 'PER_DAY' as PriceUnit,
    startDate,
    endDate,
    days,
    ...(subject === 'VEHICLE'
      ? { drivingLicence: rentDocument(raw, 'drivingLicence'), aadhaarCard: rentDocument(raw, 'aadhaarCard') }
      : {}),
    ...(subject === 'PLACE' ? { occupants: int(raw, 'occupants', 'Number of people', RENT_OCCUPANTS_MAX) } : {}),
    notes: optionalText(raw, 'notes'),
  };
}

/**
 * Validates the buyer's booking form for the given kind and returns a clean copy
 * (only known fields, trimmed, typed). The kind is decided server-side from the
 * shop's category — whatever `kind` the client sends is ignored. Property bookings
 * also need the product, since the seller's rent/sale terms decide what's asked.
 */
export function normalizeBookingDetails(kind: BookingKind, input: unknown, product: BookedProduct = {}): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the booking details for this item.');
  }
  const raw = input as Raw;
  const notes = optionalText(raw, 'notes');

  switch (kind) {
    case 'STAY':
      return {
        kind,
        checkIn: date(raw, 'checkIn', 'Check-in date'),
        nights: int(raw, 'nights', 'Number of days', 365),
        rooms: int(raw, 'rooms', 'Rooms', 100),
        guests: int(raw, 'guests', 'Guests', 1000),
        bedType: oneOf(raw, 'bedType', 'Single or double bed', ['SINGLE', 'DOUBLE'] as const),
        notes,
      };

    case 'EVENT':
      return {
        kind,
        eventDate: date(raw, 'eventDate', 'Event date'),
        startTime: optionalText(raw, 'startTime', 10),
        durationHours: int(raw, 'durationHours', 'Hours needed', 72),
        guests: int(raw, 'guests', 'Number of people', 10000),
        notes,
      };

    case 'VEHICLE': {
      const vehicleType = oneOf(raw, 'vehicleType', 'Vehicle', [...PASSENGER_VEHICLES, ...GOODS_VEHICLES]);
      const pickup = text(raw, 'pickup', 'Pickup location');
      const drop = text(raw, 'drop', 'Drop location');
      const startDate = date(raw, 'startDate', 'Start date');

      if (PASSENGER_VEHICLES.includes(vehicleType)) {
        const endDate = date(raw, 'endDate', 'End date');
        if (endDate < startDate) throw new BadRequestException('End date must be on or after the start date.');
        return {
          kind,
          vehicleType,
          pickup,
          drop,
          passengers: int(raw, 'passengers', 'Number of people', 200),
          startDate,
          endDate,
          days: daysBetween(startDate, endDate),
          notes,
        };
      }

      return {
        kind,
        vehicleType,
        pickup,
        drop,
        startDate,
        goodsDescription: text(raw, 'goodsDescription', 'What goods'),
        goodsQuantity: text(raw, 'goodsQuantity', 'How much goods'),
        notes,
      };
    }

    case 'GOODS':
      return {
        kind,
        vehicleType: oneOf(raw, 'vehicleType', 'Vehicle', DELIVERY_VEHICLES),
        goodsDescription: text(raw, 'goodsDescription', 'What goods'),
        goodsQuantity: text(raw, 'goodsQuantity', 'How much goods'),
        pickup: text(raw, 'pickup', 'Pickup address'),
        drop: text(raw, 'drop', 'Delivery address'),
        startDate: date(raw, 'startDate', 'Pickup date'),
        notes,
      };

    case 'TOUR':
      return {
        kind,
        startDate: date(raw, 'startDate', 'Tour start date'),
        days: int(raw, 'days', 'Number of days', 90),
        travellers: int(raw, 'travellers', 'Number of travellers', 500),
        budget: int(raw, 'budget', 'Budget', 100_000_000),
        notes,
      };

    case 'WEDDING':
      return {
        kind,
        startDate: date(raw, 'startDate', 'Booking date'),
        days: int(raw, 'days', 'Number of days', 30),
        guests: int(raw, 'guests', 'Number of guests', 10000),
        notes,
      };

    case 'PROPERTY':
      return normalizePropertyRequest(raw, product);

    case 'TRANSPORT':
      return normalizeTransportRequest(raw, product);

    case 'RENT':
      return normalizeRentRequest(raw, product);
  }
}

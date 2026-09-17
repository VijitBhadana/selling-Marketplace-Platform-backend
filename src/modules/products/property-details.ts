import { BadRequestException } from '@nestjs/common';
import { PROPERTY_TYPE_BY_CATEGORY, type PriceUnit, type PropertyType } from '../cart/booking-details';

// Property Cloude: what the seller fills in when listing a property (a Product in a
// property shop) — rent or sale, BHK, area, furnishing, deposit, amenities... Buyers
// see these next to the property. Mirrors frontend/lib/property-details.ts.

export function getPropertyType(cloudeSlug?: string | null, categorySlug?: string | null): PropertyType | null {
  if (cloudeSlug !== 'property' || !categorySlug) return null;
  return PROPERTY_TYPE_BY_CATEGORY[categorySlug] ?? null;
}

/** Hostel, PG, guest house and room categories are rent-only; the rest can be rented or sold. */
export const RENT_ONLY_TYPES: PropertyType[] = ['HOSTEL', 'PG', 'GUEST_HOUSE', 'ROOM'];

/** What rent can be charged per, by property type. The first option is the default. */
export const RENT_UNIT_OPTIONS: Record<PropertyType, PriceUnit[]> = {
  HOSTEL: ['PER_MONTH', 'PER_DAY'],
  PG: ['PER_MONTH', 'PER_DAY'],
  GUEST_HOUSE: ['PER_DAY', 'PER_MONTH'],
  ROOM: ['PER_MONTH', 'PER_DAY'],
  FLAT: ['PER_MONTH', 'PER_YEAR'],
  SHOP: ['PER_MONTH', 'PER_YEAR'],
  OFFICE: ['PER_MONTH', 'PER_YEAR'],
  WAREHOUSE: ['PER_MONTH', 'PER_YEAR'],
  PLOT: ['PER_MONTH', 'PER_YEAR'],
};

type Field = {
  key: string;
  label: string;
  type: 'select' | 'multi' | 'number' | 'text' | 'date';
  types: PropertyType[] | 'ALL';
  options?: string[];
  /** Required for every type it applies to, or only for these. */
  required?: boolean | PropertyType[];
  /** Only asked when the property is listed for rent / for sale. */
  only?: 'RENT' | 'SALE';
};

const BUILDINGS: PropertyType[] = ['FLAT', 'SHOP', 'OFFICE', 'WAREHOUSE'];

export const PROPERTY_FIELDS: Field[] = [
  { key: 'configuration', label: 'BHK', type: 'select', types: ['FLAT'], options: ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'], required: true },
  { key: 'roomType', label: 'Room type', type: 'select', types: ['ROOM', 'GUEST_HOUSE'], options: ['Single room', 'Double room', 'Triple room', 'Shared / dormitory'], required: true },
  { key: 'sharing', label: 'Sharing', type: 'select', types: ['HOSTEL', 'PG'], options: ['Single (private room)', '2 sharing', '3 sharing', '4+ sharing'], required: true },
  { key: 'gender', label: 'For', type: 'select', types: ['HOSTEL', 'PG'], options: ['Boys', 'Girls', 'Anyone'], required: true },
  { key: 'area', label: 'Area (sq ft)', type: 'number', types: ['ROOM', ...BUILDINGS, 'PLOT'], required: [...BUILDINGS, 'PLOT'] },
  { key: 'plotSize', label: 'Plot size', type: 'text', types: ['PLOT'] },
  { key: 'furnishing', label: 'Furnishing', type: 'select', types: ['HOSTEL', 'PG', 'GUEST_HOUSE', 'ROOM', 'FLAT', 'OFFICE'], options: ['Unfurnished', 'Semi-furnished', 'Fully furnished'], required: true },
  { key: 'bathroom', label: 'Bathroom', type: 'select', types: ['HOSTEL', 'PG', 'GUEST_HOUSE', 'ROOM'], options: ['Attached', 'Common / shared'], required: true },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number', types: ['FLAT'], required: true },
  { key: 'food', label: 'Food', type: 'select', types: ['HOSTEL', 'PG', 'GUEST_HOUSE'], options: ['Included', 'Not included', 'Available at extra cost'], required: ['HOSTEL', 'PG'] },
  { key: 'floor', label: 'Floor', type: 'text', types: ['ROOM', ...BUILDINGS] },
  { key: 'facing', label: 'Facing', type: 'select', types: ['FLAT', 'SHOP', 'PLOT'], options: ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'] },
  { key: 'tenantPreference', label: 'Preferred tenants', type: 'select', types: ['ROOM', 'FLAT'], options: ['Anyone', 'Family', 'Bachelors', 'Students', 'Working professionals'], only: 'RENT' },
  { key: 'deposit', label: 'Security deposit (₹)', type: 'number', types: 'ALL', only: 'RENT' },
  { key: 'maintenance', label: 'Maintenance (₹ / month)', type: 'number', types: BUILDINGS },
  { key: 'minDuration', label: 'Minimum rent period', type: 'number', types: 'ALL', only: 'RENT' },
  { key: 'availableFrom', label: 'Available from', type: 'date', types: 'ALL' },
  { key: 'ownership', label: 'Ownership', type: 'select', types: [...BUILDINGS, 'PLOT'], options: ['Freehold', 'Leasehold', 'Co-operative society', 'Power of attorney'], only: 'SALE' },
  { key: 'possession', label: 'Possession', type: 'select', types: BUILDINGS, options: ['Ready to move', 'Under construction'], only: 'SALE' },
  {
    key: 'amenities',
    label: 'Amenities',
    type: 'multi',
    types: ['HOSTEL', 'PG', 'GUEST_HOUSE', 'ROOM', ...BUILDINGS],
    options: ['Parking', 'Power backup', 'Lift', '24×7 water', 'Wi-Fi', 'AC', 'CCTV / Security', 'Gated society', 'Housekeeping', 'Laundry', 'Washroom', 'Loading area'],
  },
  {
    key: 'plotFeatures',
    label: 'Plot features',
    type: 'multi',
    types: ['PLOT'],
    options: ['Boundary wall', 'Corner plot', 'Road access', 'Water connection', 'Electricity connection', 'Gated colony'],
  },
  { key: 'address', label: 'Locality / address', type: 'text', types: 'ALL', required: true },
];

export function fieldApplies(field: Field, type: PropertyType, listingFor: 'RENT' | 'SALE') {
  return (field.types === 'ALL' || field.types.includes(type)) && (!field.only || field.only === listingFor);
}

function isRequired(field: Field, type: PropertyType) {
  return field.required === true || (Array.isArray(field.required) && field.required.includes(type));
}

function readField(field: Field, value: unknown, required: boolean): unknown {
  const text = typeof value === 'string' ? value.trim() : value;
  if (text === undefined || text === null || text === '' || (Array.isArray(text) && text.length === 0)) {
    if (required) throw new BadRequestException(`Please fill in: ${field.label}.`);
    return undefined;
  }

  switch (field.type) {
    case 'select':
      if (typeof text !== 'string' || !field.options!.includes(text)) {
        throw new BadRequestException(`Please choose a valid option for: ${field.label}.`);
      }
      return text;
    case 'multi':
      if (!Array.isArray(text) || text.some((v) => typeof v !== 'string' || !field.options!.includes(v))) {
        throw new BadRequestException(`Please choose valid options for: ${field.label}.`);
      }
      return [...new Set(text)];
    case 'number': {
      const n = Number(text);
      if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000_000 || (required && n === 0)) {
        throw new BadRequestException(`${field.label} must be a whole number${required ? ' above 0' : ''}.`);
      }
      return n;
    }
    case 'text':
      if (typeof text !== 'string') throw new BadRequestException(`Please fill in: ${field.label}.`);
      return text.slice(0, 200);
    case 'date':
      if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
        throw new BadRequestException(`Please pick a valid date for: ${field.label}.`);
      }
      return text;
  }
}

/**
 * Validates the seller's property details and returns a clean copy (only the fields
 * that apply to this type and rent/sale choice) plus the price unit to store: rent per
 * month/day/year from the type's options, or FIXED for a property that's for sale.
 */
export function normalizePropertyListing(type: PropertyType, input: unknown, priceUnit?: string | null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the property details.');
  }
  const raw = input as Record<string, unknown>;
  const listingFor = RENT_ONLY_TYPES.includes(type) ? 'RENT' : raw.listingFor === 'SALE' || raw.listingFor === 'RENT' ? raw.listingFor : null;
  if (!listingFor) throw new BadRequestException('Please choose whether this property is for rent or for sale.');

  const propertyDetails: Record<string, unknown> = { type, listingFor };
  for (const field of PROPERTY_FIELDS) {
    if (!fieldApplies(field, type, listingFor)) continue;
    const value = readField(field, raw[field.key], isRequired(field, type));
    if (value !== undefined) propertyDetails[field.key] = value;
  }

  const options = RENT_UNIT_OPTIONS[type];
  const unit: PriceUnit =
    listingFor === 'SALE' ? 'FIXED' : options.includes(priceUnit as PriceUnit) ? (priceUnit as PriceUnit) : options[0];
  return { propertyDetails, priceUnit: unit };
}

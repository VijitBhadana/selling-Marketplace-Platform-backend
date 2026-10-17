// Second-hand / refurbished items. A seller selling goods (not a service) in a shop where
// pre-owned things make sense — a phone, a sofa, a cycle, gym equipment — can mark the item
// as used or refurbished, and buyers see it on the item. Mirrored in frontend/lib/item-condition.ts.
import { BadRequestException } from '@nestjs/common';
import { getBookingKind } from '../cart/booking-details';
import { getPropertyType } from './property-details';

/** What the seller picks. NEW is stored as null — only pre-owned items carry a condition. */
export const ITEM_CONDITIONS = ['NEW', 'USED', 'REFURBISHED'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

// Cloudes whose shops sell goods that can be pre-owned. Food, medicines, farm produce,
// courses, loans, jobs, bookings and rentals can't; Education books carry their own
// new / used choice (see education-details.ts); a Mini Factory makes things new.
const SECOND_HAND_CLOUDES = ['shopping', 'skill', 'wedding', 'property', 'sports-fitness-gym'];

// Consumables inside those cloudes — nobody sells used groceries, cosmetics or pooja samagri.
const NEW_ONLY_CATEGORIES: Record<string, string[]> = {
  shopping: ['grocery-items-daily-use', 'beauty-products'],
  skill: [
    'pooja-items-pooja-material',
    'beauty-makeup-salon-parlour-products-items-mehndi-artist',
    'cleaning-products',
    'snacks-and-similar-products',
  ],
  wedding: ['pooja-items'],
};

/** Can an item in this shop be marked second hand / refurbished? Services and bookings never can. */
export function canBeSecondHand(cloudeSlug?: string | null, categorySlug?: string | null, isService = false): boolean {
  if (!cloudeSlug || !categorySlug || isService) return false;
  if (!SECOND_HAND_CLOUDES.includes(cloudeSlug)) return false;
  if (getBookingKind(cloudeSlug, categorySlug) || getPropertyType(cloudeSlug, categorySlug)) return false;
  return !NEW_ONLY_CATEGORIES[cloudeSlug]?.includes(categorySlug);
}

/** The value to store: null for a new item, USED / REFURBISHED for a pre-owned one. */
export function normalizeCondition(input: unknown): 'USED' | 'REFURBISHED' | null {
  if (input === null || input === undefined || input === 'NEW') return null;
  if (input === 'USED' || input === 'REFURBISHED') return input;
  throw new BadRequestException('Condition must be New, Second hand or Refurbished.');
}

import { BadRequestException } from '@nestjs/common';

// Agriculture & Farmer Cloude: shops posted under Tata Ace Mini Truck, Goods Loading &
// Transport or Farm-to-Market Delivery list vehicles instead of goods. For each one the
// seller says what it is, how much it carries, what they charge to deliver goods (per trip
// or per km) and/or what the truck costs on hire per hour. The buyer's side (from/to, what
// goods, hours or distance) lives in cart/booking-details.ts. Mirrors frontend/lib/transport-details.ts.

export const TRANSPORT_VEHICLES = [
  'Tata Ace / Chhota Hathi',
  'Pickup (Bolero / Dost)',
  'Mini Truck (407 / Eicher)',
  'Tractor Trolley',
  'Truck (6+ wheels)',
  'E-Rickshaw Loader',
  'Other',
];

export const TRANSPORT_SERVICES = ['DELIVERY', 'HOURLY'] as const;
export const DELIVERY_CHARGE_UNITS = ['PER_TRIP', 'PER_KM'] as const;

const MAX_RATE = 1_000_000;

type Raw = Record<string, unknown>;

function optionalText(raw: Raw, key: string, max: number): string | undefined {
  const value = typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
  return value ? value.slice(0, max) : undefined;
}

function text(raw: Raw, key: string, label: string, max: number): string {
  const value = optionalText(raw, key, max);
  if (!value) throw new BadRequestException(`Please fill in: ${label}.`);
  return value;
}

function rupees(raw: Raw, key: string, label: string): number {
  const value = Number(raw[key]);
  if (raw[key] === '' || raw[key] == null || !Number.isInteger(value) || value < 1 || value > MAX_RATE) {
    throw new BadRequestException(`${label} must be a whole number of rupees (1 – ${MAX_RATE.toLocaleString('en-IN')}).`);
  }
  return value;
}

/**
 * Validates the seller's vehicle & rate details and returns a clean copy, plus the price
 * the product shows everywhere else (the delivery charge, or the hourly rate when the
 * seller only rents the truck out by the hour).
 */
export function normalizeTransportDetails(input: unknown): { transportDetails: Raw; price: number; priceUnit: 'FIXED' | 'PER_KM' | 'PER_HOUR' } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the vehicle and rate details.');
  }
  const raw = input as Raw;

  const vehicleType = raw.vehicleType;
  if (typeof vehicleType !== 'string' || !TRANSPORT_VEHICLES.includes(vehicleType)) {
    throw new BadRequestException('Please choose: Vehicle type.');
  }

  const services = Array.isArray(raw.services) ? raw.services : [];
  if (services.length === 0 || services.some((s) => !TRANSPORT_SERVICES.includes(s))) {
    throw new BadRequestException('Please choose what you offer — goods delivery, truck on hire, or both.');
  }
  if (typeof raw.loadingHelp !== 'boolean') {
    throw new BadRequestException('Please say whether loading / unloading help is included.');
  }

  const details: Raw = {
    vehicleType,
    capacity: text(raw, 'capacity', 'Load capacity', 60),
    // Stored in a fixed order, whatever order the seller tapped them in.
    services: TRANSPORT_SERVICES.filter((s) => services.includes(s)),
    loadingHelp: raw.loadingHelp,
  };
  if (vehicleType === 'Other') details.otherVehicle = text(raw, 'otherVehicle', 'Vehicle name', 60);

  const delivery = services.includes('DELIVERY');
  if (delivery) {
    const unit = raw.deliveryChargeUnit;
    if (typeof unit !== 'string' || !(DELIVERY_CHARGE_UNITS as readonly string[]).includes(unit)) {
      throw new BadRequestException('Please choose whether the delivery charge is per trip or per km.');
    }
    details.deliveryCharge = rupees(raw, 'deliveryCharge', 'Delivery charge');
    details.deliveryChargeUnit = unit;
  }

  if (services.includes('HOURLY')) {
    details.hourlyRate = rupees(raw, 'hourlyRate', 'Rate per hour');
    if (raw.minHours !== undefined && raw.minHours !== null && raw.minHours !== '') {
      const minHours = Number(raw.minHours);
      if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
        throw new BadRequestException('Minimum hours must be a whole number between 1 and 24.');
      }
      if (minHours > 1) details.minHours = minHours;
    }
  }

  const serviceArea = optionalText(raw, 'serviceArea', 120);
  if (serviceArea) details.serviceArea = serviceArea;

  return delivery
    ? { transportDetails: details, price: details.deliveryCharge as number, priceUnit: details.deliveryChargeUnit === 'PER_KM' ? 'PER_KM' : 'FIXED' }
    : { transportDetails: details, price: details.hourlyRate as number, priceUnit: 'PER_HOUR' };
}

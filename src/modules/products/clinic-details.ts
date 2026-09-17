import { BadRequestException } from '@nestjs/common';

// Clinic & Doctors Cloude: a hospital or clinic (a shop in any of this Cloude's categories)
// lists each of its doctors as a product — qualification, experience, specialisation, which
// days and hours they sit — and can also sell medicines. Anything else (a lab test, an
// X-ray...) stays a plain product with no clinic details. Mirrors frontend/lib/clinic-details.ts.

export const CLINIC_CLOUDE_SLUG = 'clinic-doctors';

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SPECIALISATIONS = [
  'General Physician',
  'Cardiologist',
  'Kidney Specialist (Nephrologist)',
  'Dermatologist',
  'ENT Specialist',
  'Orthopedic',
  'Neurologist',
  'Pediatrician',
  'Gynecologist',
  'Eye Specialist',
  'Dentist',
  'Psychiatrist',
  'Gastroenterologist',
  'Pulmonologist',
  'Urologist',
  'Oncologist',
  'Diabetologist',
  'General Surgeon',
  'Physiotherapist',
  'Radiologist',
  'Pathologist',
  'Other',
];

export const MEDICINE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Ointment', 'Drops', 'Powder', 'Inhaler', 'Other'];

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

function oneOf(raw: Raw, key: string, label: string, options: string[]): string {
  const value = raw[key];
  if (typeof value !== 'string' || !options.includes(value)) throw new BadRequestException(`Please choose: ${label}.`);
  return value;
}

/** 'HH:MM', 24-hour — what an <input type="time"> sends. */
function optionalTime(raw: Raw, key: string, label: string): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new BadRequestException(`Please pick a valid time for: ${label}.`);
  }
  return value;
}

/** One sitting of the doctor (from–to). The second, evening sitting is optional. */
function sitting(raw: Raw, fromKey: string, toKey: string, label: string, required: boolean) {
  const from = optionalTime(raw, fromKey, `${label} (from)`);
  const to = optionalTime(raw, toKey, `${label} (to)`);
  if (!from && !to && !required) return undefined;
  if (!from || !to) throw new BadRequestException(`Please fill in both times for: ${label}.`);
  if (from === to) throw new BadRequestException(`${label} can't start and end at the same time.`);
  return { from, to };
}

function normalizeDoctor(raw: Raw): Raw {
  const specialisation = oneOf(raw, 'specialisation', 'Specialisation', SPECIALISATIONS);

  const experienceYears = Number(raw.experienceYears);
  if (raw.experienceYears === '' || raw.experienceYears == null || !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 70) {
    throw new BadRequestException('Experience must be a whole number of years (0–70).');
  }

  const days = Array.isArray(raw.days) ? raw.days : [];
  if (days.length === 0 || days.some((day) => typeof day !== 'string' || !WEEK_DAYS.includes(day))) {
    throw new BadRequestException('Please choose the days the doctor sits in the hospital.');
  }

  const first = sitting(raw, 'timeFrom', 'timeTo', 'Timing', true)!;
  const second = sitting(raw, 'timeFrom2', 'timeTo2', 'Second session', false);

  const details: Raw = {
    type: 'DOCTOR',
    specialisation,
    qualification: text(raw, 'qualification', 'Qualification', 120),
    experienceYears,
    // Stored in week order, whatever order the seller tapped them in.
    days: WEEK_DAYS.filter((day) => days.includes(day)),
    timeFrom: first.from,
    timeTo: first.to,
  };
  if (specialisation === 'Other') details.otherSpecialisation = text(raw, 'otherSpecialisation', 'Specialisation', 80);
  if (second) Object.assign(details, { timeFrom2: second.from, timeTo2: second.to });
  const registrationNo = optionalText(raw, 'registrationNo', 40);
  if (registrationNo) details.registrationNo = registrationNo;
  return details;
}

/** 'YYYY-MM' in IST — a medicine expiring this month stays on sale until the month is over in India. */
function currentMonth() {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 7);
}

/** True for a medicine whose expiry month is already over — it can't be bought any more. */
export function isExpiredMedicine(clinicDetails: unknown): boolean {
  const d = (clinicDetails ?? {}) as Raw;
  return d.type === 'MEDICINE' && typeof d.expiryDate === 'string' && d.expiryDate < currentMonth();
}

function normalizeMedicine(raw: Raw): Raw {
  if (typeof raw.prescriptionRequired !== 'boolean') {
    throw new BadRequestException('Please choose whether this medicine needs a prescription.');
  }

  const details: Raw = {
    type: 'MEDICINE',
    form: oneOf(raw, 'form', 'Medicine type', MEDICINE_FORMS),
    composition: text(raw, 'composition', 'Composition / salt', 200),
    packSize: text(raw, 'packSize', 'Pack size', 80),
    prescriptionRequired: raw.prescriptionRequired,
  };
  const manufacturer = optionalText(raw, 'manufacturer', 120);
  if (manufacturer) details.manufacturer = manufacturer;

  if (raw.expiryDate) {
    const expiry = raw.expiryDate;
    if (typeof expiry !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(expiry)) {
      throw new BadRequestException('Please pick a valid expiry month.');
    }
    if (expiry < currentMonth()) throw new BadRequestException("This medicine is past its expiry — expired medicines can't be sold.");
    details.expiryDate = expiry;
  }
  return details;
}

/**
 * Validates a doctor's or medicine's details and returns a clean copy (only known fields,
 * trimmed, typed), plus whether it's a service: booking a doctor is an appointment — the
 * patient says when they'll arrive and pays online — while a medicine is bought like any product.
 */
export function normalizeClinicDetails(input: unknown): { clinicDetails: Raw; isService: boolean } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the doctor or medicine details.');
  }
  const raw = input as Raw;
  if (raw.type === 'DOCTOR') return { clinicDetails: normalizeDoctor(raw), isService: true };
  if (raw.type === 'MEDICINE') return { clinicDetails: normalizeMedicine(raw), isService: false };
  throw new BadRequestException('Please choose whether this is a doctor or a medicine.');
}

import { BadRequestException } from '@nestjs/common';

// Education Cloude: an institute, coaching centre, tutor, counsellor or book / stationery shop
// (a shop in any of this Cloude's categories) lists what it offers as products — a course
// (duration, mode, certificate, fee), a class (subject, which classes it's for, who teaches,
// days and timing, fee), a counselling service (types of counselling, fields covered, how
// sessions happen, fee) or a new / used book. Anything else (a pen, a notebook, a uniform...)
// stays a plain product with no education details. Mirrors frontend/lib/education-details.ts.

export const EDUCATION_CLOUDE_SLUG = 'education';

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CLASS_LEVELS = [
  'Nursery / KG',
  ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  'College',
  'Competitive Exams',
  'Adults',
];

export const COURSE_MODES = ['OFFLINE', 'ONLINE', 'HYBRID'];
export const CLASS_MODES = ['OFFLINE', 'ONLINE', 'HOME', 'HYBRID'];
export const SESSION_MODES = ['IN_PERSON', 'ONLINE', 'PHONE'];
export const DURATION_UNITS = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'];
export const USED_CONDITIONS = ['LIKE_NEW', 'GOOD', 'FAIR'];

/** What the fee is per — the first option of each type is the form's default. */
export const FEE_UNITS: Record<'COURSE' | 'CLASS' | 'COUNSELLING', string[]> = {
  COURSE: ['TOTAL', 'PER_MONTH'],
  CLASS: ['PER_MONTH', 'TOTAL', 'PER_CLASS'],
  COUNSELLING: ['PER_SESSION', 'TOTAL'],
};

export const COUNSELLING_TYPES = [
  'Career Counselling',
  'Admission Guidance',
  'Stream Selection (after 10th)',
  'Course & College Selection',
  'Study Abroad',
  'Competitive Exam Guidance',
  'Scholarship & Education Loan',
  'Aptitude / Psychometric Test',
  'Exam Stress & Wellbeing',
  'Parent Counselling',
  'Other',
];

export const COUNSELLING_FIELDS = [
  'All fields',
  'Engineering',
  'Medical',
  'Commerce & CA',
  'Arts & Humanities',
  'Science & Research',
  'Law',
  'Management / MBA',
  'IT & Computers',
  'Government Jobs',
  'Defence',
  'Design & Fashion',
  'Media & Journalism',
  'Hotel Management',
  'Teaching',
  'Sports',
];

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

/** A multi-select — stored in the options' order, whatever order the seller tapped them in. */
function someOf(raw: Raw, key: string, label: string, options: string[], required: boolean): string[] | undefined {
  const value = Array.isArray(raw[key]) ? (raw[key] as unknown[]) : [];
  if (value.some((item) => typeof item !== 'string' || !options.includes(item))) {
    throw new BadRequestException(`Please choose valid options for: ${label}.`);
  }
  if (value.length === 0) {
    if (required) throw new BadRequestException(`Please choose at least one: ${label}.`);
    return undefined;
  }
  return options.filter((option) => value.includes(option));
}

function optionalInt(raw: Raw, key: string, label: string, min: number, max: number): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label} must be a whole number (${min}–${max}).`);
  return n;
}

function int(raw: Raw, key: string, label: string, min: number, max: number): number {
  const value = optionalInt(raw, key, label, min, max);
  if (value === undefined) throw new BadRequestException(`Please fill in: ${label}.`);
  return value;
}

function yesNo(raw: Raw, key: string, label: string): boolean {
  if (typeof raw[key] !== 'boolean') throw new BadRequestException(`Please choose: ${label}.`);
  return raw[key] as boolean;
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

/** The class's / batch's timing (from–to). */
function timing(raw: Raw, label: string, required: boolean) {
  const from = optionalTime(raw, 'timeFrom', `${label} (from)`);
  const to = optionalTime(raw, 'timeTo', `${label} (to)`);
  if (!from && !to && !required) return undefined;
  if (!from || !to) throw new BadRequestException(`Please fill in both times for: ${label}.`);
  if (from === to) throw new BadRequestException(`${label} can't start and end at the same time.`);
  return { timeFrom: from, timeTo: to };
}

/** Optional duration — a number plus days / weeks / months / years. */
function duration(raw: Raw, label: string, required: boolean) {
  const value = required ? int(raw, 'durationValue', label, 1, 999) : optionalInt(raw, 'durationValue', label, 1, 999);
  if (value === undefined) return undefined;
  return { durationValue: value, durationUnit: oneOf(raw, 'durationUnit', `${label} (days / weeks / months / years)`, DURATION_UNITS) };
}

/** Drops the keys the seller left empty so the stored JSON only has what they filled in. */
function compact(details: Raw): Raw {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

function normalizeCourse(raw: Raw): Raw {
  const batchStart = raw.batchStart;
  if (batchStart !== undefined && batchStart !== null && batchStart !== '') {
    if (typeof batchStart !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(batchStart)) {
      throw new BadRequestException('Please pick a valid date for: Next batch starts.');
    }
  }
  return compact({
    type: 'COURSE',
    mode: oneOf(raw, 'mode', 'Mode (online / offline)', COURSE_MODES),
    ...duration(raw, 'Course duration', true),
    certificate: yesNo(raw, 'certificate', 'Certificate given?'),
    eligibility: optionalText(raw, 'eligibility', 120),
    trainer: optionalText(raw, 'trainer', 120),
    batchStart: batchStart || undefined,
    days: someOf(raw, 'days', 'Batch days', WEEK_DAYS, false),
    ...timing(raw, 'Batch timing', false),
    seats: optionalInt(raw, 'seats', 'Seats', 1, 5000),
    feeUnit: oneOf(raw, 'feeUnit', 'Fee is per', FEE_UNITS.COURSE),
  });
}

function normalizeClass(raw: Raw): Raw {
  return compact({
    type: 'CLASS',
    subjects: text(raw, 'subjects', 'Subject(s)', 120),
    levels: someOf(raw, 'levels', 'For which class', CLASS_LEVELS, true),
    teacherName: text(raw, 'teacherName', 'Who teaches', 80),
    teacherQualification: optionalText(raw, 'teacherQualification', 120),
    experienceYears: optionalInt(raw, 'experienceYears', "Teacher's experience", 0, 70),
    mode: oneOf(raw, 'mode', 'Mode (online / offline / home)', CLASS_MODES),
    days: someOf(raw, 'days', 'Class days', WEEK_DAYS, true),
    ...timing(raw, 'Class timing', true),
    ...duration(raw, 'Course length', false),
    batchSize: optionalInt(raw, 'batchSize', 'Batch size', 1, 1000),
    feeUnit: oneOf(raw, 'feeUnit', 'Fee is per', FEE_UNITS.CLASS),
  });
}

function normalizeCounselling(raw: Raw): Raw {
  const counsellingTypes = someOf(raw, 'counsellingTypes', 'Types of counselling', COUNSELLING_TYPES, true)!;
  return compact({
    type: 'COUNSELLING',
    counsellingTypes,
    otherType: counsellingTypes.includes('Other') ? text(raw, 'otherType', 'Other counselling type', 80) : undefined,
    fields: someOf(raw, 'fields', 'Fields covered', COUNSELLING_FIELDS, true),
    sessionModes: someOf(raw, 'sessionModes', 'How sessions happen', SESSION_MODES, true),
    sessionMinutes: optionalInt(raw, 'sessionMinutes', 'Session length (minutes)', 5, 600),
    counsellorName: optionalText(raw, 'counsellorName', 80),
    qualification: optionalText(raw, 'qualification', 120),
    experienceYears: optionalInt(raw, 'experienceYears', "Counsellor's experience", 0, 70),
    days: someOf(raw, 'days', 'Available days', WEEK_DAYS, false),
    ...timing(raw, 'Available timing', false),
    feeUnit: oneOf(raw, 'feeUnit', 'Fee is per', FEE_UNITS.COUNSELLING),
  });
}

function normalizeBook(raw: Raw): Raw {
  const condition = oneOf(raw, 'condition', 'New or used', ['NEW', 'USED']);
  const mrp = raw.mrp;
  if (mrp !== undefined && mrp !== null && mrp !== '' && (!Number.isFinite(Number(mrp)) || Number(mrp) < 0)) {
    throw new BadRequestException('Printed price (MRP) must be a valid amount.');
  }
  return compact({
    type: 'BOOK',
    condition,
    usedCondition: condition === 'USED' ? oneOf(raw, 'usedCondition', "Book's condition", USED_CONDITIONS) : undefined,
    author: optionalText(raw, 'author', 120),
    publisher: optionalText(raw, 'publisher', 120),
    forClass: optionalText(raw, 'forClass', 80),
    edition: optionalText(raw, 'edition', 40),
    mrp: mrp === undefined || mrp === null || mrp === '' ? undefined : Number(mrp),
  });
}

/**
 * Validates a course's, class's, counselling service's or book's details and returns a clean
 * copy (only known fields, trimmed, typed), plus whether it's a service: enrolling in a course
 * or class, or booking a counselling session, is paid online and the student visits — while a
 * book is bought like any product (takeaway / delivery).
 */
export function normalizeEducationDetails(input: unknown): { educationDetails: Raw; isService: boolean } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the course, class, counselling or book details.');
  }
  const raw = input as Raw;
  if (raw.type === 'COURSE') return { educationDetails: normalizeCourse(raw), isService: true };
  if (raw.type === 'CLASS') return { educationDetails: normalizeClass(raw), isService: true };
  if (raw.type === 'COUNSELLING') return { educationDetails: normalizeCounselling(raw), isService: true };
  if (raw.type === 'BOOK') return { educationDetails: normalizeBook(raw), isService: false };
  throw new BadRequestException('Please choose whether this is a course, a class, counselling or a book.');
}

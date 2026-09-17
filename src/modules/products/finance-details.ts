import { BadRequestException } from '@nestjs/common';

// Financing Cloude: a bank correspondent, DSA, agency, CA firm or advisor (a shop in any
// of this Cloude's categories) lists what it offers as products — a LOAN scheme (amount
// range, interest rate and type, tenure, processing fee and every other charge, eligibility,
// the papers it wants and its written conditions), an INSURANCE policy, an INVESTMENT
// product, or a paid SERVICE (ITR / GST filing, accounting, mini bank...). Anything else
// stays a plain product. Mirrors frontend/lib/finance-details.ts.

export const FINANCING_CLOUDE_SLUG = 'financing';

export type FinanceItemType = 'LOAN' | 'INSURANCE' | 'INVESTMENT' | 'SERVICE';

export const INTEREST_TYPES = ['REDUCING', 'FLAT'];
export const REPAYMENT_FREQUENCIES = ['MONTHLY', 'WEEKLY', 'DAILY'];
export const CHARGE_TYPES = ['NONE', 'PERCENT', 'FIXED'];
export const SECURITY_TYPES = ['UNSECURED', 'GOLD', 'PROPERTY', 'VEHICLE', 'FD', 'OTHER'];
export const EMPLOYMENT_TYPES = ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'FARMER', 'STUDENT', 'PENSIONER'];

export const POLICY_TYPES = ['LIFE', 'HEALTH', 'VEHICLE', 'PROPERTY', 'OTHER'];
export const PREMIUM_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'SINGLE'];

export const INVESTMENT_TYPES = ['MUTUAL_FUND', 'SIP', 'FD', 'BONDS', 'DEMAT', 'ADVISORY', 'OTHER'];
export const RETURN_TYPES = ['FIXED', 'MARKET_LINKED'];
export const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH'];

export const SERVICE_FEE_UNITS = ['ONE_TIME', 'PER_FILING', 'PER_MONTH', 'PER_YEAR', 'PER_TRANSACTION'];

// Every paper an agency can ask an applicant for. PAN and Aadhaar are asked for on every
// application (see finance/documents.ts) — the rest are whatever the scheme needs.
export const DOCUMENT_TYPES = [
  'PAN_CARD',
  'AADHAAR_CARD',
  'PASSPORT_PHOTO',
  'ADDRESS_PROOF',
  'BANK_STATEMENT',
  'SALARY_SLIP',
  'FORM_16',
  'ITR',
  'INCOME_PROOF',
  'CANCELLED_CHEQUE',
  'BUSINESS_PROOF',
  'GST_CERTIFICATE',
  'PROPERTY_PAPERS',
  'VEHICLE_RC',
  'DRIVING_LICENCE',
  'MEDICAL_REPORT',
  'EXISTING_POLICY',
  'NOMINEE_ID',
  'SIGNATURE',
  'OTHER',
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

function optionalMoney(raw: Raw, key: string, label: string, max = 1_000_000_000): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequestException(`${label} must be a valid amount.`);
  return Math.round(n);
}

function money(raw: Raw, key: string, label: string, max?: number): number {
  const value = optionalMoney(raw, key, label, max);
  if (value === undefined) throw new BadRequestException(`Please fill in: ${label}.`);
  return value;
}

/** A rate / percentage — kept to two decimals (10.75% p.a., 1.5% processing fee). */
function optionalRate(raw: Raw, key: string, label: string, max = 100): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequestException(`${label} must be between 0 and ${max}.`);
  return Math.round(n * 100) / 100;
}

function rate(raw: Raw, key: string, label: string, max = 100): number {
  const value = optionalRate(raw, key, label, max);
  if (value === undefined) throw new BadRequestException(`Please fill in: ${label}.`);
  return value;
}

function optionalInt(raw: Raw, key: string, label: string, min: number, max: number): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label} must be a whole number (${min}-${max}).`);
  return n;
}

function int(raw: Raw, key: string, label: string, min: number, max: number): number {
  const value = optionalInt(raw, key, label, min, max);
  if (value === undefined) throw new BadRequestException(`Please fill in: ${label}.`);
  return value;
}

function yesNo(raw: Raw, key: string): boolean {
  return raw[key] === true || raw[key] === 'YES';
}

/** Drops the keys the seller left empty so the stored JSON only has what they filled in. */
function compact(details: Raw): Raw {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

/** A "from / to" pair — an agency quoting 5-15 lakh can't have the smaller number second. */
function range(min: number, max: number | undefined, label: string) {
  if (max !== undefined && max < min) throw new BadRequestException(`${label}: the maximum can't be less than the minimum.`);
  return max;
}

/** A charge the agency levies: none, a percentage of the amount, or a flat rupee figure. */
function charge(raw: Raw, typeKey: string, valueKey: string, label: string) {
  const type = oneOf(raw, typeKey, label, CHARGE_TYPES);
  if (type === 'NONE') return { [typeKey]: type };
  return {
    [typeKey]: type,
    [valueKey]: type === 'PERCENT' ? rate(raw, valueKey, label, 50) : money(raw, valueKey, label, 10_000_000),
  };
}

/** The papers the agency wants with an application — PAN and Aadhaar are always included. */
function documents(raw: Raw): string[] {
  const chosen = someOf(raw, 'documents', 'Documents required', DOCUMENT_TYPES, false) ?? [];
  const all = new Set(['PAN_CARD', 'AADHAAR_CARD', ...chosen]);
  return DOCUMENT_TYPES.filter((doc) => all.has(doc));
}

/** The agency's written conditions, one per line — what the applicant has to agree to. */
function terms(raw: Raw, required: boolean): string | undefined {
  const value = optionalText(raw, 'terms', 4000);
  if (!value && required) throw new BadRequestException('Please write the terms & conditions of this scheme.');
  return value;
}

function normalizeLoan(raw: Raw): Raw {
  const amountMin = money(raw, 'amountMin', 'Minimum loan amount');
  const rateMin = rate(raw, 'interestRateMin', 'Interest rate (from)', 100);
  const tenureMin = int(raw, 'tenureMin', 'Minimum tenure (months)', 1, 480);

  return compact({
    type: 'LOAN',
    amountMin,
    amountMax: range(amountMin, optionalMoney(raw, 'amountMax', 'Maximum loan amount'), 'Loan amount'),
    interestRateMin: rateMin,
    interestRateMax: range(rateMin, optionalRate(raw, 'interestRateMax', 'Interest rate (to)'), 'Interest rate'),
    interestType: oneOf(raw, 'interestType', 'Interest type (reducing / flat)', INTEREST_TYPES),
    tenureMin,
    tenureMax: range(tenureMin, optionalInt(raw, 'tenureMax', 'Maximum tenure (months)', 1, 480), 'Tenure'),
    repaymentFrequency: oneOf(raw, 'repaymentFrequency', 'Repayment frequency', REPAYMENT_FREQUENCIES),
    ...charge(raw, 'processingFeeType', 'processingFee', 'Processing fee'),
    ...charge(raw, 'prepaymentChargeType', 'prepaymentCharge', 'Part-prepayment charge'),
    ...charge(raw, 'foreclosureChargeType', 'foreclosureCharge', 'Foreclosure / preclosure charge'),
    latePaymentPenalty: optionalRate(raw, 'latePaymentPenalty', 'Late payment penalty (% per month)', 25),
    bounceCharge: optionalMoney(raw, 'bounceCharge', 'Cheque / ECS bounce charge', 100_000),
    gstOnCharges: yesNo(raw, 'gstOnCharges'),
    otherCharges: optionalText(raw, 'otherCharges', 500),
    securityType: oneOf(raw, 'securityType', 'Security / collateral', SECURITY_TYPES),
    collateralNote: optionalText(raw, 'collateralNote', 300),
    guarantorRequired: yesNo(raw, 'guarantorRequired'),
    employmentTypes: someOf(raw, 'employmentTypes', 'Who can apply', EMPLOYMENT_TYPES, true),
    minAge: optionalInt(raw, 'minAge', 'Minimum age', 18, 100),
    maxAge: optionalInt(raw, 'maxAge', 'Maximum age', 18, 100),
    minMonthlyIncome: optionalMoney(raw, 'minMonthlyIncome', 'Minimum monthly income', 100_000_000),
    minCreditScore: optionalInt(raw, 'minCreditScore', 'Minimum CIBIL score', 300, 900),
    minBusinessYears: optionalInt(raw, 'minBusinessYears', 'Minimum years in business', 0, 60),
    disbursalDays: optionalInt(raw, 'disbursalDays', 'Disbursal time (days)', 0, 365),
    documents: documents(raw),
    terms: terms(raw, true),
  });
}

function normalizeInsurance(raw: Raw): Raw {
  const coverMin = money(raw, 'coverMin', 'Minimum cover (sum assured)');
  return compact({
    type: 'INSURANCE',
    policyType: oneOf(raw, 'policyType', 'Type of insurance', POLICY_TYPES),
    insurerName: text(raw, 'insurerName', 'Insurance company', 120),
    coverMin,
    coverMax: range(coverMin, optionalMoney(raw, 'coverMax', 'Maximum cover'), 'Cover'),
    premiumFrequency: oneOf(raw, 'premiumFrequency', 'Premium is paid', PREMIUM_FREQUENCIES),
    policyTermMin: optionalInt(raw, 'policyTermMin', 'Policy term (from, years)', 1, 100),
    policyTermMax: optionalInt(raw, 'policyTermMax', 'Policy term (to, years)', 1, 100),
    entryAgeMin: optionalInt(raw, 'entryAgeMin', 'Minimum entry age', 0, 100),
    entryAgeMax: optionalInt(raw, 'entryAgeMax', 'Maximum entry age', 0, 100),
    waitingPeriodDays: optionalInt(raw, 'waitingPeriodDays', 'Waiting period (days)', 0, 2000),
    claimRatio: optionalRate(raw, 'claimRatio', 'Claim settlement ratio (%)'),
    freeLookDays: optionalInt(raw, 'freeLookDays', 'Free-look period (days)', 0, 90),
    gstOnPremium: yesNo(raw, 'gstOnPremium'),
    taxBenefit: yesNo(raw, 'taxBenefit'),
    coverageIncludes: optionalText(raw, 'coverageIncludes', 2000),
    exclusions: optionalText(raw, 'exclusions', 2000),
    documents: documents(raw),
    terms: terms(raw, true),
  });
}

function normalizeInvestment(raw: Raw): Raw {
  const returnMin = optionalRate(raw, 'expectedReturnMin', 'Expected return (from)');
  return compact({
    type: 'INVESTMENT',
    investmentType: oneOf(raw, 'investmentType', 'Type of investment', INVESTMENT_TYPES),
    provider: optionalText(raw, 'provider', 120),
    minInvestment: money(raw, 'minInvestment', 'Minimum investment'),
    minSip: optionalMoney(raw, 'minSip', 'Minimum SIP amount', 100_000_000),
    returnType: oneOf(raw, 'returnType', 'Return type (fixed / market-linked)', RETURN_TYPES),
    expectedReturnMin: returnMin,
    expectedReturnMax:
      returnMin === undefined ? undefined : range(returnMin, optionalRate(raw, 'expectedReturnMax', 'Expected return (to)'), 'Expected return'),
    tenureMonths: optionalInt(raw, 'tenureMonths', 'Tenure (months)', 1, 600),
    lockInMonths: optionalInt(raw, 'lockInMonths', 'Lock-in period (months)', 0, 600),
    riskLevel: oneOf(raw, 'riskLevel', 'Risk level', RISK_LEVELS),
    exitLoad: optionalRate(raw, 'exitLoad', 'Exit load (%)', 25),
    expenseRatio: optionalRate(raw, 'expenseRatio', 'Expense ratio (%)', 25),
    payoutNote: optionalText(raw, 'payoutNote', 300),
    documents: documents(raw),
    terms: terms(raw, true),
  });
}

function normalizeService(raw: Raw): Raw {
  return compact({
    type: 'SERVICE',
    feeUnit: oneOf(raw, 'feeUnit', 'Fee is', SERVICE_FEE_UNITS),
    turnaroundDays: optionalInt(raw, 'turnaroundDays', 'Turnaround time (days)', 0, 365),
    govtFeeExtra: yesNo(raw, 'govtFeeExtra'),
    gstExtra: yesNo(raw, 'gstExtra'),
    includes: optionalText(raw, 'includes', 2000),
    documents: documents(raw),
    terms: terms(raw, false),
  });
}

/**
 * Validates a loan scheme's, policy's, investment product's or financial service's details
 * and returns a clean copy (only known fields, trimmed, typed). A loan and an investment
 * have no single "price" — their cost is the interest rate / minimum investment inside the
 * details — so the product's price is cleared; a policy's price is its premium and a
 * service's is its fee.
 */
export function normalizeFinanceDetails(input: unknown): { financeDetails: Raw; pricedProduct: boolean } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Please fill in the scheme details.');
  }
  const raw = input as Raw;
  if (raw.type === 'LOAN') return { financeDetails: normalizeLoan(raw), pricedProduct: false };
  if (raw.type === 'INSURANCE') return { financeDetails: normalizeInsurance(raw), pricedProduct: true };
  if (raw.type === 'INVESTMENT') return { financeDetails: normalizeInvestment(raw), pricedProduct: false };
  if (raw.type === 'SERVICE') return { financeDetails: normalizeService(raw), pricedProduct: true };
  throw new BadRequestException('Please choose whether this is a loan, insurance, an investment or a service.');
}

export function financeItemType(details: unknown): FinanceItemType | null {
  const type = (details as Raw | null | undefined)?.type;
  return typeof type === 'string' && ['LOAN', 'INSURANCE', 'INVESTMENT', 'SERVICE'].includes(type)
    ? (type as FinanceItemType)
    : null;
}

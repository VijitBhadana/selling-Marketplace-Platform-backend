// The repayment working behind a loan application: the instalment, what the borrower pays
// back in total, what the agency deducts up front, and what actually reaches the bank
// account. It is computed here (never trusted from the browser) and stored on the
// application, so the figures the borrower agreed to survive any later edit to the scheme.
// Mirrors frontend/lib/finance-details.ts.

export const GST_RATE = 18;

type Raw = Record<string, any>;

/** How many instalments a tenure in months works out to, and how many fall in a year. */
export function instalmentPlan(months: number, frequency = 'MONTHLY') {
  if (frequency === 'WEEKLY') return { count: Math.max(1, Math.round((months * 52) / 12)), perYear: 52 };
  if (frequency === 'DAILY') return { count: Math.max(1, months * 30), perYear: 365 };
  return { count: Math.max(1, months), perYear: 12 };
}

const round = (value: number) => Math.round(value);

/** A charge the agency levies: NONE, a percentage of the amount, or a flat figure. */
export function chargeAmount(type: string | undefined, value: number | undefined, base: number) {
  if (type === 'PERCENT') return round((base * (Number(value) || 0)) / 100);
  if (type === 'FIXED') return round(Number(value) || 0);
  return 0;
}

export type LoanQuote = {
  principal: number;
  annualRate: number;
  interestType: string;
  tenureMonths: number;
  repaymentFrequency: string;
  instalmentCount: number;
  instalment: number;
  totalInterest: number;
  totalPayable: number;
  processingFee: number;
  gstOnFee: number;
  netDisbursal: number;
};

/**
 * Works out the instalment and totals for a loan.
 *
 * REDUCING balance — the standard EMI formula, interest charged only on what is still
 * owed: E = P·r·(1+r)^n / ((1+r)^n − 1), with r the rate for one instalment period.
 * FLAT rate — interest is charged on the full principal for the whole tenure, then the
 * lot is split evenly across the instalments (common with gold and micro loans, and
 * always dearer than the same number quoted on reducing balance).
 */
export function loanQuote(details: Raw, principal: number, tenureMonths: number, annualRateOverride?: number): LoanQuote {
  const annualRate = annualRateOverride ?? (Number(details.interestRateMin) || 0);
  const interestType = details.interestType === 'FLAT' ? 'FLAT' : 'REDUCING';
  const frequency = typeof details.repaymentFrequency === 'string' ? details.repaymentFrequency : 'MONTHLY';
  const { count, perYear } = instalmentPlan(tenureMonths, frequency);

  let instalment: number;
  let totalPayable: number;
  if (interestType === 'FLAT') {
    const interest = (principal * annualRate * tenureMonths) / (100 * 12);
    totalPayable = principal + interest;
    instalment = totalPayable / count;
  } else {
    const r = annualRate / 100 / perYear;
    instalment = r === 0 ? principal / count : (principal * r * (1 + r) ** count) / ((1 + r) ** count - 1);
    totalPayable = instalment * count;
  }

  const processingFee = chargeAmount(details.processingFeeType, details.processingFee, principal);
  const gstOnFee = details.gstOnCharges ? round((processingFee * GST_RATE) / 100) : 0;

  return {
    principal: round(principal),
    annualRate,
    interestType,
    tenureMonths,
    repaymentFrequency: frequency,
    instalmentCount: count,
    instalment: round(instalment),
    totalInterest: round(totalPayable - principal),
    totalPayable: round(totalPayable),
    processingFee,
    gstOnFee,
    netDisbursal: round(principal - processingFee - gstOnFee),
  };
}

/** What a policy costs over its term: the premium, the GST on it, and the total outgo. */
export function premiumQuote(details: Raw, premium: number, years?: number) {
  const gst = details.gstOnPremium ? round((premium * GST_RATE) / 100) : 0;
  const frequency = typeof details.premiumFrequency === 'string' ? details.premiumFrequency : 'YEARLY';
  const perYear = { MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1, SINGLE: 0 }[frequency] ?? 1;
  const term = years && years > 0 ? years : undefined;
  return {
    premium: round(premium),
    gstOnPremium: gst,
    payablePerInstalment: round(premium + gst),
    premiumFrequency: frequency,
    ...(term ? { policyTermYears: term, totalOutgo: round((premium + gst) * (perYear === 0 ? 1 : perYear * term)) } : {}),
  };
}

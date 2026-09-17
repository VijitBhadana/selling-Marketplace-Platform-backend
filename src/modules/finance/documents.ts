import { BadRequestException } from '@nestjs/common';
import { DOCUMENT_TYPES } from '../products/finance-details';

// The KYC / income papers an applicant uploads with a finance application. Which ones are
// asked for is the agency's choice (products/finance-details.ts), except PAN and Aadhaar —
// no lender, insurer or advisor in India opens a file without those two, so every scheme
// asks for them. Mirrors frontend/lib/finance-details.ts.

export const ALWAYS_REQUIRED = ['PAN_CARD', 'AADHAAR_CARD'];

export const DOCUMENT_LABELS: Record<string, string> = {
  PAN_CARD: 'PAN card',
  AADHAAR_CARD: 'Aadhaar card',
  PASSPORT_PHOTO: 'Passport-size photo',
  ADDRESS_PROOF: 'Address proof',
  BANK_STATEMENT: 'Bank statement (last 6 months)',
  SALARY_SLIP: 'Salary slips (last 3 months)',
  FORM_16: 'Form 16',
  ITR: 'Income tax return (ITR)',
  INCOME_PROOF: 'Income proof',
  CANCELLED_CHEQUE: 'Cancelled cheque',
  BUSINESS_PROOF: 'Business proof / Udyam certificate',
  GST_CERTIFICATE: 'GST registration certificate',
  PROPERTY_PAPERS: 'Property papers',
  VEHICLE_RC: 'Vehicle RC',
  DRIVING_LICENCE: 'Driving licence',
  MEDICAL_REPORT: 'Medical report',
  EXISTING_POLICY: 'Existing policy copy',
  NOMINEE_ID: "Nominee's ID proof",
  SIGNATURE: 'Signature specimen',
  OTHER: 'Other document',
};

/** Documents whose number the applicant also types in, and how that number is checked. */
const NUMBER_RULES: Record<string, { label: string; test: (value: string) => boolean; hint: string }> = {
  PAN_CARD: {
    label: 'PAN number',
    test: (value) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value),
    hint: 'A PAN number looks like ABCDE1234F.',
  },
  AADHAAR_CARD: {
    label: 'Aadhaar number',
    test: (value) => /^[2-9][0-9]{11}$/.test(value),
    hint: 'An Aadhaar number is 12 digits and cannot start with 0 or 1.',
  },
};

export function documentNumberLabel(docType: string) {
  return NUMBER_RULES[docType]?.label;
}

// Scanned papers are stored as base64 data URLs, the same way resumes and photos are.
// 5 MB each, and at most 12 files, keeps one application inside a normal request body.
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS = 12;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

type IncomingDocument = { docType: string; docNumber?: string; fileName: string; dataUrl: string };

/** Roughly how many bytes a base64 data URL carries — 4 base64 chars per 3 bytes. */
function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Checks the papers the applicant uploaded against the ones this scheme asks for: every
 * required document present exactly once, a readable file, and a valid PAN / Aadhaar
 * number where one is typed in. Returns them in the scheme's own order.
 */
export function normalizeDocuments(required: string[], input: unknown): IncomingDocument[] {
  const wanted = DOCUMENT_TYPES.filter((doc) => required.includes(doc) || ALWAYS_REQUIRED.includes(doc));
  const list = Array.isArray(input) ? (input as Record<string, unknown>[]) : [];
  if (list.length > MAX_DOCUMENTS) throw new BadRequestException(`You can upload at most ${MAX_DOCUMENTS} documents.`);

  const byType = new Map<string, IncomingDocument>();
  for (const raw of list) {
    const docType = typeof raw?.docType === 'string' ? raw.docType : '';
    if (!DOCUMENT_TYPES.includes(docType)) throw new BadRequestException('Unknown document type in your upload.');
    if (!wanted.includes(docType)) continue; // the agency doesn't ask for this one
    if (byType.has(docType)) throw new BadRequestException(`You uploaded ${DOCUMENT_LABELS[docType]} twice.`);

    const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim().slice(0, 200) : '';
    const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl : '';
    const mime = /^data:([^;,]+)[;,]/.exec(dataUrl)?.[1];
    if (!fileName || !mime || !ALLOWED_MIME.includes(mime)) {
      throw new BadRequestException(`Upload ${DOCUMENT_LABELS[docType]} as a PDF or a photo (JPG / PNG).`);
    }
    if (dataUrlBytes(dataUrl) > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(`${DOCUMENT_LABELS[docType]} must be 5 MB or smaller.`);
    }

    const rule = NUMBER_RULES[docType];
    let docNumber: string | undefined;
    if (rule) {
      docNumber = (typeof raw.docNumber === 'string' ? raw.docNumber : '').trim().toUpperCase().replace(/\s+/g, '');
      if (!rule.test(docNumber)) throw new BadRequestException(`Please enter a valid ${rule.label}. ${rule.hint}`);
    }

    byType.set(docType, { docType, docNumber, fileName, dataUrl });
  }

  const missing = wanted.filter((doc) => !byType.has(doc));
  if (missing.length > 0) {
    throw new BadRequestException(`Please upload: ${missing.map((doc) => DOCUMENT_LABELS[doc]).join(', ')}.`);
  }

  return wanted.map((doc) => byType.get(doc)!);
}

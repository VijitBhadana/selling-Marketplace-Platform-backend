import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_DOCUMENTS } from './documents';

export enum FinanceDecisionDto {
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// One uploaded paper. The file itself is a base64 data URL (same approach as resumes and
// listing photos); its type, size and the PAN / Aadhaar number are checked in documents.ts.
export class FinanceDocumentDto {
  @IsString()
  docType: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  docNumber?: string;

  @IsString()
  @MaxLength(200)
  fileName: string;

  @IsString()
  dataUrl: string;
}

export class ApplyFinanceDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsString()
  @MaxLength(120)
  email: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  /** YYYY-MM-DD — an applicant's age decides whether they meet the scheme's age limits. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateOfBirth?: string;

  @IsString()
  @MaxLength(300)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  /** SALARIED / SELF_EMPLOYED / BUSINESS / FARMER / STUDENT / PENSIONER. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  employerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyIncome?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  existingEmi?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(900)
  creditScore?: number;

  /** The loan amount / cover / investment asked for. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  requestedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  tenureMonths?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nomineeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nomineeRelation?: string;

  /** The applicant ticked the agency's terms & conditions — without it nothing is sent. */
  @IsBoolean()
  acceptedTerms: boolean;

  @IsArray()
  @ArrayMaxSize(MAX_DOCUMENTS)
  documents: FinanceDocumentDto[];
}

export class FinanceDecisionBodyDto {
  @IsEnum(FinanceDecisionDto)
  status: FinanceDecisionDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  // What was actually sanctioned — only read on an approval.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  approvedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  approvedRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  approvedTenure?: number;
}

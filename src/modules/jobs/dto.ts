import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JobType, SalaryPeriod, WorkMode } from '@prisma/client';

export class CreateJobDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  /** Company or startup name. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  companyName: string;

  @IsOptional()
  @IsBoolean()
  isStartup?: boolean;

  /** Full-time / internship / contractual / part-time / freelance. */
  @IsEnum(JobType)
  jobType: JobType;

  /** On-site / remote / hybrid. */
  @IsEnum(WorkMode)
  workMode: WorkMode;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsEnum(SalaryPeriod)
  salaryPeriod: SalaryPeriod;

  /** Required experience, e.g. "Fresher", "1-3 years". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  experience: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  responsibilities: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string;

  /** City. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;
}

export class JobQueryDto {
  @IsOptional()
  @IsString()
  cloudeSlug?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @IsOptional()
  @IsIn(['latest', 'oldest'])
  sort?: 'latest' | 'oldest';

  /** Only jobs posted within the last N days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  postedWithinDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

// PDF / DOC / DOCX resumes, sent as a base64 data URL (same approach as listing photos).
const RESUME_DATA_URL =
  /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,/;
// 5 MB file ≈ 6.7M base64 chars, plus the data-URL prefix.
const RESUME_MAX_DATA_URL_LENGTH = 7_000_000;

export class ApplyJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'Enter a valid phone number' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  /** Total work experience in years. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(60)
  totalExperience: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentCompany?: string;

  /** Current post / designation. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentDesignation?: string;

  /** Current salary, ₹ per year. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentSalary?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  currentLocation: string;

  /** How soon the candidate can join, e.g. "Immediate", "30 days". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  noticePeriod: string;

  @IsString()
  @Matches(RESUME_DATA_URL, { message: 'Resume must be a PDF, DOC or DOCX file' })
  @MaxLength(RESUME_MAX_DATA_URL_LENGTH, { message: 'Resume must be 5 MB or smaller' })
  resumeDataUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  resumeFileName: string;
}

export class ScheduleInterviewDto {
  @IsDateString()
  interviewAt: string;

  /** Mode / meeting link / venue / anything else the candidate should know. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interviewDetails?: string;
}

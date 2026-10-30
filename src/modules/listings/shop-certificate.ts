// Licences / certificates a seller must upload before selling in Food, Clinic & Doctors and
// Sports & Fitness & Gym Cloudes: FSSAI for a food business, the medical registration / drug
// licence / hospital registration for a healthcare one, and the certificate of the field a
// trainer or academy teaches (yoga, karate, gym training...). Asked once when the shop is set
// up, and again for every doctor a Clinic & Doctors shop adds. Every other Cloude asks for none.
// Mirrored in frontend/lib/shop-certificate.ts.
import { BadRequestException } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const CERTIFIED_CLOUDES = ['food', 'clinic-doctors', 'sports-fitness-gym'];

// The photo is resized to ~1600px in the browser; this leaves plenty of room for that.
const MAX_IMAGE_LENGTH = 4_000_000;

export class CertificateDto {
  // Base64 data URL of the certificate photo.
  @IsString()
  image: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  number?: string;
}

const CLINIC_PHARMACY = ['pharmacy-medical-store'];
const CLINIC_DIAGNOSTICS = ['x-ray', 'radiology', 'pathology-lab'];
const CLINIC_HOSPITALS = [
  'hospitals-offering-treatment',
  'comparative-affordable-options',
  'hospital-details-facilities',
  'emergency-services',
];
const CLINIC_NURSING = ['home-nursing-patient-care'];
const CLINIC_OTHER = ['other-healthcare-related-services', 'other-services-products'];

/** What a shop in this category has to upload, or null when it needs no certificate. */
export function shopCertificateTitle(cloudeSlug: string, categorySlug: string, categoryName: string): string | null {
  if (cloudeSlug === 'food') return 'FSSAI licence / registration certificate';
  if (cloudeSlug === 'clinic-doctors') {
    if (CLINIC_PHARMACY.includes(categorySlug)) return 'Drug licence';
    if (CLINIC_DIAGNOSTICS.includes(categorySlug)) return 'Diagnostic centre / lab registration certificate';
    if (CLINIC_HOSPITALS.includes(categorySlug)) return 'Hospital / clinic registration certificate';
    if (CLINIC_NURSING.includes(categorySlug)) return 'Nursing registration / training certificate';
    if (CLINIC_OTHER.includes(categorySlug)) return 'Medical registration / licence certificate';
    if (categorySlug === 'physiotherapy') return "Physiotherapist's registration / degree certificate";
    return "Doctor's medical registration certificate";
  }
  if (cloudeSlug === 'sports-fitness-gym') {
    if (categorySlug === 'gym-equipment-items') return 'Shop registration / trade licence';
    if (categorySlug === 'other-services-products') return 'Training / service certificate';
    return `${categoryName} certificate`;
  }
  return null;
}

export const DOCTOR_CERTIFICATE_TITLE = "Doctor's medical registration certificate";

/** The values to store, or a 400 when the photo is missing or isn't an image. */
export function normalizeCertificate(input: CertificateDto | undefined, title: string) {
  const image = input?.image?.trim();
  if (!image) throw new BadRequestException(`Please upload a photo of your ${title}.`);
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
    throw new BadRequestException(`The ${title} must be a photo (JPG, PNG or WebP).`);
  }
  if (image.length > MAX_IMAGE_LENGTH) throw new BadRequestException(`The ${title} photo is too large — please upload a smaller one.`);
  return { title, number: input?.number?.trim() || null, image };
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PUBLICLY_VISIBLE_USER } from '../../common/visibility';
import { CreateProductDto, UpdateProductDto } from './dto';
import { getPropertyType, normalizePropertyListing } from './property-details';
import { CLINIC_CLOUDE_SLUG, normalizeClinicDetails } from './clinic-details';
import { normalizeTransportDetails } from './transport-details';
import { EDUCATION_CLOUDE_SLUG, normalizeEducationDetails } from './education-details';
import { FINANCING_CLOUDE_SLUG, normalizeFinanceDetails } from './finance-details';
import { getBookingKind } from '../cart/booking-details';
import { deleteProductsCascade } from './product-cleanup';

const shopCategory = { cloude: { select: { slug: true } }, category: { select: { slug: true } } } as const;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findForListing(listingId: string) {
    return this.prisma.product.findMany({
      where: { listingId, listing: { seller: PUBLICLY_VISIBLE_USER } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(listingId: string, sellerId: string, dto: CreateProductDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, include: shopCategory });
    if (!listing) throw new NotFoundException('Shop not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your shop');

    return this.prisma.product.create({
      data: {
        ...this.withTransportTerms(
          listing,
          this.withFinanceTerms(listing, this.withEducationTerms(listing, this.withClinicTerms(listing, this.withPropertyTerms(listing, dto)))),
          true,
        ),
        listingId,
      },
    });
  }

  async update(id: string, sellerId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { listing: { include: shopCategory } } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.listing.sellerId !== sellerId) throw new ForbiddenException('Not your product');
    return this.prisma.product.update({
      where: { id },
      data: this.withTransportTerms(
        product.listing,
        this.withFinanceTerms(
          product.listing,
          this.withEducationTerms(product.listing, this.withClinicTerms(product.listing, this.withPropertyTerms(product.listing, dto, product))),
        ),
        false,
      ),
    });
  }

  async remove(id: string, sellerId: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { listing: true } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.listing.sellerId !== sellerId) throw new ForbiddenException('Not your product');
    await this.prisma.$transaction((tx) => deleteProductsCascade(tx, [id]));
  }

  /** Empties a shop: every product in it, plus the order lines that referenced them. */
  async removeAllForListing(listingId: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
    if (!listing) throw new NotFoundException('Shop not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your shop');
    const products = await this.prisma.product.findMany({ where: { listingId }, select: { id: true } });
    await this.prisma.$transaction((tx) => deleteProductsCascade(tx, products.map((p) => p.id)));
    return { deleted: products.length };
  }

  /**
   * Property Cloude: validates the seller's property details and fixes the price unit
   * (rent per month/day/year, or FIXED for sale). Other shops can't store property details.
   */
  private withPropertyTerms<T extends CreateProductDto | UpdateProductDto>(
    listing: { cloude: { slug: string }; category: { slug: string } },
    dto: T,
    current?: { propertyDetails: Prisma.JsonValue; priceUnit: string | null },
  ) {
    const { propertyDetails, ...rest } = dto;
    const type = getPropertyType(listing.cloude.slug, listing.category.slug);
    if (!type) return rest;
    // An edit that doesn't touch the property terms keeps them as they are.
    if (current && propertyDetails === undefined && dto.priceUnit === undefined) return rest;

    const terms = normalizePropertyListing(type, propertyDetails ?? current?.propertyDetails, dto.priceUnit ?? current?.priceUnit);
    return { ...rest, priceUnit: terms.priceUnit, propertyDetails: terms.propertyDetails as Prisma.InputJsonObject };
  }

  /**
   * Clinic & Doctors Cloude: validates a doctor's or medicine's details. A doctor is booked as
   * a service (an appointment), a medicine is bought like any product, and null turns the item
   * back into a plain product (lab test, X-ray...). Other shops can't store clinic details.
   */
  private withClinicTerms<T extends { clinicDetails?: Record<string, unknown> | null }>(listing: { cloude: { slug: string } }, dto: T) {
    const { clinicDetails, ...rest } = dto;
    // An edit that doesn't touch the clinic details keeps them as they are.
    if (listing.cloude.slug !== CLINIC_CLOUDE_SLUG || clinicDetails === undefined) return rest;
    if (clinicDetails === null) return { ...rest, clinicDetails: Prisma.DbNull, isService: false };

    const terms = normalizeClinicDetails(clinicDetails);
    return { ...rest, clinicDetails: terms.clinicDetails as Prisma.InputJsonObject, isService: terms.isService };
  }

  /**
   * Education Cloude: validates a course's, class's, counselling service's or book's details.
   * Enrolling in a course / class or booking counselling is a service (the student visits and
   * pays online), a book is bought like any product, and null turns the item back into a plain
   * product (stationery...). Other shops can't store education details.
   */
  private withEducationTerms<T extends { educationDetails?: Record<string, unknown> | null }>(listing: { cloude: { slug: string } }, dto: T) {
    const { educationDetails, ...rest } = dto;
    // An edit that doesn't touch the education details keeps them as they are.
    if (listing.cloude.slug !== EDUCATION_CLOUDE_SLUG || educationDetails === undefined) return rest;
    if (educationDetails === null) return { ...rest, educationDetails: Prisma.DbNull, isService: false };

    const terms = normalizeEducationDetails(educationDetails);
    return { ...rest, educationDetails: terms.educationDetails as Prisma.InputJsonObject, isService: terms.isService };
  }

  /**
   * Financing Cloude: validates a loan scheme's, insurance policy's, investment product's or
   * financial service's terms. A loan or investment carries no single price (the interest rate
   * / minimum investment lives in the details), so its price is cleared; a policy is priced by
   * its premium and a service by its fee. null turns the item back into a plain product.
   * Other shops can't store finance details.
   */
  private withFinanceTerms<T extends { financeDetails?: Record<string, unknown> | null }>(listing: { cloude: { slug: string } }, dto: T) {
    const { financeDetails, ...rest } = dto;
    // An edit that doesn't touch the scheme's terms keeps them as they are.
    if (listing.cloude.slug !== FINANCING_CLOUDE_SLUG || financeDetails === undefined) return rest;
    if (financeDetails === null) return { ...rest, financeDetails: Prisma.DbNull };

    const terms = normalizeFinanceDetails(financeDetails);
    return {
      ...rest,
      financeDetails: terms.financeDetails as Prisma.InputJsonObject,
      ...(terms.pricedProduct ? {} : { price: null, priceType: 'CONTACT_FOR_PRICE' as const }),
    };
  }

  /**
   * Agriculture & Farmer Cloude transport shops (Tata Ace, goods transport, farm-to-market):
   * validates the vehicle's delivery charge / hourly rate and prices the product from them.
   * Every new vehicle needs its rates; other shops can't store transport details.
   */
  private withTransportTerms<T extends { transportDetails?: Record<string, unknown> }>(
    listing: { cloude: { slug: string }; category: { slug: string } },
    dto: T,
    creating: boolean,
  ) {
    const { transportDetails, ...rest } = dto;
    if (getBookingKind(listing.cloude.slug, listing.category.slug) !== 'TRANSPORT') return rest;
    if (transportDetails === undefined) {
      if (creating) throw new BadRequestException('Please fill in the vehicle and rate details.');
      // An edit that doesn't touch the rates keeps them as they are.
      return rest;
    }

    const terms = normalizeTransportDetails(transportDetails);
    return {
      ...rest,
      transportDetails: terms.transportDetails as Prisma.InputJsonObject,
      price: terms.price,
      priceType: 'FIXED' as const,
      priceUnit: terms.priceUnit,
    };
  }
}

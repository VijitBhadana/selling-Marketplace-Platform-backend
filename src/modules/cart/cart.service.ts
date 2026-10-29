import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPropertyType } from '../products/property-details';
import { isExpiredMedicine } from '../products/clinic-details';
import { getBookingKind, getRentSubject, normalizeBookingDetails } from './booking-details';
import { MAX_CART_QUANTITY } from './dto';

const cartItemInclude = {
  product: { include: { listing: { include: { cloude: true, category: { select: { slug: true, name: true } } } } } },
} as const;

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(userId: string, productId: string, quantity = 1, bookingDetails?: Record<string, unknown>) {
    // Independent lookups, so they run together instead of one database round-trip after
    // another (this was the slowest endpoint under load). Only the suspension check throws.
    const [, product, existing] = await Promise.all([
      this.assertNotSuspended(userId),
      this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          listing: {
            select: {
              sellerId: true,
              status: true,
              seller: { select: { suspendedBy: true } },
              cloude: { select: { slug: true } },
              category: { select: { slug: true } },
            },
          },
        },
      }),
      this.prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } }),
    ]);
    if (!product) throw new NotFoundException('Product not found');
    if (product.listing.status !== 'ACTIVE' || product.listing.seller.suspendedBy === 'ADMIN') {
      throw new BadRequestException('This shop is not taking orders right now.');
    }
    // Self-orders would fake completed orders and let a seller rate their own shop.
    if (product.listing.sellerId === userId) throw new BadRequestException("You can't order from your own shop.");
    if (isExpiredMedicine(product.clinicDetails)) throw new BadRequestException('This medicine is past its expiry date.');

    // Booking Cloude: one booking = one set of details. Booking the same product
    // again replaces the details instead of stacking quantity.
    const kind = getBookingKind(product.listing.cloude?.slug, product.listing.category?.slug);
    // No price ("contact for price") means nothing to charge — it would check out as ₹0.
    // Transport bookings are priced from the seller's rates instead.
    if (product.price == null && kind !== 'TRANSPORT') {
      throw new BadRequestException('This item has no fixed price — chat with the seller to agree one.');
    }
    if (kind) {
      const propertyType = getPropertyType(product.listing.cloude?.slug, product.listing.category?.slug);
      const rentSubject = getRentSubject(product.listing.cloude?.slug, product.listing.category?.slug);
      const details = normalizeBookingDetails(kind, bookingDetails, { ...product, propertyType, rentSubject }) as Prisma.InputJsonObject;
      return this.prisma.cartItem.upsert({
        where: { userId_productId: { userId, productId } },
        update: { quantity: 1, bookingDetails: details },
        create: { userId, productId, quantity: 1, bookingDetails: details },
        include: cartItemInclude,
      });
    }

    const total = (existing?.quantity ?? 0) + quantity;
    if (total > MAX_CART_QUANTITY) throw new BadRequestException(`You can add at most ${MAX_CART_QUANTITY} of one item.`);

    return this.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: { quantity: total },
      create: { userId, productId, quantity },
      include: cartItemInclude,
    });
  }

  async setQuantity(userId: string, productId: string, quantity: number) {
    if (quantity < 1) {
      await this.prisma.cartItem.deleteMany({ where: { userId, productId } });
      return { removed: true };
    }
    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) throw new NotFoundException('Item is not in your bucket list');
    // A booking's size comes from its details (rooms, nights, hours...), not quantity.
    if (existing.bookingDetails) throw new BadRequestException('Edit the booking details to change this booking.');

    return this.prisma.cartItem.update({
      where: { userId_productId: { userId, productId } },
      data: { quantity },
      include: cartItemInclude,
    });
  }

  remove(userId: string, productId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId, productId } });
  }

  private async assertNotSuspended(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
    if (user?.isSuspended) {
      throw new ForbiddenException('Your account has been suspended for repeated no-shows on Cash on Delivery orders.');
    }
  }
}

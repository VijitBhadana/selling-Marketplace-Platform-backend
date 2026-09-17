import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  bookingNoShowAfter,
  bookingUnits,
  effectivePriceUnit,
  getBookingKind,
  propertyTermsChanged,
  transportQuote,
  transportTermsChanged,
} from '../cart/booking-details';
import { CheckoutDto, OrderChannelDto, PaymentMethodDto } from './dto';

const orderInclude = {
  items: true,
  listing: { select: { id: true, shopName: true, title: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async checkout(buyerId: string, dto: CheckoutDto) {
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId }, select: { isSuspended: true, name: true } });
    if (buyer?.isSuspended) {
      throw new ForbiddenException('Your account has been suspended for repeated no-shows on Cash on Delivery orders.');
    }

    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId: buyerId },
      include: { product: { include: { listing: { include: { cloude: true, category: { select: { slug: true } } } } } } },
    });
    if (cartItems.length === 0) throw new BadRequestException('Your bucket list is empty.');

    const kindOf = (item: (typeof cartItems)[number]) =>
      getBookingKind(item.product.listing.cloude?.slug, item.product.listing.category?.slug);

    // Booking Cloude items added before the booking form existed have no details yet.
    const missingDetails = cartItems.find((item) => !item.bookingDetails && kindOf(item));
    if (missingDetails) {
      throw new BadRequestException(`Please fill in the booking details for "${missingDetails.product.name}" in your bucket list.`);
    }

    // Property Cloude: the owner switched rent ↔ sale or the rent unit after the buyer
    // filled in their details, so the saved duration no longer matches the price.
    const staleProperty = cartItems.find((item) => kindOf(item) === 'PROPERTY' && propertyTermsChanged(item.bookingDetails, item.product));
    if (staleProperty) {
      throw new BadRequestException(`The owner changed the terms for "${staleProperty.product.name}" — please update your details in your bucket list.`);
    }

    // Agriculture transport: the seller stopped offering the buyer's service (delivery / on
    // hire) or switched per trip ↔ per km, so the saved hours/distance no longer fit the rate.
    const staleTransport = cartItems.find(
      (item) => kindOf(item) === 'TRANSPORT' && transportTermsChanged(item.bookingDetails, item.product.transportDetails),
    );
    if (staleTransport) {
      throw new BadRequestException(`The seller changed the rates for "${staleTransport.product.name}" — please update your details in your bucket list.`);
    }

    // Booking shops always get the BOOKING channel; the buyer's takeaway/delivery
    // choice only applies to the other shops in the bucket.
    const allBooking = cartItems.every((item) => kindOf(item));
    if (dto.channel === OrderChannelDto.BOOKING && !allBooking) {
      throw new BadRequestException('Choose takeaway or delivery for the non-booking items in your bucket list.');
    }

    const needsPickupEta =
      !allBooking &&
      (dto.channel === OrderChannelDto.TAKEAWAY ||
        dto.channel === OrderChannelDto.DINE_IN ||
        dto.channel === OrderChannelDto.SERVICE);
    if (needsPickupEta && !dto.pickupEtaMinutes) {
      throw new BadRequestException('Please tell us how long you will take to arrive.');
    }
    if (!allBooking && dto.channel === OrderChannelDto.DELIVERY && !dto.address?.trim()) {
      throw new BadRequestException('Please provide a delivery address.');
    }

    const groupsByListing = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const key = item.product.listingId;
      const group = groupsByListing.get(key) ?? [];
      group.push(item);
      groupsByListing.set(key, group);
    }

    if (dto.paymentMethod === PaymentMethodDto.COD) {
      const hasFoodItem = [...groupsByListing.values()].some((items) => items[0].product.listing.cloude?.slug === 'food');
      if (hasFoodItem) {
        throw new BadRequestException('Only online payment is accepted for food orders.');
      }
      const hasServiceItem = cartItems.some((item) => item.product.isService);
      if (hasServiceItem) {
        throw new BadRequestException('Only online payment is accepted for service bookings.');
      }
      // Rent Cloude: the owner hands over their car, flat or camera before any money would
      // change hands at a counter, so a rental is always paid for online, up front.
      const hasRentItem = cartItems.some((item) => kindOf(item) === 'RENT');
      if (hasRentItem) {
        throw new BadRequestException('Only online payment is accepted for rentals.');
      }
    }

    const paymentStatus = dto.paymentMethod === PaymentMethodDto.ONLINE ? 'PAID' : 'PENDING';
    const pickupEta = needsPickupEta ? new Date(Date.now() + dto.pickupEtaMinutes! * 60_000) : null;

    const orders = await this.prisma.$transaction(async (tx) => {
      const created: Awaited<ReturnType<typeof tx.order.create>>[] = [];
      for (const [listingId, items] of groupsByListing) {
        const sellerId = items[0].product.listing.sellerId;
        const isBooking = Boolean(kindOf(items[0]));

        // A booking's price multiplies by its details (2 rooms × 3 nights = 6 units);
        // the unit is snapshotted into the details so later product edits don't change history.
        // Agriculture transport's rate depends on the buyer's choice (delivery per trip/km, or per hour on hire).
        const lines = items.map((item) => {
          const kind = kindOf(item);
          const productPrice = Number(item.product.price ?? 0);
          if (!kind) return { item, unitPrice: productPrice, quantity: item.quantity, bookingDetails: undefined };
          const { unitPrice, priceUnit } =
            kind === 'TRANSPORT'
              ? transportQuote(item.product.transportDetails, item.bookingDetails)!
              : { unitPrice: productPrice, priceUnit: effectivePriceUnit(kind, item.product.priceUnit) };
          const bookingDetails = { ...(item.bookingDetails as Prisma.JsonObject), priceUnit };
          return { item, unitPrice, quantity: bookingUnits(priceUnit, bookingDetails), bookingDetails };
        });
        const totalAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

        const order = await tx.order.create({
          data: {
            buyerId,
            sellerId,
            listingId,
            shopName: items[0].product.listing.shopName || items[0].product.listing.title,
            channel: (isBooking ? OrderChannelDto.BOOKING : dto.channel) as any,
            pickupEta: isBooking ? bookingNoShowAfter(lines.map((line) => line.bookingDetails ?? {})) : pickupEta,
            address: !isBooking && dto.channel === OrderChannelDto.DELIVERY ? dto.address!.trim() : null,
            paymentMethod: dto.paymentMethod as any,
            paymentStatus,
            totalAmount,
            items: {
              create: lines.map(({ item, unitPrice, quantity, bookingDetails }) => ({
                productId: item.productId,
                productName: item.product.name,
                unitPrice,
                quantity,
                bookingDetails: bookingDetails as Prisma.InputJsonObject | undefined,
              })),
            },
          },
          include: orderInclude,
        });
        created.push(order);

        const shopName = order.shopName!;
        await tx.notification.create({
          data: {
            userId: sellerId,
            type: 'ORDER_PLACED',
            title: isBooking ? 'New booking received' : 'New order received',
            body: `${buyer?.name ?? 'A buyer'} placed ${isBooking ? 'a booking' : 'an order'} worth ₹${totalAmount.toFixed(0)} at ${shopName}`,
            orderId: order.id,
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { userId: buyerId } });
      return created;
    });

    return orders;
  }

  findMine(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async receive(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== buyerId) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') throw new BadRequestException('This order is already settled.');

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
      include: orderInclude,
    });
  }

  async findForShop(sellerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
    if (!listing || listing.sellerId !== sellerId) throw new ForbiddenException('Not your shop');

    return this.prisma.order.findMany({
      where: { listingId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNoShow(sellerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.sellerId !== sellerId) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') throw new BadRequestException('This order is already settled.');
    if (order.paymentMethod !== 'COD') throw new BadRequestException('Only Cash on Delivery orders can be reported.');
    if (order.channel !== 'DELIVERY' && (!order.pickupEta || order.pickupEta > new Date())) {
      throw new BadRequestException(
        order.channel === 'BOOKING' ? 'The booking date has not passed yet.' : 'The promised pickup/arrival time has not passed yet.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'NO_SHOW' }, include: orderInclude });

      const buyer = await tx.user.update({
        where: { id: order.buyerId },
        data: { codStrikeCount: { increment: 1 } },
        select: { codStrikeCount: true },
      });

      if (buyer.codStrikeCount >= 2) {
        await tx.user.update({
          where: { id: order.buyerId },
          data: { isSuspended: true, suspendedAt: new Date(), suspendedBy: 'COD_NO_SHOW', pendingCodWarning: true },
        });
      } else {
        await tx.user.update({ where: { id: order.buyerId }, data: { pendingCodWarning: true } });
      }

      return updated;
    });
  }
}

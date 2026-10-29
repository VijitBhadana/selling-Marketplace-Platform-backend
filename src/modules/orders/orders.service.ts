import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { notifyNearbyDeliveryPartners } from '../delivery/dispatch';
import { maskLicense } from '../auth/delivery-kyc';
import { isExpiredMedicine } from '../products/clinic-details';

const orderInclude = {
  items: true,
  listing: { select: { id: true, shopName: true, title: true } },
  // Delivery orders: who's carrying it — shown to both the buyer and the shop.
  deliveryPartner: {
    select: {
      name: true,
      phone: true,
      deliveryProfile: { select: { vehicleType: true, vehicleNumber: true, licenseNumber: true } },
    },
  },
} as const;

type PartnerRow = {
  name: string;
  phone: string | null;
  deliveryProfile: { vehicleType: string; vehicleNumber: string | null; licenseNumber: string } | null;
} | null;

/** Flattens the delivery partner into what the buyer / shop is shown, licence number masked. */
function withPartnerDetails<T extends { deliveryPartner: PartnerRow }>(order: T) {
  const p = order.deliveryPartner;
  return {
    ...order,
    deliveryPartner: p && {
      name: p.name,
      phone: p.phone,
      vehicleType: p.deliveryProfile?.vehicleType ?? null,
      vehicleNumber: p.deliveryProfile?.vehicleNumber ?? null,
      licenseNumber: p.deliveryProfile ? maskLicense(p.deliveryProfile.licenseNumber) : null,
    },
  };
}

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
      include: {
        product: {
          include: { listing: { include: { cloude: true, category: { select: { slug: true } }, seller: { select: { suspendedBy: true } } } } },
        },
      },
    });
    if (cartItems.length === 0) throw new BadRequestException('Your bucket list is empty.');

    const kindOf = (item: (typeof cartItems)[number]) =>
      getBookingKind(item.product.listing.cloude?.slug, item.product.listing.category?.slug);

    // Items added before the cart blocked self-orders.
    const ownItem = cartItems.find((item) => item.product.listing.sellerId === buyerId);
    if (ownItem) throw new BadRequestException(`"${ownItem.product.name}" is from your own shop — remove it from your bucket list.`);

    // A "contact for price" item has no price to charge; it would otherwise go through as ₹0.
    // Transport bookings are priced from the seller's rates instead (transportQuote).
    const unpriced = cartItems.find((item) => item.product.price == null && kindOf(item) !== 'TRANSPORT');
    if (unpriced) {
      throw new BadRequestException(`"${unpriced.product.name}" has no fixed price — chat with the seller, then remove it from your bucket list.`);
    }

    // Re-checked here, not only when the item went into the bucket: since then the shop may
    // have been taken down, its seller suspended by the admin, or a medicine may have expired.
    const closed = cartItems.find(
      (item) => item.product.listing.status !== 'ACTIVE' || item.product.listing.seller.suspendedBy === 'ADMIN',
    );
    if (closed) {
      const shop = closed.product.listing.shopName || closed.product.listing.title;
      throw new BadRequestException(`${shop} is not taking orders right now — remove "${closed.product.name}" from your bucket list.`);
    }
    const expired = cartItems.find((item) => isExpiredMedicine(item.product.clinicDetails));
    if (expired) {
      throw new BadRequestException(`"${expired.product.name}" is past its expiry date — remove it from your bucket list.`);
    }

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
      // A delivery partner collects the order from the shop, so it's always paid for
      // online, up front — there's no cash for the partner to carry back.
      if (!allBooking && dto.channel === OrderChannelDto.DELIVERY) {
        throw new BadRequestException('Delivery orders must be paid online in advance.');
      }
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
    const note = dto.note?.trim() || null;

    const orders = await this.prisma.$transaction(async (tx) => {
      // Claim the exact cart rows read above before creating anything. A second checkout
      // racing this one (double-click, retry on a slow network) blocks on these rows, then
      // finds them gone and rolls back — so one bucket list can never become two orders.
      const claimed = await tx.cartItem.deleteMany({ where: { id: { in: cartItems.map((item) => item.id) } } });
      if (claimed.count !== cartItems.length) {
        throw new ConflictException('Your bucket list changed or this order is already being placed. Please check My Orders.');
      }

      const created: Awaited<ReturnType<typeof tx.order.create>>[] = [];
      for (const [listingId, items] of groupsByListing) {
        const sellerId = items[0].product.listing.sellerId;
        const isBooking = Boolean(kindOf(items[0]));
        // Only the food shops in the bucket get the buyer's kitchen instructions.
        const orderNote = items[0].product.listing.cloude?.slug === 'food' ? note : null;

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
            deliveryStatus: !isBooking && dto.channel === OrderChannelDto.DELIVERY ? 'SEARCHING' : null,
            note: orderNote,
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
            body: `${buyer?.name ?? 'A buyer'} placed ${isBooking ? 'a booking' : 'an order'} worth ₹${totalAmount.toFixed(0)} at ${shopName}${orderNote ? ` — Note: "${orderNote}"` : ''}`,
            orderId: order.id,
          },
        });
      }

      return created;
    });

    // The order is placed either way — a failed alert must not fail the checkout.
    // Partners still find the order in their panel's requests list.
    await notifyNearbyDeliveryPartners(
      this.prisma,
      orders.filter((o) => o.deliveryStatus === 'SEARCHING').map((o) => o.id),
    ).catch((err) => console.error('Could not notify delivery partners', err));

    return orders;
  }

  // Each order carries the buyer's own rating of its shop (null until they rate it).
  async findMine(buyerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    const listingIds = [...new Set(orders.map((o) => o.listingId).filter((id): id is string => !!id))];
    const reviews = listingIds.length
      ? await this.prisma.review.findMany({
          where: { authorId: buyerId, listingId: { in: listingIds } },
          select: { listingId: true, rating: true },
        })
      : [];
    const ratingBy = new Map(reviews.map((r) => [r.listingId, r.rating]));
    return orders.map((o) => withPartnerDetails({ ...o, myRating: (o.listingId && ratingBy.get(o.listingId)) || null }));
  }

  async receive(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== buyerId) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') throw new BadRequestException('This order is already settled.');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
      include: orderInclude,
    });
    return withPartnerDetails(updated);
  }

  async findForShop(sellerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
    if (!listing || listing.sellerId !== sellerId) throw new ForbiddenException('Not your shop');

    const orders = await this.prisma.order.findMany({
      where: { listingId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(withPartnerDetails);
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

      return withPartnerDetails(updated);
    });
  }
}

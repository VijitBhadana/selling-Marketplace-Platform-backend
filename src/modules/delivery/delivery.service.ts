import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NearQuery, isListingNear, listingNearWhere } from '../../common/nearby';
import { SetLocationDto } from './dto';
import { describeVehicle } from '../auth/delivery-kyc';

// What a delivery partner sees of an order: where to pick it up, where to drop it and
// who to call at each end. Never the Cloude — the panel is about deliveries only.
const deliveryOrderSelect = {
  id: true,
  shopName: true,
  address: true,
  totalAmount: true,
  paymentMethod: true,
  paymentStatus: true,
  status: true,
  deliveryStatus: true,
  deliveryAcceptedAt: true,
  pickedUpAt: true,
  deliveredAt: true,
  createdAt: true,
  items: { select: { id: true, productName: true, quantity: true } },
  listing: {
    select: {
      id: true,
      shopName: true,
      title: true,
      city: true,
      pincode: true,
      latitude: true,
      longitude: true,
      seller: { select: { name: true, phone: true } },
    },
  },
  buyer: { select: { name: true, phone: true } },
} satisfies Prisma.OrderSelect;

const REQUESTS_LIMIT = 50;
const MY_ORDERS_LIMIT = 50;

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        aadhaarLast4: true,
        deliveryProfile: {
          select: {
            address: true,
            vehicleType: true,
            vehicleNumber: true,
            licenseNumber: true,
            city: true,
            pincode: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!user?.deliveryProfile) throw new NotFoundException('Delivery partner profile not found');
    const { deliveryProfile, ...rest } = user;
    return { ...rest, ...deliveryProfile };
  }

  async setLocation(userId: string, dto: SetLocationDto) {
    await this.prisma.deliveryProfile.update({
      where: { userId },
      data: {
        city: dto.city.trim(),
        pincode: dto.pincode ?? null,
        latitude: dto.lat ?? null,
        longitude: dto.lng ?? null,
      },
    });
    return this.profile(userId);
  }

  private async nearOf(userId: string): Promise<NearQuery | null> {
    const p = await this.prisma.deliveryProfile.findUnique({
      where: { userId },
      select: { city: true, pincode: true, latitude: true, longitude: true },
    });
    if (!p?.city) return null;
    return { city: p.city, pincode: p.pincode ?? undefined, lat: p.latitude ?? undefined, lng: p.longitude ?? undefined };
  }

  /** Delivery orders from shops near the partner that nobody has accepted yet (and they haven't turned down). */
  async requests(userId: string) {
    const near = await this.nearOf(userId);
    const listingWhere = near && listingNearWhere(near);
    if (!listingWhere) return [];
    return this.prisma.order.findMany({
      where: {
        channel: 'DELIVERY',
        status: 'PENDING',
        deliveryStatus: 'SEARCHING',
        deliveryPartnerId: null,
        listing: listingWhere,
        deliveryRejections: { none: { partnerId: userId } },
      },
      // The buyer's phone number is only shared with the partner who accepts the order.
      select: { ...deliveryOrderSelect, buyer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: REQUESTS_LIMIT,
    });
  }

  /** Orders this partner accepted — the panel splits them into active and delivered. */
  mine(userId: string) {
    return this.prisma.order.findMany({
      where: { deliveryPartnerId: userId },
      select: deliveryOrderSelect,
      orderBy: [{ deliveryAcceptedAt: 'desc' }],
      take: MY_ORDERS_LIMIT,
    });
  }

  async accept(userId: string, orderId: string) {
    const [order, near] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          channel: true,
          buyerId: true,
          sellerId: true,
          listingId: true,
          shopName: true,
          listing: { select: { city: true, pincode: true, latitude: true, longitude: true } },
        },
      }),
      this.nearOf(userId),
    ]);
    if (!order || order.channel !== 'DELIVERY') throw new NotFoundException('Order not found');
    if (!near) throw new BadRequestException('Set your delivery location first.');
    if (!order.listing || !isListingNear(near, order.listing)) {
      throw new BadRequestException('This order is outside your delivery area.');
    }

    // Conditional update, so two partners tapping Accept together can't both get it.
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: 'PENDING', deliveryStatus: 'SEARCHING', deliveryPartnerId: null },
      data: { deliveryStatus: 'ASSIGNED', deliveryPartnerId: userId, deliveryAcceptedAt: new Date() },
    });
    if (count === 0) throw new ConflictException('Another delivery partner has already accepted this order.');

    // The request is gone for everyone else; for this partner it's now an active delivery.
    // The shop and the buyer are told who is coming.
    const who = await this.partnerLine(userId);
    const shopName = order.shopName ?? 'the shop';
    await Promise.all([
      this.prisma.notification.deleteMany({ where: { orderId, type: 'DELIVERY_REQUEST', userId: { not: userId } } }),
      this.prisma.notification.updateMany({ where: { orderId, type: 'DELIVERY_REQUEST', userId }, data: { read: true } }),
      this.prisma.notification.createMany({
        data: [
          {
            userId: order.sellerId,
            type: 'DELIVERY_ASSIGNED',
            title: 'Delivery partner on the way',
            body: `${who} will pick up the order from ${shopName}. Keep it packed and ready.`,
            orderId,
            listingId: order.listingId,
          },
          {
            userId: order.buyerId,
            type: 'DELIVERY_ASSIGNED',
            title: 'Delivery partner assigned',
            body: `${who} is on the way to ${shopName} to pick up your order.`,
            orderId,
          },
        ],
      }),
    ]);
    return this.findOwn(userId, orderId);
  }

  /** "Ravi Kumar (Motorcycle UP15AB1234, 📞 9876543210)" — who's carrying the order, for notifications. */
  private async partnerLine(userId: string) {
    const p = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, deliveryProfile: { select: { vehicleType: true, vehicleNumber: true } } },
    });
    if (!p) return 'Your delivery partner';
    const details = [describeVehicle(p.deliveryProfile?.vehicleType, p.deliveryProfile?.vehicleNumber), p.phone && `📞 ${p.phone}`]
      .filter(Boolean)
      .join(', ');
    return details ? `${p.name} (${details})` : p.name;
  }

  async reject(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { channel: true } });
    if (!order || order.channel !== 'DELIVERY') throw new NotFoundException('Order not found');
    await this.prisma.$transaction([
      this.prisma.deliveryRejection.upsert({
        where: { orderId_partnerId: { orderId, partnerId: userId } },
        create: { orderId, partnerId: userId },
        update: {},
      }),
      this.prisma.notification.deleteMany({ where: { orderId, type: 'DELIVERY_REQUEST', userId } }),
    ]);
    return { ok: true };
  }

  /** "I've collected the order from the shop" — the buyer is told it's on its way, the shop who took it. */
  async pickedUp(userId: string, orderId: string) {
    const order = await this.assertOwn(userId, orderId);
    if (order.deliveryStatus !== 'ASSIGNED') throw new BadRequestException('This order has already been picked up.');

    const who = await this.partnerLine(userId);
    const shopName = order.shopName ?? 'the shop';
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: 'PICKED_UP', pickedUpAt: new Date() } }),
      this.prisma.notification.createMany({
        data: [
          {
            userId: order.buyerId,
            type: 'ORDER_PICKED_UP',
            title: 'Your order has been picked up',
            body: `${who} has picked up your order from ${shopName} — it will be delivered very soon.`,
            orderId,
          },
          {
            userId: order.sellerId,
            type: 'ORDER_PICKED_UP',
            title: 'Order handed to delivery partner',
            body: `${who} picked up ${order.buyer.name}'s order from ${shopName}.`,
            orderId,
            listingId: order.listingId,
          },
        ],
      }),
    ]);
    return this.findOwn(userId, orderId);
  }

  /** "I've handed the order over" — completes it and tells the buyer and the shop. */
  async delivered(userId: string, orderId: string) {
    const order = await this.assertOwn(userId, orderId);
    if (order.deliveryStatus === 'DELIVERED') throw new BadRequestException('This order is already delivered.');
    if (order.deliveryStatus !== 'PICKED_UP') throw new BadRequestException('Mark the order as picked up from the shop first.');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        // The buyer may already have tapped "Mark as received" — keep that.
        data: { deliveryStatus: 'DELIVERED', deliveredAt: new Date(), ...(order.status === 'PENDING' ? { status: 'COMPLETED' } : {}) },
      }),
      this.prisma.notification.createMany({
        data: [
          {
            userId: order.buyerId,
            type: 'ORDER_DELIVERED',
            title: 'Your order has been delivered',
            body: `Your order from ${order.shopName ?? 'the shop'} has been delivered. Enjoy!`,
            orderId,
          },
          {
            userId: order.sellerId,
            type: 'ORDER_DELIVERED',
            title: 'Order delivered',
            body: `${order.buyer.name}'s order from ${order.shopName ?? 'your shop'} has been delivered.`,
            orderId,
            listingId: order.listingId,
          },
        ],
      }),
    ]);
    return this.findOwn(userId, orderId);
  }

  private async assertOwn(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        deliveryPartnerId: true,
        deliveryStatus: true,
        buyerId: true,
        sellerId: true,
        listingId: true,
        shopName: true,
        status: true,
        buyer: { select: { name: true } },
      },
    });
    if (!order || order.deliveryPartnerId !== userId) throw new NotFoundException('Order not found');
    return order;
  }

  private findOwn(userId: string, orderId: string) {
    return this.prisma.order.findFirst({ where: { id: orderId, deliveryPartnerId: userId }, select: deliveryOrderSelect });
  }
}

import { PrismaService } from '../../common/prisma/prisma.service';
import { isListingNear } from '../../common/nearby';

/**
 * Alerts every delivery partner whose location covers the shop of a freshly placed
 * delivery order. Partners who set their location later still see the order in their
 * panel's requests list — this only sends the bell notification.
 */
export async function notifyNearbyDeliveryPartners(prisma: PrismaService, orderIds: string[]) {
  if (!orderIds.length) return;
  const [orders, partners] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        shopName: true,
        address: true,
        totalAmount: true,
        listing: { select: { city: true, pincode: true, latitude: true, longitude: true } },
      },
    }),
    prisma.deliveryProfile.findMany({
      where: { city: { not: null }, user: { role: 'DELIVERY', isSuspended: false } },
      select: { userId: true, city: true, pincode: true, latitude: true, longitude: true },
    }),
  ]);

  const data = orders.flatMap((order) => {
    const listing = order.listing;
    if (!listing) return [];
    return partners
      .filter((p) =>
        isListingNear(
          { city: p.city ?? undefined, pincode: p.pincode ?? undefined, lat: p.latitude ?? undefined, lng: p.longitude ?? undefined },
          listing,
        ),
      )
      .map((p) => ({
        userId: p.userId,
        type: 'DELIVERY_REQUEST' as const,
        title: 'New delivery request',
        body: `Pick up from ${order.shopName ?? 'a shop'}${listing.city ? `, ${listing.city}` : ''} → deliver to ${order.address ?? 'the buyer'} · ₹${Number(order.totalAmount).toFixed(0)} paid online`,
        orderId: order.id,
      }));
  });
  if (data.length) await prisma.notification.createMany({ data });
}

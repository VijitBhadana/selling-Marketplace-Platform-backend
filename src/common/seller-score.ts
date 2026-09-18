import { PrismaClient } from '@prisma/client';

export type Rating = { avg: number | null; count: number };
export type Scored = { score: number; rating: Rating };

// A new shop starts as if it had PRIOR_WEIGHT reviews of PRIOR_RATING stars, so one
// 5★ review doesn't put it above a shop with forty 4.8★ ones.
const PRIOR_RATING = 3.5;
const PRIOR_WEIGHT = 3;
// Every complaint a buyer filed against the seller costs this much, up to the cap.
const REPORT_PENALTY = 0.25;
const MAX_REPORT_PENALTY = 1.5;
// Orders the buyer confirmed receiving — the seller delivered what they promised.
const COMPLETED_ORDER_BONUS = 0.02;
const MAX_COMPLETED_BONUS = 0.4;

function combine(sum: number, count: number, reports: number, completed: number): Scored {
  const bayes = (sum + PRIOR_RATING * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT);
  const score =
    bayes -
    Math.min(reports * REPORT_PENALTY, MAX_REPORT_PENALTY) +
    Math.min(completed * COMPLETED_ORDER_BONUS, MAX_COMPLETED_BONUS);
  return { score, rating: { avg: count ? Math.round((sum / count) * 10) / 10 : null, count } };
}

/**
 * Trust score per shop: buyers' star ratings for the shop, minus complaints against
 * its seller, plus a little for orders buyers confirmed receiving.
 */
export async function scoreListings(
  prisma: PrismaClient,
  shops: { id: string; sellerId: string }[],
): Promise<Map<string, Scored>> {
  const listingIds = shops.map((s) => s.id);
  const sellerIds = [...new Set(shops.map((s) => s.sellerId))];
  const [reviews, reports, completed] = await Promise.all([
    prisma.review.groupBy({ by: ['listingId'], where: { listingId: { in: listingIds } }, _sum: { rating: true }, _count: true }),
    prisma.sellerReport.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds } }, _count: true }),
    prisma.order.groupBy({ by: ['listingId'], where: { listingId: { in: listingIds }, status: 'COMPLETED' }, _count: true }),
  ]);
  const reviewBy = new Map(reviews.map((r) => [r.listingId, r]));
  const reportsBy = new Map(reports.map((r) => [r.sellerId, r._count]));
  const completedBy = new Map(completed.map((o) => [o.listingId, o._count]));

  return new Map(
    shops.map((s) => {
      const r = reviewBy.get(s.id);
      return [s.id, combine(r?._sum.rating ?? 0, r?._count ?? 0, reportsBy.get(s.sellerId) ?? 0, completedBy.get(s.id) ?? 0)];
    }),
  );
}

/**
 * Trust score per recruiter (a job is rated by the company that posted it): every
 * rating their shops received, minus complaints, plus confirmed orders.
 */
export async function scoreSellers(prisma: PrismaClient, sellerIds: string[]): Promise<Map<string, Scored>> {
  const ids = [...new Set(sellerIds)];
  const [reviews, reports, completed] = await Promise.all([
    prisma.review.groupBy({ by: ['targetId'], where: { targetId: { in: ids } }, _sum: { rating: true }, _count: true }),
    prisma.sellerReport.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids } }, _count: true }),
    prisma.order.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids }, status: 'COMPLETED' }, _count: true }),
  ]);
  const reviewBy = new Map(reviews.map((r) => [r.targetId, r]));
  const reportsBy = new Map(reports.map((r) => [r.sellerId, r._count]));
  const completedBy = new Map(completed.map((o) => [o.sellerId, o._count]));

  return new Map(
    ids.map((id) => {
      const r = reviewBy.get(id);
      return [id, combine(r?._sum.rating ?? 0, r?._count ?? 0, reportsBy.get(id) ?? 0, completedBy.get(id) ?? 0)];
    }),
  );
}

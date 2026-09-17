import { Prisma } from '@prisma/client';

/**
 * Deletes products for good. Cart items and finance applications (with their documents)
 * cascade; order lines keep their snapshotted name and price and just lose the link.
 */
export async function deleteProductsCascade(tx: Prisma.TransactionClient, productIds: string[]) {
  if (productIds.length === 0) return;
  await tx.product.deleteMany({ where: { id: { in: productIds } } });
}

/**
 * Deletes shops (listings) and everything hanging off them: products, photos, chats,
 * finance applications and wishlist entries. Orders stay in the buyer's history (with
 * the snapshotted shop name) and reviews stay on the seller — both just lose the shop link.
 */
export async function deleteListingsCascade(tx: Prisma.TransactionClient, listingIds: string[]) {
  if (listingIds.length === 0) return;
  await tx.wishlistItem.deleteMany({ where: { listingId: { in: listingIds } } });
  await tx.review.updateMany({ where: { listingId: { in: listingIds } }, data: { listingId: null } });
  await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
}

import { Prisma } from '@prisma/client';

// A seller the admin has suspended disappears from the site: their shops,
// products and job posts are hidden until the admin reactivates them.
// (A COD no-show suspension is buyer-side only and hides nothing.)
export const PUBLICLY_VISIBLE_USER: Prisma.UserWhereInput = {
  OR: [{ suspendedBy: null }, { suspendedBy: 'COD_NO_SHOW' }],
};

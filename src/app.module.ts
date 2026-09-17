import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { MailModule } from './common/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CloudesModule } from './modules/cloudes/cloudes.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ListingsModule } from './modules/listings/listings.module';
import { ProductsModule } from './modules/products/products.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MessagesModule } from './modules/messages/messages.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    CloudesModule,
    CategoriesModule,
    ListingsModule,
    ProductsModule,
    JobsModule,
    FinanceModule,
    WishlistModule,
    ReviewsModule,
    MessagesModule,
    CartModule,
    OrdersModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Behind one reverse proxy (hosting / load balancer) in production: read the real client
  // IP from X-Forwarded-For so per-IP throttles key on the user, not the shared proxy IP.
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Post Your Ad / product photos are sent as base64 data URLs in the JSON
  // body. Express's default 100kb limit rejects those with a silent 413
  // before they ever reach a controller, so listings/products with a real
  // photo attached were failing to save — raise it well past a resized photo.
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    // Never reflect an arbitrary origin: with credentials enabled that would let any
    // website make authenticated calls on a signed-in user's behalf. If CORS_ORIGIN is
    // unset, production closes cross-origin entirely; dev falls back to localhost.
    origin: corsOrigins?.length
      ? corsOrigins
      : process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  // API docs expose every route and schema, which makes recon trivial. Keep them off in
  // production unless explicitly turned on with ENABLE_SWAGGER=true.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Marketplace Platform API')
      .setDescription('API for the multi-category "Cloude" marketplace (OLX-style)')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    console.log(`Swagger docs on http://localhost:${port}/api/docs`);
  }
}
bootstrap();

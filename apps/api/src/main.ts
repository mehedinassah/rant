// Must be first: installs OTel instrumentation before Nest/Express load.
import './common/telemetry/tracing';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // rawBody lets the webhook controllers read the exact bytes the provider
  // signed (GitHub/Vercel/Sentry), so HMAC verification matches the payload.
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true });
  const config = app.get(ConfigService);

  // Security headers. CSP is disabled (this is a JSON API + Swagger UI, not an
  // HTML app), and CORP is cross-origin so the web app on :3000 can consume it.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  configureApp(app);

  // Self-documenting OpenAPI at /docs — both auth schemes are advertised.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('rant API')
    .setDescription('The operating system for modern software teams.')
    .setVersion('1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'apiKey')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 rant API listening on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`📖 API docs at http://localhost:${port}/docs`);
}

void bootstrap();

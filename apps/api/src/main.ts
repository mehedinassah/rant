import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);

  // Security headers. CSP is disabled (this is a JSON API + Swagger UI, not an
  // HTML app), and CORP is cross-origin so the web app on :3000 can consume it.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

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

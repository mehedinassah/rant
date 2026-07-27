import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { EpicsModule } from './modules/epics/epics.module';
import { IssuesModule } from './modules/issues/issues.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { CiModule } from './modules/ci/ci.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocsModule } from './modules/docs/docs.module';
import { SearchModule } from './modules/search/search.module';
import { ApiPlatformModule } from './modules/api-platform/api-platform.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo root .env (cwd is apps/api at runtime; also try local).
      envFilePath: [join(process.cwd(), '../../.env'), join(process.cwd(), '.env')],
    }),
    // Internal event bus — lets modules react to each other's domain events
    // (e.g. CI starts a run when a commit lands) without importing each other.
    EventEmitterModule.forRoot(),
    // BullMQ (Redis-backed) job queue powering the CI/CD worker.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    WorkspacesModule,
    ProjectsModule,
    SprintsModule,
    EpicsModule,
    IssuesModule,
    RepositoriesModule,
    CiModule,
    DeploymentsModule,
    MonitoringModule,
    NotificationsModule,
    DocsModule,
    SearchModule,
    ApiPlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    // JWT auth is on by default; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RolesGuard runs next: enforces org membership + @Roles on `:orgId` routes.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

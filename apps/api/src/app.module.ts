import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo root .env (cwd is apps/api at runtime; also try local).
      envFilePath: [join(process.cwd(), '../../.env'), join(process.cwd(), '.env')],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    WorkspacesModule,
    ProjectsModule,
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

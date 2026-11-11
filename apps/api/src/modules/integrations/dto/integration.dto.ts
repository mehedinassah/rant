import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Link an external provider project (a Vercel project, a Sentry project) to the
 * rant repository whose deployments/incidents it should feed. Shared by every
 * provider integration so the UX is identical regardless of vendor.
 */
export class CreateProjectLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalProjectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalProjectName?: string;

  @IsString()
  @MinLength(1)
  repositoryId!: string;

  /** Optional environment override; defaults to the repo's Production environment. */
  @IsOptional()
  @IsString()
  environmentId?: string;
}

import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EnvironmentType } from '@rant/database';

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export class CreateEnvironmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric with - or _' })
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsEnum(EnvironmentType)
  type?: EnvironmentType;

  @IsOptional()
  @IsString()
  @Matches(REF, { message: 'branchFilter is not a valid ref name' })
  branchFilter?: string;
}

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(REF)
  branchFilter?: string;
}

export class DeployDto {
  @IsOptional()
  @IsString()
  @Matches(REF, { message: 'branch is not a valid ref name' })
  branch?: string;
}

export class RollbackDto {
  @IsString()
  deploymentId!: string;
}

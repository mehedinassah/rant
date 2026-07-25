import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PullRequestStatus, RepositoryVisibility, ReviewState } from '@rant/database';

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export class CreateRepositoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric with - or _' })
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;

  @IsOptional()
  @IsString()
  @Matches(REF, { message: 'defaultBranch is not a valid ref name' })
  defaultBranch?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(RepositoryVisibility)
  visibility?: RepositoryVisibility;

  @IsOptional()
  @IsString()
  @Matches(REF)
  defaultBranch?: string;
}

export class CreateBranchDto {
  @IsString()
  @Matches(REF, { message: 'branch name is not a valid ref' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(REF)
  fromBranch?: string;
}

export class UpdateBranchDto {
  @IsBoolean()
  isProtected!: boolean;
}

export class CreateCommitDto {
  @IsString()
  @Matches(REF)
  branch!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}

export class CreateTagDto {
  @IsString()
  @Matches(REF, { message: 'tag name is not a valid ref' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  commitSha?: string;
}

export class CreateReleaseDto {
  @IsString()
  @Matches(REF)
  tagName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isPrerelease?: boolean;
}

export class CreatePullRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsString()
  @Matches(REF)
  sourceBranch!: string;

  @IsOptional()
  @IsString()
  @Matches(REF)
  targetBranch?: string;
}

export class UpdatePullRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  // Only DRAFT/OPEN/CLOSED are settable here; MERGED goes through /merge.
  @IsOptional()
  @IsEnum(PullRequestStatus)
  status?: PullRequestStatus;
}

export class CreateReviewDto {
  @IsEnum(ReviewState)
  state!: ReviewState;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;
}

export class ListPullRequestsQueryDto {
  @IsOptional()
  @IsEnum(PullRequestStatus)
  status?: PullRequestStatus;
}

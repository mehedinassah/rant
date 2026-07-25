import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PipelineTrigger } from '@rant/database';

const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export class StepDefDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  run!: string;
}

export class JobDefDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StepDefDto)
  steps!: StepDefDto[];
}

export class PipelineDefinitionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => JobDefDto)
  jobs!: JobDefDto[];
}

export class CreatePipelineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PipelineDefinitionDto)
  definition?: PipelineDefinitionDto;

  @IsOptional()
  @IsArray()
  @IsEnum(PipelineTrigger, { each: true })
  triggers?: PipelineTrigger[];

  @IsOptional()
  @IsString()
  @Matches(REF, { message: 'branchFilter is not a valid ref name' })
  branchFilter?: string;
}

export class UpdatePipelineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PipelineDefinitionDto)
  definition?: PipelineDefinitionDto;

  @IsOptional()
  @IsArray()
  @IsEnum(PipelineTrigger, { each: true })
  triggers?: PipelineTrigger[];

  @IsOptional()
  @IsString()
  @Matches(REF)
  branchFilter?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TriggerRunDto {
  @IsOptional()
  @IsString()
  @Matches(REF)
  branch?: string;
}

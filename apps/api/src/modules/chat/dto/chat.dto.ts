import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, { message: 'name must be lowercase alphanumeric with hyphens' })
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}

export class PostMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

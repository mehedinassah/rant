import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSavedSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;
}

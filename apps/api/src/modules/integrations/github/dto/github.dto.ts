import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CompleteInstallDto {
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'installationId must be numeric' })
  @MaxLength(30)
  installationId!: string;
}

export class LinkAccountDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  code!: string;
}

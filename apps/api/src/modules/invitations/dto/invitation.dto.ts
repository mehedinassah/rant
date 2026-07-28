import { IsEmail, IsEnum } from 'class-validator';
import { OrgRole } from '@rant/database';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  role!: OrgRole;
}

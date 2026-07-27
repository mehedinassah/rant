import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MonitorType } from '@rant/database';

export class CreateMonitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(MonitorType)
  type?: MonitorType;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  intervalSec?: number;
}

export class UpdateMonitorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  intervalSec?: number;

  @IsOptional()
  isActive?: boolean;
}

/** Inject or clear a simulated outage so the incident flow is demoable. */
export class SimulateDto {
  @IsIn(['outage', 'recover'])
  kind!: 'outage' | 'recover';

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  durationSec?: number;
}

export class ResolveIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

import { IndustryVertical, WaitlistReason } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class DiscoverWaitlistRequestDto {
  @IsEmail()
  @MaxLength(320)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsEnum(IndustryVertical)
  industry!: IndustryVertical;

  @IsOptional()
  @IsEnum(WaitlistReason)
  reason?: WaitlistReason;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  domain?: string;

  @IsOptional()
  @IsUUID("4")
  discoveryLeadId?: string;

  @IsOptional()
  @IsUUID("4")
  marketIntelligenceLogId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  sourceUrl?: string;
}

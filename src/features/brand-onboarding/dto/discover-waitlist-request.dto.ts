import { IndustryVertical } from "@prisma/client";
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

import { IndustryVertical } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class SurfaceScanRequestDto {
  @IsUUID("4")
  leadId!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  force?: boolean;
}

export class PatchBrandProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(12_000)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl({ require_tld: false })
  logoUrl?: string | null;

  @IsOptional()
  @IsEnum(IndustryVertical)
  industry?: IndustryVertical;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subIndustry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  industryNiche?: string | null;

  @IsOptional()
  @IsObject()
  visualIdentity?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandValues?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyFlags?: string[];

  @IsOptional()
  @IsObject()
  targetAudience?: Record<string, unknown>;
}

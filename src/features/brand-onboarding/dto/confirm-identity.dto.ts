import { IndustryVertical } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
  ValidateIf,
} from "class-validator";

/**
 * Checkpoint 1 confirm-identity request (Phase 4).
 * Social URL fields intentionally accept invalid strings via controller
 * Zod parsing with `.nullable().catch(null)` — this DTO is a first pass.
 */
export class ConfirmIdentitySocialHandlesDto {
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  instagram?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  tiktok?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  facebook?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  youtube?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  linkedin?: string | null;
}

export class ConfirmIdentityDto {
  @IsString()
  @MinLength(1)
  brand_name!: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  brand_logo!: string | null;

  @IsEnum(IndustryVertical)
  industry!: IndustryVertical;

  @IsString()
  @MinLength(1)
  sub_industry!: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  tagline!: string | null;

  @ValidateNested()
  @Type(() => ConfirmIdentitySocialHandlesDto)
  social_handles!: ConfirmIdentitySocialHandlesDto;
}

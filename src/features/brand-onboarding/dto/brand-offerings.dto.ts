import { OfferingType } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class UpsertOfferingItemDto {
  @IsOptional()
  @IsUUID("4")
  id?: string;

  @IsEnum(OfferingType)
  type!: OfferingType;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryTag?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  startingPriceLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncOfferingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertOfferingItemDto)
  offerings!: UpsertOfferingItemDto[];
}

export class UploadOfferingImageDto {
  @IsString()
  @MaxLength(8_000_000)
  imageBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentType?: string;
}

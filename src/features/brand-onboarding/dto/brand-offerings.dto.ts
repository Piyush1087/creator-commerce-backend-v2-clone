import { OfferingType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
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

/** Strip tracking query/hash and add https:// when missing (catalogue pastes). */
function normalizeOfferingUrlInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  const withoutHash = trimmed.split("#")[0] ?? trimmed;
  const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
  const withProtocol = /^https?:\/\//i.test(withoutQuery)
    ? withoutQuery
    : `https://${withoutQuery}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const path =
      url.pathname && url.pathname !== "/"
        ? url.pathname.replace(/\/+$/, "")
        : "";
    return path ? `https://${host}${path}` : `https://${host}`;
  } catch {
    return withProtocol;
  }
}

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

  @Transform(({ value }) => normalizeOfferingUrlInput(value))
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

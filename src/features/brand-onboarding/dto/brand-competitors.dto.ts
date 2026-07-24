import { Type, Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Strip tracking query/hash and add https:// when missing. */
function normalizeCompetitorUrlInput(value: unknown): unknown {
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

export class UpsertCompetitorItemDto {
  @IsOptional()
  @IsUUID("4")
  id?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @Transform(({ value }) => normalizeCompetitorUrlInput(value))
  @IsUrl({ require_tld: false })
  websiteUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  socialHandles?: string[];

  @IsOptional()
  @IsString()
  @MinLength(40)
  @MaxLength(500)
  whyCompetitor?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncCompetitorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCompetitorItemDto)
  competitors!: UpsertCompetitorItemDto[];
}

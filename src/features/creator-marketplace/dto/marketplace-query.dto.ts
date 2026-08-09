import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

const PLATFORM_FORMATS = [
  "INSTAGRAM_REEL",
  "INSTAGRAM_STORY",
  "TIKTOK_VIDEO",
  "YOUTUBE_SHORTS",
] as const;

const CREATOR_TIERS = ["NANO", "MICRO", "MID", "MACRO", "MEGA"] as const;

const PRODUCTION_TIMELINES = ["URGENT_PIPELINE", "STANDARD_RUNWAY"] as const;

export class MarketplaceQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search_query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand_slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  niche?: string;

  @IsOptional()
  @IsIn([...PLATFORM_FORMATS])
  deliverable_type?: (typeof PLATFORM_FORMATS)[number];

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  show_match_eligible_only?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsIn(CREATOR_TIERS, { each: true })
  creator_tier?: (typeof CREATOR_TIERS)[number][];

  @IsOptional()
  @IsString()
  @Length(2, 2)
  target_geography?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsIn(PRODUCTION_TIMELINES, { each: true })
  production_timeline?: (typeof PRODUCTION_TIMELINES)[number][];
}

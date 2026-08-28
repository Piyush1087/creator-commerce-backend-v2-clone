import { OfferingPriceMode, OfferingType } from "@prisma/client";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import type { StrategyMixPercents } from "../types/budget-mix.types";

export class PatchDnaProfileDto {
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  brandName?: string;

  @IsOptional()
  @IsString()
  igHandle?: string;

  @IsOptional()
  @IsString()
  ytHandle?: string;

  @IsOptional()
  @IsString()
  tiktokHandle?: string;

  @IsOptional()
  @IsString()
  lifecycleStage?: string;
}

export class PatchDnaNarrativeDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  briefDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandUsps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toneOfVoice?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doNotSayList?: string[];
}

export class PatchDnaIdentityDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  palette?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fonts?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aesthetics?: string[];
}

export class CreatePersonaDto {
  @IsString()
  @MinLength(2)
  personaName!: string;

  demographicsJson!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  psychographicsText?: string;
}

export class UpdatePersonaDto {
  @IsOptional()
  @IsString()
  personaName?: string;

  @IsOptional()
  demographicsJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  psychographicsText?: string;
}

export class ScanUrlDto {
  @IsString()
  @MinLength(8)
  url!: string;
}

export class CreateOfferingDto {
  @IsIn(["primary", "collection"])
  kind!: "primary" | "collection";

  @IsEnum(OfferingType)
  type!: OfferingType;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sellingPoints?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doNotSay?: string[];
}

export class UpdateOfferingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sellingPoints?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doNotSay?: string[];
}

const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u;

export class ManualOfferingPriceDto {
  @IsEnum(OfferingPriceMode)
  mode!: OfferingPriceMode;

  @IsOptional()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  currentMinAmount?: string | null;

  @IsOptional()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  currentMaxAmount?: string | null;

  @IsOptional()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  regularReferenceMinAmount?: string | null;

  @IsOptional()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  regularReferenceMaxAmount?: string | null;

  @Matches(/^[A-Za-z]{3}$/u)
  currency!: string;
}

export class CreateOfferDto {
  @IsString()
  @MinLength(2)
  offerName!: string;

  @IsString()
  @MinLength(2)
  promoCode!: string;

  @IsString()
  applicabilityScope!: string;

  @IsString()
  validityStart!: string;

  @IsString()
  validityEnd!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  offerName?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  applicabilityScope?: string;

  @IsOptional()
  @IsString()
  validityStart?: string;

  @IsOptional()
  @IsString()
  validityEnd?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCompetitorDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  websiteUrl!: string;

  @IsOptional()
  @IsString()
  whyCompetitor?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}

class AssetMixDto {
  @IsNumber()
  product!: number;

  @IsNumber()
  collection!: number;

  @IsNumber()
  sale!: number;
}

class TierMixDto {
  @IsNumber()
  nano!: number;

  @IsNumber()
  micro!: number;

  @IsNumber()
  midTier!: number;

  @IsNumber()
  mega!: number;

  @IsNumber()
  celebrity!: number;
}

class ObjectiveMixDto {
  @IsNumber()
  pulse!: number;

  @IsNumber()
  proof!: number;

  @IsNumber()
  push!: number;

  @IsNumber()
  production!: number;
}

export class PatchBudgetMixesDto implements StrategyMixPercents {
  @ValidateNested()
  @Type(() => AssetMixDto)
  assetMix!: AssetMixDto;

  @ValidateNested()
  @Type(() => TierMixDto)
  tierMix!: TierMixDto;

  @ValidateNested()
  @Type(() => ObjectiveMixDto)
  objectiveMix!: ObjectiveMixDto;
}

export class PatchBudgetCeilingDto {
  @IsNumber()
  masterMonthlyBudget!: number;
}

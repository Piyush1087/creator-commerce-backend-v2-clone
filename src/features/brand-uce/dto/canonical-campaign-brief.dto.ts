import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import {
  UceBriefCreationSource,
  UceBriefType,
  UceMediaPlatform,
} from "@prisma/client";

/** Transport boundary for canonical and P0-compatibility Deliverable shapes. */
export class CanonicalBriefDeliverableDto {
  @IsOptional()
  @IsUUID()
  deliverable_id?: string;

  @IsString()
  format!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  configuration?: unknown;

  @IsOptional()
  creative_guidance?: unknown;

  @IsOptional()
  @IsUUID()
  amplify_target_deliverable_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  creative_requirements?: string;

  @IsOptional()
  @IsBoolean()
  publishing_required?: boolean;
}

class CanonicalCampaignBriefFieldsDto {
  @IsOptional()
  @IsString()
  brief_name?: string | null;

  @IsOptional()
  @IsString()
  creative_intent?: string | null;

  @IsOptional()
  @IsString()
  creator_brief?: string | null;

  @IsOptional()
  @IsEnum(UceBriefType)
  brief_type?: UceBriefType | null;

  @IsOptional()
  @IsEnum(UceMediaPlatform)
  platform?: UceMediaPlatform | null;

  @IsOptional()
  brief_level_guidance?: unknown;

  @IsOptional()
  reference_content?: unknown;

  @IsOptional()
  usage_rights?: unknown;

  @IsOptional()
  @IsString()
  creator_requirements?: string | null;

  /** P0 compatibility only; never promoted into canonical rich content. */
  @IsOptional()
  @IsString()
  title?: string;

  /** P0 compatibility only; never promoted into canonical rich content. */
  @IsOptional()
  @IsString()
  creative_requirements?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanonicalBriefDeliverableDto)
  deliverables?: CanonicalBriefDeliverableDto[];
}

export class CreateCanonicalCampaignBriefDto extends CanonicalCampaignBriefFieldsDto {
  @IsUUID()
  campaign_asset_id!: string;

  @IsOptional()
  @IsEnum(UceBriefCreationSource)
  creation_source?: UceBriefCreationSource;
}

export class UpdateCanonicalCampaignBriefDto extends CanonicalCampaignBriefFieldsDto {}

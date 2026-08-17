import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CanonicalBriefDeliverableDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  format!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  creative_requirements!: string;

  @IsBoolean()
  publishing_required!: boolean;
}

export class CreateCanonicalCampaignBriefDto {
  @IsUUID()
  campaign_asset_id!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  creative_requirements!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CanonicalBriefDeliverableDto)
  deliverables!: CanonicalBriefDeliverableDto[];
}

export class UpdateCanonicalCampaignBriefDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  creative_requirements?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CanonicalBriefDeliverableDto)
  deliverables?: CanonicalBriefDeliverableDto[];
}

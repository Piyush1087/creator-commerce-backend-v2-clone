import { UceMediaPlatform } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateCampaignBriefDto {
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  internal_title!: string;

  @IsString()
  @MinLength(20)
  creative_guidelines!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UceMediaPlatform, { each: true })
  required_platforms!: UceMediaPlatform[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  deliverable_format_tags!: string[];
}

export class UpdateCampaignBriefDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  internal_title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  creative_guidelines?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UceMediaPlatform, { each: true })
  required_platforms?: UceMediaPlatform[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  deliverable_format_tags?: string[];
}

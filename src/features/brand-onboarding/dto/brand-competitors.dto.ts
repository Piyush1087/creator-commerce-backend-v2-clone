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
import { Type } from "class-transformer";

export class UpsertCompetitorItemDto {
  @IsOptional()
  @IsUUID("4")
  id?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

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

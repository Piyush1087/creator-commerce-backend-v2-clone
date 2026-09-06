import { CollaborationLifecycle, CollaborationStage } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListCollaborationThreadsQueryDto {
  @IsOptional()
  @IsUUID()
  campaign_id?: string;

  @IsOptional()
  @IsUUID()
  brief_id?: string;

  @IsOptional()
  @IsEnum(CollaborationStage)
  stage?: CollaborationStage;

  @IsOptional()
  @IsEnum(CollaborationLifecycle)
  lifecycle?: CollaborationLifecycle;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

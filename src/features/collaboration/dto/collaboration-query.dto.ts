import { UceMilestoneStage } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ListCollaborationThreadsQueryDto {
  @IsOptional()
  @IsUUID()
  campaign_id?: string;

  @IsOptional()
  @IsUUID()
  brief_id?: string;

  @IsOptional()
  @IsEnum(UceMilestoneStage)
  stage?: UceMilestoneStage;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

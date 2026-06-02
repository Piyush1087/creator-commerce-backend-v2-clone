import { UceCollabStatus, UceMilestoneStage, UcePipelineHealthStatus } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class PipelineQueryDto {
  @IsOptional()
  @IsUUID()
  brief_id?: string;

  @IsOptional()
  @IsEnum(UceMilestoneStage)
  stage?: UceMilestoneStage;

  @IsOptional()
  @IsEnum(UcePipelineHealthStatus)
  health?: UcePipelineHealthStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateProspectDto {
  @IsUUID()
  brief_id!: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  instagram_handle!: string;

  @IsEmail()
  creator_email!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  match_score?: number;
}

export class RejectApplicantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  rejection_reason!: string;
}

export class ApproveApplicantDto {
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_quote?: number;
}

export class AddTrackingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  logistics_carrier!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  logistics_tracking_number!: string;
}

export class SubmitContentDraftDto {
  @IsUrl()
  content_draft_url!: string;
}

export class ReviewContentDto {
  @IsIn(["approve", "request_revision", "reject"])
  action!: "approve" | "request_revision" | "reject";
}

export class PublishLivePostDto {
  @IsUrl()
  live_published_url!: string;
}

export class RecordFulfillmentIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class PatchCollaborationStatusDto {
  @IsEnum(UceCollabStatus)
  collab_status!: UceCollabStatus;
}

export class InviteProspectDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outreach_message?: string;
}

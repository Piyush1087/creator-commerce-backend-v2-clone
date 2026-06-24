import { UceCampaignStatus } from "@prisma/client";
import {
  Allow,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import type { IntegratedCampaignWizardPayload } from "../schemas/uce-wizard.schema";

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(UceCampaignStatus)
  status?: UceCampaignStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsIn(["BRAND_AWARENESS", "TRAFFIC_CLICKS", "SALES_CONVERSIONS"])
  objective?: "BRAND_AWARENESS" | "TRAFFIC_CLICKS" | "SALES_CONVERSIONS";
}

/** Nested shape is validated in the service via Zod; `@Allow()` keeps keys through global whitelist. */
export class CreateCampaignWizardDto {
  @Allow()
  strategy!: IntegratedCampaignWizardPayload["strategy"];

  @Allow()
  targeting!: IntegratedCampaignWizardPayload["targeting"];

  @Allow()
  commercials!: IntegratedCampaignWizardPayload["commercials"];
}

export class PatchCampaignStatusDto {
  @IsEnum(UceCampaignStatus)
  status!: UceCampaignStatus;
}

export class PatchCampaignMasterDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  campaign_name?: string;
}

export class PatchDraftCampaignWizardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  campaign_name?: string;

  @IsOptional()
  budget_allocation?: number;

  @IsOptional()
  @IsIn(["BRAND_AWARENESS", "TRAFFIC_CLICKS", "SALES_CONVERSIONS"])
  marketing_objective?: "BRAND_AWARENESS" | "TRAFFIC_CLICKS" | "SALES_CONVERSIONS";
}

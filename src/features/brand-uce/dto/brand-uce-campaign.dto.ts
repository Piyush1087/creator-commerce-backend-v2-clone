import { UceCampaignStatus } from "@prisma/client";
import {
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

export class CreateCampaignWizardDto {
  strategy!: IntegratedCampaignWizardPayload["strategy"];
  targeting!: IntegratedCampaignWizardPayload["targeting"];
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

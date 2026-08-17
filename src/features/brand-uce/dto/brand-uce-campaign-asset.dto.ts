import { IsEnum, IsUUID } from "class-validator";

export enum CampaignAssetSelectionKind {
  BRAND = "BRAND",
  OFFERING = "OFFERING",
  OFFER = "OFFER",
}

export class CreateCampaignAssetDto {
  @IsEnum(CampaignAssetSelectionKind)
  kind!: CampaignAssetSelectionKind;

  @IsUUID()
  entity_id!: string;
}

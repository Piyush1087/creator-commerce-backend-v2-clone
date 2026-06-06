import { IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CreatorApplyToCampaignDto {
  @IsUUID()
  brief_id!: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  match_score?: number;
}

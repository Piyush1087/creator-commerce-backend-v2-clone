import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/**
 * Create uses MasterAddAssetDrawerSchema (Zod) on the controller.
 * Inventory is not accepted on create — patch via UpdateCampaignProductDto.
 */
export class UpdateCampaignProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  sku_code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  product_name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  inventory_count?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  cost_per_unit?: number;

  @IsOptional()
  @IsUrl()
  image_url?: string | null;
}

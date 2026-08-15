import { CollaborationMediaPhase, FulfillmentIssueType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class PostCollaborationMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class SubmitCreatorQuoteDto {
  @IsNumber()
  @Min(0)
  total_quote!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  product_retail_value?: number;
}

export class BrandCounterOfferDto {
  @IsNumber()
  @Min(0)
  counter_offer!: number;
}

export class AcceptCommercialsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  final_quote?: number;
}

export class FundEscrowDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  escrow_vault_id?: string;
}

export class UploadReceiptDto {
  @IsUrl()
  receipt_url!: string;
}

export class DispatchLogisticsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tracking_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  courier_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  digital_access_credentials?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  redemption_code?: string;
}

export class ReportFulfillmentIssueDto {
  @IsEnum(FulfillmentIssueType)
  issue_type!: FulfillmentIssueType;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;
}

export class SubmitCollaborationMediaDto {
  @IsEnum(CollaborationMediaPhase)
  phase!: CollaborationMediaPhase;

  @IsUrl()
  media_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deliverable_type?: string;

  @IsOptional()
  @IsBoolean()
  is_aspect_ratio_verified?: boolean;
}

export class ReviewCollaborationMediaDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  brand_feedback?: string;
}

export class SubmitLivePostDto {
  @IsUrl()
  live_post_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  partnership_ad_code?: string;
}

export class SubmitCollaborationReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_text?: string;
}

export class UpsertCreatorShippingAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipient_name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address_line_1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address_line_2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state_region?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  postal_code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

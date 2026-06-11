import { SubscriptionTier } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
} from "class-validator";

export class BootstrapTrialDto {
  @IsOptional()
  @IsIn(["INR", "USD"])
  currency?: "INR" | "USD";
}

export class InitializeRazorpayTrialDto {
  @IsOptional()
  @IsIn(["INR", "USD"])
  currency?: "INR" | "USD";
}

export class ChangeTierDto {
  @IsEnum(SubscriptionTier)
  target_tier!: SubscriptionTier;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cancel_at_cycle_end?: boolean;
}

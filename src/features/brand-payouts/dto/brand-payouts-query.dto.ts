import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import type {
  BrandPayoutsActivityCategory,
  BrandPayoutsBrandReturnStatus,
  BrandPayoutsObligationGate,
  BrandPayoutsObligationLifecycle,
  BrandPayoutsReserveRequestStatus,
} from "../contracts/brand-payouts-v2.contract";

const EXPLICIT_OFFSET_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const ACTIVITY_CATEGORIES: readonly BrandPayoutsActivityCategory[] = [
  "MONEY_MOVEMENT",
  "PROTECTED_ALLOCATION",
  "BUSINESS_OBLIGATION",
  "PROVIDER_EXECUTION",
  "RETURN_REFUND_REVERSAL",
  "INFORMATIONAL_LIFECYCLE",
];
const OBLIGATION_LIFECYCLES: readonly BrandPayoutsObligationLifecycle[] = [
  "SCHEDULED",
  "READY_QUEUED",
  "PROCESSING",
  "HELD_RELEASE_PENDING",
  "SETTLED",
  "FAILED_RETRYABLE",
  "ACTION_REQUIRED",
  "PARTIAL_REVERSAL",
  "FULL_REVERSAL",
  "LEGACY_UNRECONCILED",
];
const OBLIGATION_GATES: readonly BrandPayoutsObligationGate[] = [
  "NOT_YET_DUE",
  "CREATOR_SETUP_REQUIRED",
  "UNSUPPORTED_GEOGRAPHY_OR_RAIL",
  "PROVIDER_REVIEW",
  "PROTECTED_FUNDING_BLOCKED",
  "RESOLUTION_BLOCKED",
  "DEPENDENCY_UNAVAILABLE",
  "ELIGIBLE",
];
const RETURN_STATUSES: readonly BrandPayoutsBrandReturnStatus[] = [
  "REQUESTED",
  "ALLOCATING_ORIGINAL_SOURCES",
  "PROCESSING",
  "PARTIAL",
  "COMPLETED",
  "ACTION_REQUIRED",
  "FAILED",
];
const RESERVE_STATUSES: readonly BrandPayoutsReserveRequestStatus[] = [
  "REQUESTED",
  "APPROVAL_REQUIRED",
  "APPROVED_AWAITING_EXECUTION",
  "EXECUTING",
  "AWAITING_FUNDS",
  "COMPLETED",
  "ACTION_REQUIRED",
  "SUPERSEDED",
  "LEGACY_UNRECONCILED",
];

const toInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value;
const toList = ({ value }: { value: unknown }): unknown => {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return value;
};

export class BrandPayoutsPageQueryDto {
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  cursor?: string;
}

export class BrandPayoutsActivityQueryDto extends BrandPayoutsPageQueryDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(ACTIVITY_CATEGORIES, { each: true })
  categories?: BrandPayoutsActivityCategory[];

  @IsOptional()
  @IsString()
  @Matches(EXPLICIT_OFFSET_INSTANT)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(EXPLICIT_OFFSET_INSTANT)
  to?: string;
}

export class BrandPayoutsActivityCsvQueryDto {
  @IsString()
  @Matches(EXPLICIT_OFFSET_INSTANT)
  from!: string;

  @IsString()
  @Matches(EXPLICIT_OFFSET_INSTANT)
  to!: string;

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(ACTIVITY_CATEGORIES, { each: true })
  categories?: BrandPayoutsActivityCategory[];
}

export class BrandPayoutsObligationsQueryDto extends BrandPayoutsPageQueryDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(OBLIGATION_LIFECYCLES, { each: true })
  lifecycles?: BrandPayoutsObligationLifecycle[];

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(OBLIGATION_GATES, { each: true })
  gates?: BrandPayoutsObligationGate[];
}

export class BrandPayoutsBrandReturnsQueryDto extends BrandPayoutsPageQueryDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(RETURN_STATUSES, { each: true })
  statuses?: BrandPayoutsBrandReturnStatus[];
}

export class BrandPayoutsReserveRequestsQueryDto extends BrandPayoutsPageQueryDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayUnique()
  @IsIn(RESERVE_STATUSES, { each: true })
  statuses?: BrandPayoutsReserveRequestStatus[];
}

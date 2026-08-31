import { UceMilestoneStage } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class TopUpIntentDto {
  @IsNumber()
  @Min(0.01)
  target_allocation!: number;

  @IsUUID()
  idempotency_key!: string;
}

export class CalculateEscrowBreakdownDto {
  @IsNumber()
  @Min(0.01)
  gross_creator_quote!: number;

  @IsIn(["INR", "USD"])
  currency!: "INR" | "USD";

  @IsIn([0, 1, 2])
  expected_tds_percentage!: 0 | 1 | 2;
}

export class ExecuteLockAllocationDto {
  @IsUUID()
  collaboration_id!: string;

  @IsNumber()
  @Min(0.01)
  gross_creator_quote!: number;

  @IsIn([0, 1, 2])
  expected_tds_percentage!: 0 | 1 | 2;
}

export class ExecuteTrancheDisbursalDto {
  @IsUUID()
  collaboration_id!: string;

  @IsIn(["ADVANCE_30", "FINAL_70"])
  tranche!: "ADVANCE_30" | "FINAL_70";
}

export class TransitionStageDto {
  @IsUUID()
  collaboration_id!: string;

  @IsEnum(UceMilestoneStage)
  target_stage!: UceMilestoneStage;
}

export class TriggerCancellationRefundDto {
  @IsUUID()
  collaboration_id!: string;

  @IsIn([
    "BR_03_LOGISTICS_STRIKE",
    "BR_04_HARD_STOP_REJECTION",
    "MUTUAL_TERMINATION",
  ])
  reason_code!:
    | "BR_03_LOGISTICS_STRIKE"
    | "BR_04_HARD_STOP_REJECTION"
    | "MUTUAL_TERMINATION";

  @IsString()
  @MinLength(5)
  diagnostic_notes!: string;
}

export class ListEscrowLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateBrandReturnDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsUUID()
  idempotency_identity!: string;
}

export class ListBrandReturnsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

import { PlannerWorkflowStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class PatchPlannerCardDto {
  @IsOptional()
  @IsEnum(PlannerWorkflowStatus)
  workflowStatus?: PlannerWorkflowStatus;
}

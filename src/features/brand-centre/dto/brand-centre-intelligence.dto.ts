import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class ActionableStepDto {
  @IsString()
  stepId!: string;

  @IsString()
  stepLabel!: string;

  @IsBoolean()
  isCompleted!: boolean;
}

export class PatchLeakDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionableStepDto)
  actionableStepsChecklist?: ActionableStepDto[];

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class LeaksQueryDto {
  @IsOptional()
  @IsIn(["active", "archived"])
  filter?: "active" | "archived";
}

import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const toInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value;

export class CreatorPayoutsPageQueryDto {
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

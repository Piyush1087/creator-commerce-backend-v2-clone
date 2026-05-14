import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class DiscoverValidateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  url!: string;
}

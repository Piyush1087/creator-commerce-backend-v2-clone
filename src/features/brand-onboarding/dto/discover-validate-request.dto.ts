import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class DiscoverValidateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  url!: string;

  @IsBoolean()
  ownershipAuthorizationAttested!: boolean;

  @IsBoolean()
  termsAccepted!: boolean;

  @IsBoolean()
  privacyPolicyAccepted!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  termsVersion!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  privacyPolicyVersion!: string;
}

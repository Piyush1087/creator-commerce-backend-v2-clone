import { UserRole } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from "class-validator";

/** Pre-prod login OTP; aligns with brand verification stub. */
export const BRAND_LOGIN_STUB_OTP = "123456";

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  /** OTP path (brand + creator). Omit when using password. */
  @ValidateIf((dto: LoginDto) => !dto.password)
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp?: string;

  /** Creator password path. Omit when using OTP. */
  @ValidateIf((dto: LoginDto) => !dto.otp)
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password?: string;

  /** Optional — when omitted, role is inferred from the user record. */
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

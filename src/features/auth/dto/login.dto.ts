import { UserRole } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
} from "class-validator";

/** Pre-prod login OTP; aligns with brand verification stub. */
export const BRAND_LOGIN_STUB_OTP = "123456";

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role!: UserRole;
}

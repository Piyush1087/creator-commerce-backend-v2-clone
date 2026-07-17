import { IsEmail, IsString, Length, MaxLength } from "class-validator";

export class VerifyBrandVerificationDto {
  @IsEmail(
    {},
    { message: "Please enter a valid email address (e.g., name@brand.in)" },
  )
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(6, 6, { message: "Enter the 6-digit code." })
  otp!: string;
}

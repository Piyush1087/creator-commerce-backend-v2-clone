import { IsEmail, IsString, MaxLength } from "class-validator";

export class SendBrandVerificationDto {
  @IsEmail(
    {},
    { message: "Please enter a valid email address (e.g., name@brand.in)" },
  )
  @MaxLength(254)
  email!: string;
}

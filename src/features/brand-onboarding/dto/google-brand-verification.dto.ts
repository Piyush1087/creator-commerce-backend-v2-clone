import { IsNotEmpty, IsString } from "class-validator";

export class GoogleBrandVerificationDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

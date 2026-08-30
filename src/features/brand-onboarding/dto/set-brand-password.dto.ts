import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class SetBrandPasswordDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long." })
  @MaxLength(128, { message: "Password must be at most 128 characters long." })
  password!: string;
}

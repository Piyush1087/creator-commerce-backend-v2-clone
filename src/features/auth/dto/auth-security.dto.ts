import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class EmailOnlyDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class VerifyEmailOtpDto extends EmailOnlyDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class CompletePasswordResetDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

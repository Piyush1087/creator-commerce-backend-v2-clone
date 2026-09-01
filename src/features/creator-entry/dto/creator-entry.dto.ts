import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreatorPasswordRegistrationDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class CreatorRegistrationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class CreatorRegistrationOtpDto extends CreatorRegistrationEmailDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class CreatorGoogleRegistrationDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

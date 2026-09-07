import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  /** Compatibility-only. It has no account-creation authority. */
  @IsOptional()
  @IsUUID()
  onboardingTrackId?: string;
}

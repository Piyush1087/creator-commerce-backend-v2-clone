import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  /** Required for new creator signup during onboarding funnel. */
  @IsOptional()
  @IsUUID()
  onboardingTrackId?: string;
}

import { IsString, MinLength } from "class-validator";

export class ClaimInvitationDto {
  @IsString()
  @MinLength(8)
  invite_token!: string;
}

import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class IdentityTestDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  websiteUrl!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entityId?: string;
}

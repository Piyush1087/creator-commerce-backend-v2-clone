import { IsNotEmpty, IsUUID } from "class-validator";

export class CompleteBrandRegistrationDto {
  @IsUUID()
  @IsNotEmpty()
  brandProfileId!: string;
}

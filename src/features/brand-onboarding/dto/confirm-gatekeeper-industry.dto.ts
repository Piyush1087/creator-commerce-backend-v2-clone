import { IndustryVertical } from "@prisma/client";
import { Equals, IsBoolean, IsEnum } from "class-validator";

export class ConfirmGatekeeperIndustryDto {
  @IsEnum(IndustryVertical)
  selectedIndustry!: IndustryVertical;

  @IsBoolean()
  @Equals(true)
  explicitConfirmation!: true;
}

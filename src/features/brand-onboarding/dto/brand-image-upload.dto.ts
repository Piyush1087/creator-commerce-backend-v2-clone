import { IsOptional, IsString, MaxLength } from "class-validator";

/** Base64 image upload body shared by brand logo / offering / competitor uploads. */
export class UploadBrandImageDto {
  @IsString()
  @MaxLength(8_000_000)
  imageBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentType?: string;
}

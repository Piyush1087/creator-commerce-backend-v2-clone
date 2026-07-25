import { BadRequestException } from "@nestjs/common";

export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export type ParsedUploadImage = {
  buffer: Buffer;
  contentType: string;
};

export function parseUploadImageBase64(args: {
  imageBase64: string;
  contentType?: string | null;
}): ParsedUploadImage {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(args.imageBase64, "base64");
  } catch {
    throw new BadRequestException("Image payload is not valid base64.");
  }
  if (!buffer.length) {
    throw new BadRequestException("Image file is empty.");
  }
  if (buffer.length > MAX_UPLOAD_IMAGE_BYTES) {
    throw new BadRequestException(
      `Image exceeds the ${MAX_UPLOAD_IMAGE_BYTES / (1024 * 1024)}MB limit.`,
    );
  }

  const contentType = args.contentType?.trim().toLowerCase() || "image/jpeg";
  if (
    !ALLOWED_IMAGE_CONTENT_TYPES.has(contentType) &&
    !contentType.startsWith("image/")
  ) {
    throw new BadRequestException(
      "Unsupported image type. Use JPEG, PNG, WebP, GIF, SVG, or ICO.",
    );
  }

  return { buffer, contentType };
}

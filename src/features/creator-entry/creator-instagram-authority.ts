import { BadRequestException } from "@nestjs/common";

export const CREATOR_INSTAGRAM_BASIC_PERMISSION = "instagram_business_basic";
export const CREATOR_INSTAGRAM_INSIGHTS_PERMISSION =
  "instagram_business_manage_insights";

const CREATOR_INSTAGRAM_REDIRECT_URIS = new Set([
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback",
  "https://dashboard.thecreatorshop.in/creator-marketplace/callback",
]);

export function resolveCreatorInstagramRedirectUri(): string {
  const value = process.env.CREATOR_INSTAGRAM_REDIRECT_URI?.trim();
  if (!value || !CREATOR_INSTAGRAM_REDIRECT_URIS.has(value)) {
    throw new BadRequestException({
      code: "CREATOR_INSTAGRAM_REDIRECT_URI_INVALID",
      message: "Creator Instagram authorization is not configured.",
    });
  }
  return value;
}

export function normalizeCreatorInstagramPermissions(
  values: string[],
): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

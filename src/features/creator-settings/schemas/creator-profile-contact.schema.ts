import { z } from "zod";

import { isIso31661Alpha2CountryCode } from "../../../shared/geography/iso-country-code";
import { normalizeCreatorContactPhone } from "../contact/creator-contact-phone";

const nullableTrimmedText = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value));

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use an ISO-3166-1 alpha-2 country code")
  .refine(
    isIso31661Alpha2CountryCode,
    "Use an assigned ISO-3166-1 alpha-2 country code",
  );

export const UpdateCreatorCanonicalProfileSchema = z
  .object({
    userName: nullableTrimmedText(200),
    displayName: nullableTrimmedText(100),
    avatarUrl: z
      .union([
        z
          .string()
          .trim()
          .url()
          .max(2048)
          .refine((value) => {
            const protocol = new URL(value).protocol;
            return protocol === "https:" || protocol === "http:";
          }, "Avatar URL must use HTTP or HTTPS"),
        z.null(),
      ])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    primaryRegion: countryCode.optional(),
    organizationName: z.string().trim().min(2).max(150).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one canonical profile field is required.",
  });

export const UpsertCreatorDefaultContactSchema = z
  .object({
    recipientName: z.string().trim().min(2).max(150),
    addressLine1: z.string().trim().min(3).max(255),
    addressLine2: nullableTrimmedText(255),
    city: z.string().trim().min(1).max(120),
    stateRegion: nullableTrimmedText(120),
    postalCode: z.string().trim().min(2).max(32),
    countryCode,
    phoneCountryCallingCode: nullableTrimmedText(8),
    phoneNationalNumber: nullableTrimmedText(32),
    deliveryInstructions: nullableTrimmedText(2000),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      normalizeCreatorContactPhone(
        value.phoneCountryCallingCode,
        value.phoneNationalNumber,
      );
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNationalNumber"],
        message:
          error instanceof Error ? error.message : "Phone number is invalid.",
      });
    }
  });

export type UpdateCreatorCanonicalProfileInput = z.infer<
  typeof UpdateCreatorCanonicalProfileSchema
>;
export type UpsertCreatorDefaultContactInput = z.infer<
  typeof UpsertCreatorDefaultContactSchema
>;

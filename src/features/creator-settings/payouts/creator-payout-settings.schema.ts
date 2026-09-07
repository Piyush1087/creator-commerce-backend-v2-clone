import { z } from "zod";

const payeeTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
const countryCodeSchema = z.enum(["IN", "US"]);

const commonDestinationFields = {
  payeeType: payeeTypeSchema,
  beneficiaryName: z.string().trim().min(2).max(255),
  countryCode: countryCodeSchema,
};

const bankDestinationSchema = z
  .object({
    ...commonDestinationFields,
    destinationType: z.literal("BANK_ACCOUNT"),
    currencyCode: z.enum(["INR", "USD"]),
    accountNumber: z.string().trim().min(4).max(34).regex(/^\d+$/),
    confirmAccountNumber: z.string().trim().min(4).max(34).regex(/^\d+$/),
    routingCode: z.string().trim().min(5).max(15).toUpperCase(),
  })
  .strict();

const upiDestinationSchema = z
  .object({
    ...commonDestinationFields,
    destinationType: z.literal("UPI"),
    currencyCode: z.literal("INR"),
    upiId: z
      .string()
      .trim()
      .toLowerCase()
      .min(5)
      .max(100)
      .regex(/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/),
  })
  .strict();

const paypalDestinationSchema = z
  .object({
    ...commonDestinationFields,
    destinationType: z.literal("PAYPAL"),
    currencyCode: z.literal("USD"),
    paypalEmail: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

export const creatorPayoutDestinationSchema = z
  .discriminatedUnion("destinationType", [
    bankDestinationSchema,
    upiDestinationSchema,
    paypalDestinationSchema,
  ])
  .superRefine((input, context) => {
    if (
      !isSupportedCreatorPayoutRail(
        input.countryCode,
        input.destinationType,
        input.currencyCode,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationType"],
        message: "This country, currency, and payout method are not supported.",
      });
      return;
    }

    if (input.destinationType !== "BANK_ACCOUNT") {
      return;
    }
    if (input.accountNumber !== input.confirmAccountNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmAccountNumber"],
        message: "Bank account inputs do not match.",
      });
    }
    if (input.countryCode === "IN") {
      if (input.accountNumber.length < 6 || input.accountNumber.length > 18) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountNumber"],
          message: "Indian bank account numbers must contain 6 to 18 digits.",
        });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.routingCode)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routingCode"],
          message: "Enter a valid IFSC code.",
        });
      }
    }
    if (input.countryCode === "US") {
      if (input.accountNumber.length > 17) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountNumber"],
          message: "US bank account numbers must contain 4 to 17 digits.",
        });
      }
      if (!/^\d{9}$/.test(input.routingCode)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routingCode"],
          message: "Enter a valid 9-digit routing number.",
        });
      }
    }
  });

export const creatorLegalProfileSchema = z
  .object({
    payeeType: payeeTypeSchema,
    legalName: z.string().trim().min(2).max(255),
    countryCode: countryCodeSchema,
    addressLine1: z.string().trim().min(5).max(255),
    addressLine2: z
      .string()
      .trim()
      .max(255)
      .optional()
      .transform((value) => value || null),
    city: z.string().trim().min(2).max(120),
    stateRegion: z.string().trim().min(2).max(120),
    postalCode: z.string().trim().min(3).max(32),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.countryCode === "IN" && !/^\d{6}$/.test(input.postalCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Enter a valid 6-digit Indian postal code.",
      });
    }
    if (
      input.countryCode === "US" &&
      !/^\d{5}(?:-\d{4})?$/.test(input.postalCode)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Enter a valid US ZIP code.",
      });
    }
  });

export type CreatorPayoutDestinationInput = z.infer<
  typeof creatorPayoutDestinationSchema
>;
export type CreatorLegalProfileInput = z.infer<
  typeof creatorLegalProfileSchema
>;

export function isSupportedCreatorPayoutRail(
  countryCode: string,
  destinationType: string,
  currencyCode: string,
): boolean {
  return (
    (countryCode === "IN" &&
      currencyCode === "INR" &&
      (destinationType === "BANK_ACCOUNT" || destinationType === "UPI")) ||
    (countryCode === "US" &&
      currencyCode === "USD" &&
      (destinationType === "BANK_ACCOUNT" || destinationType === "PAYPAL"))
  );
}

import { z } from "zod";

const envelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};

export const confirmDefaultDestinationSchema = z
  .object({
    ...envelope,
    sourceContactId: z.string().uuid(),
    sourceContactUpdatedAt: z.string().datetime(),
  })
  .strict();

export const overrideDestinationSchema = z
  .object({
    ...envelope,
    recipientName: z.string().trim().min(1).max(200),
    addressLine1: z.string().trim().min(1).max(300),
    addressLine2: z.string().trim().max(300).nullable().optional(),
    city: z.string().trim().min(1).max(120),
    stateRegion: z.string().trim().max(120).nullable().optional(),
    postalCode: z.string().trim().min(1).max(32),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .transform((v) => v.toUpperCase()),
    phoneCountryCallingCode: z.string().trim().max(8).nullable().optional(),
    phoneNationalNumber: z.string().trim().max(32).nullable().optional(),
    phoneE164: z.string().trim().max(20).nullable().optional(),
    deliveryInstructions: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type ConfirmDefaultDestinationInput = z.infer<
  typeof confirmDefaultDestinationSchema
>;
export type OverrideDestinationInput = z.infer<
  typeof overrideDestinationSchema
>;

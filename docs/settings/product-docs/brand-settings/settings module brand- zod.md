Here is the single, production-ready TypeScript file containing the complete **Zod validation suite for the Brand-Side Settings Module**.  
To maintain clean architecture, the code is compartmentalized into explicit logical zones matching the schema extensions, culminating in a unified, master schema validation object.  
TypeScript  
import { z } from 'zod';

// \=============================================================================  
// ENUMS & CONSTANT STANDARDS  
// \=============================================================================  
export const BrandRoleEnum \= z.enum(\['BRAND\_OWNER', 'FINANCE\_ADMIN', 'CAMPAIGN\_MANAGER'\]);  
export const NotificationChannelEnum \= z.enum(\['EMAIL', 'IN\_APP', 'SLACK\_WEBHOOK'\]);  
export const NotificationCategoryEnum \= z.enum(\[  
  'ESCROW\_LOW\_BALANCE',  
  'MILESTONE\_RELEASE\_REQUEST',  
  'TAX\_COMPLIANCE\_ALERT',  
  'CAMPAIGN\_BUDGET\_OVERRUN',  
\]);

// Regular Expressions for strict statutory validation  
const GSTIN\_REGEX \= /^\[0-9\]{2}\[A-Z\]{5}\[0-9\]{4}\[A-Z\]{1}\[1-9A-Z\]{1}Z\[0-9A-Z\]{1}$/;  
const PAN\_REGEX \= /^\[A-Z\]{5}\[0-9\]{4}\[A-Z\]{1}$/;  
const IFSC\_REGEX \= /^\[A-Z\]{4}0\[A-Z0-9\]{6}$/;

// \=============================================================================  
// ZONE 1: TEAM ACCESS CONTROL (RBAC MATRIX)  
// \=============================================================================  
export const BrandTeamMemberSchema \= z.object({  
  userId: z.string().uuid({ message: 'User ID must be a valid RFC4122 UUID.' }),  
  role: BrandRoleEnum,  
  isActive: z.boolean().default(true),  
});

export const UpdateTeamRoleSchema \= z.object({  
  membershipId: z.string().uuid({ message: 'Membership ID must be a valid RFC4122 UUID.' }),  
  role: BrandRoleEnum,  
});

// \=============================================================================  
// ZONE 2: TAXATION, COMPLIANCE & BILLING PROFILES  
// \=============================================================================  
export const BrandBillingProfileSchema \= z.object({  
  registeredCompanyName: z  
    .string()  
    .min(2, { message: 'Company name must be at least 2 characters long.' })  
    .max(255, { message: 'Company name cannot exceed 255 characters.' }),  
  corporateBillingAddress: z  
    .string()  
    .min(10, { message: 'Please provide a complete physical billing address.' }),  
  gstin: z  
    .string()  
    .trim()  
    .uppercase()  
    .regex(GSTIN\_REGEX, { message: 'Invalid Indian GSTIN format code.' })  
    .nullable()  
    .or(z.literal('')),  
  pan: z  
    .string()  
    .trim()  
    .uppercase()  
    .regex(PAN\_REGEX, { message: 'Invalid Indian Income Tax PAN format.' })  
    .nullable()  
    .or(z.literal('')),  
  defaultTdsPercentage: z  
    .number()  
    .min(0.00, { message: 'TDS configuration floor cannot be negative.' })  
    .max(10.00, { message: 'TDS configuration ceiling cannot exceed 10.00%.' })  
    .default(2.00),  
  currencyPreference: z  
    .string()  
    .min(3)  
    .max(3)  
    .default('INR')  
    .transform((val) \=\> val.toUpperCase()),  
});

// \=============================================================================  
// ZONE 3: REVERSE PAYOUT / WITHDRAWAL BENEFICIARY CONFIGURATION  
// \=============================================================================  
export const BrandWithdrawalAccountSchema \= z.object({  
  beneficiaryName: z  
    .string()  
    .min(3, { message: 'Beneficiary bank account title name must match your legal passbook.' })  
    .max(255),  
  bankName: z  
    .string()  
    .min(2, { message: 'Bank structural branding label is required.' }),  
  accountNumber: z  
    .string()  
    .min(9, { message: 'Bank account lines must fall between 9 and 18 digital strings.' })  
    .max(18)  
    .regex(/^\\d+$/, { message: 'Account footprint structural lines must consist solely of digits.' }),  
  confirmAccountNumber: z.string(),  
  ifscCode: z  
    .string()  
    .trim()  
    .uppercase()  
    .regex(IFSC\_REGEX, { message: 'Malformed Indian Bank Routing IFSC code standard detected.' }),  
}).refine((data) \=\> data.accountNumber \=== data.confirmAccountNumber, {  
  message: 'Security validation check failure: Bank account inputs do not match.',  
  path: \['confirmAccountNumber'\],  
});

// \=============================================================================  
// ZONE 4: GRANULAR NOTIFICATION ALERTS & CHANNEL ROUTING  
// \=============================================================================  
export const NotificationSettingLineSchema \= z.object({  
  category: NotificationCategoryEnum,  
  channel: NotificationChannelEnum,  
  isEnabled: z.boolean().default(true),  
  slackWebhookUrl: z  
    .string()  
    .url({ message: 'Target routing must resolve into a fully structured webhook URI.' })  
    .nullable()  
    .optional()  
    .or(z.literal('')),  
}).refine((data) \=\> {  
  if (data.channel \=== 'SLACK\_WEBHOOK' && data.isEnabled && \!data.slackWebhookUrl) {  
    return false;  
  }  
  return true;  
}, {  
  message: 'A structured target URL parameter is required when Slack webhooks are activated.',  
  path: \['slackWebhookUrl'\],  
});

export const BulkNotificationSettingsSchema \= z.object({  
  settings: z.array(NotificationSettingLineSchema),  
});

// \=============================================================================  
// MASTER UNIFIED AGGREGATION OBJECT SCHEMA  
// \=============================================================================  
export const MasterBrandSettingsPayloadSchema \= z.object({  
  brandId: z.string().uuid({ message: 'The parent context brand routing parameter must be an explicit UUID.' }),  
  billingProfile: BrandBillingProfileSchema,  
  withdrawalAccount: BrandWithdrawalAccountSchema.optional(),  
  notificationPreferences: z.array(NotificationSettingLineSchema),  
});

// Export compilation types for injection across controller endpoints  
export type BrandTeamMemberDto \= z.infer\<typeof BrandTeamMemberSchema\>;  
export type UpdateTeamRoleDto \= z.infer\<typeof UpdateTeamRoleSchema\>;  
export type BrandBillingProfileDto \= z.infer\<typeof BrandBillingProfileSchema\>;  
export type BrandWithdrawalAccountDto \= z.infer\<typeof BrandWithdrawalAccountSchema\>;  
export type NotificationSettingLineDto \= z.infer\<typeof NotificationSettingLineSchema\>;  
export type MasterBrandSettingsPayloadDto \= z.infer\<typeof MasterBrandSettingsPayloadSchema\>;

### **Architectural Validation Protections Built-In:**

1. **The Double-Entry Shield**: The BrandWithdrawalAccountSchema uses a cross-field .refine() rule to match accountNumber against confirmAccountNumber directly at the application entrance, blocking malformed payment routing parameters before they hit database connection streams.  
2. **Dynamic Conditional Triggers**: The notification schema actively validates constraints on the fly. If a user sets the channel to SLACK\_WEBHOOK and marks it active, Zod dynamically converts the slackWebhookUrl parameter from optional to strictly mandatory.  
3. **Implicit Standard Transformations**: Fields like gstin, pan, and ifscCode utilize .trim().uppercase() pre-processors, ensuring uniform capital sanitization before passing strings into downstream microservices.


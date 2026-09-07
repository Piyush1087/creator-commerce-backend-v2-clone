import { z } from "zod";

const commandKey = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:_-]*$/);

export const approveReserveCommandSchema = z
  .object({
    reserve_instruction_id: z.string().uuid(),
    idempotency_key: commandKey,
  })
  .strict();

export type ApproveReserveCommand = z.infer<typeof approveReserveCommandSchema>;

export function parseApproveReserveCommand(
  raw: unknown,
): ApproveReserveCommand {
  return approveReserveCommandSchema.parse(raw);
}

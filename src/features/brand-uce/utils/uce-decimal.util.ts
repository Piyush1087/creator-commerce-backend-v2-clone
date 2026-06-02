import { Decimal } from "@prisma/client/runtime/library";

export function decimalToNumber(value: Decimal | null | undefined): number {
  if (value == null) {
    return 0;
  }
  return Number(value.toString());
}

export function splitEscrowQuote(
  totalQuote: number,
  advancePercent: number,
): { advance30Value: number; balance70Value: number } {
  const advance30Value =
    Math.round(totalQuote * (advancePercent / 100) * 100) / 100;
  const balance70Value =
    Math.round((totalQuote - advance30Value) * 100) / 100;
  return { advance30Value, balance70Value };
}

export const INSTAGRAM_C2_CALCULATION_CONTRACT =
  "instagram-c2-deterministic-foundations-v1" as const;

export type ExactRatio = Readonly<{
  numerator: string;
  denominator: string;
  decimal: string;
}>;

const SCALE = 1_000_000n;

export function exactRatio(
  numerator: bigint | number,
  denominator: bigint | number,
): ExactRatio | null {
  const n = asInteger(numerator);
  const d = asInteger(denominator);
  if (d === 0n) return null;
  const negative = n < 0n !== d < 0n;
  const absoluteNumerator = n < 0n ? -n : n;
  const absoluteDenominator = d < 0n ? -d : d;
  let scaled = (absoluteNumerator * SCALE) / absoluteDenominator;
  const remainder = (absoluteNumerator * SCALE) % absoluteDenominator;
  if (remainder * 2n >= absoluteDenominator) scaled += 1n;
  const whole = scaled / SCALE;
  const fraction = (scaled % SCALE).toString().padStart(6, "0");
  const sign = negative && scaled !== 0n ? "-" : "";
  return {
    numerator: n.toString(),
    denominator: d.toString(),
    decimal: `${sign}${whole}.${fraction}`,
  };
}

export function exactMean(values: readonly number[]): ExactRatio | null {
  if (values.length === 0) return null;
  return exactRatio(
    values.reduce((sum, value) => sum + asInteger(value), 0n),
    values.length,
  );
}

export function exactMedian(values: readonly number[]): ExactRatio | null {
  if (values.length === 0) return null;
  const sorted = values
    .map(asInteger)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? exactRatio(sorted[middle]!, 1n)
    : exactRatio(sorted[middle - 1]! + sorted[middle]!, 2n);
}

function asInteger(value: bigint | number): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value))
    throw new Error("C2_EXACT_INTEGER_REQUIRED");
  return BigInt(value);
}

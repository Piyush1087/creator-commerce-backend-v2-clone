import type { HomeResponseState, HomeSourceState } from "./home.types";

export function uniqueHomeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function homeResponseState(
  states: readonly HomeSourceState[],
): HomeResponseState {
  if (states.every((state) => state === "UNAVAILABLE")) return "UNAVAILABLE";
  return states.every((state) => state === "READY") ? "READY" : "PARTIAL";
}

export function newestFirst<T extends { occurredAt: string; id: string }>(
  values: readonly T[],
): T[] {
  return [...values].sort(
    (left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      left.id.localeCompare(right.id),
  );
}

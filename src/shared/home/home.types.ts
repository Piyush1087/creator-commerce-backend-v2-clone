export const HOME_SOURCE_STATES = ["READY", "PARTIAL", "UNAVAILABLE"] as const;
export const HOME_SECTION_STATES = [
  "READY",
  "EMPTY",
  "PARTIAL",
  "UNAVAILABLE",
] as const;
export const HOME_RESPONSE_STATES = [
  "READY",
  "PARTIAL",
  "UNAVAILABLE",
] as const;
export const HOME_FRESHNESS_STATES = ["CURRENT", "STALE", "UNKNOWN"] as const;

export type HomeSourceState = (typeof HOME_SOURCE_STATES)[number];
export type HomeSectionState = (typeof HOME_SECTION_STATES)[number];
export type HomeResponseState = (typeof HOME_RESPONSE_STATES)[number];
export type HomeFreshnessState = (typeof HOME_FRESHNESS_STATES)[number];

export type HomeObservation = Readonly<{
  state: HomeSourceState;
  freshness: HomeFreshnessState;
  observedAt: string;
  truncated: boolean;
  limitations: string[];
}>;

import type {
  BrandHomePriorityTier,
  BrandHomeSectionId,
} from "./brand-home.contract";
import type { BrandHomeItem } from "./brand-home.schema";

export type BrandHomeCandidate = BrandHomeItem & {
  readonly sectionId: BrandHomeSectionId;
  readonly deduplicationKey: string;
};

export type BrandHomeSourceState = Readonly<{
  sourceDomain: BrandHomeItem["sourceDomains"][number];
  state: "READY" | "PARTIAL" | "UNAVAILABLE";
  freshness: "CURRENT" | "STALE" | "UNKNOWN";
  observedAt: string;
  truncated: boolean;
  limitations: string[];
}>;

export const BRAND_HOME_PRIORITY_RANK: Readonly<
  Record<BrandHomePriorityTier, number>
> = {
  BLOCKED_FAILED_ACTION_REQUIRED: 0,
  DEADLINE_SLA_TIME_SENSITIVE: 1,
  MATERIAL_SETUP_CAPABILITY_BLOCKER: 2,
  MATERIAL_OPPORTUNITY: 3,
  NEW_OR_CHANGED_INTELLIGENCE: 4,
  MEANINGFUL_MOMENTUM: 5,
};

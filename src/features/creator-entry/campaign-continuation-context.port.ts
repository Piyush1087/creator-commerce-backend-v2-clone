import type { AuthUser } from "../auth/types/auth-user";

export const CAMPAIGN_CONTINUATION_CONTEXT = Symbol(
  "CAMPAIGN_CONTINUATION_CONTEXT",
);
export interface CampaignContinuationContextPort {
  bind(user: AuthUser, opaqueToken: string, now: Date): Promise<string>;
}

export type CampaignContinuationSeed = {
  schemaVersion: 1;
  entrySurface:
    | "DIRECT_CAMPAIGN_LINK"
    | "TRACKED_CAMPAIGN_SHARE"
    | "BRAND_INVITATION"
    | "CREATOR_OPPORTUNITIES";
  entryAuthority:
    | { kind: "DIRECT" }
    | { kind: "SHARE"; campaignShareId: string }
    | { kind: "INVITATION"; campaignInvitationId: string };
  firstQualifiedTouchId?: string;
};

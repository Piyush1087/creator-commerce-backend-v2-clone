export const CREATOR_PAYOUT_METHOD_SUMMARY_PORT = Symbol(
  "CREATOR_PAYOUT_METHOD_SUMMARY_PORT",
);

export type CreatorPayoutMethodSummary = {
  readonly status:
    | "NONE"
    | "CURRENT"
    | "STALE"
    | "ATTENTION"
    | "DISABLED"
    | "AMBIGUOUS"
    | "UNSUPPORTED";
  readonly destination_id: string | null;
  readonly destination_version: number | null;
  readonly masked_display: string | null;
  readonly destination_type: string | null;
  readonly country_code: string | null;
  readonly currency_code: string | null;
  readonly is_primary: boolean | null;
  readonly destination_state: string | null;
  readonly safe_reason_code: string | null;
  readonly updated_at: string | null;
  readonly c06_rail_support: "SUPPORTED" | "UNSUPPORTED" | "UNAVAILABLE";
  readonly manage_settings_href: string | null;
};

export interface CreatorPayoutMethodSummaryPort {
  read(
    creatorProfileId: string,
    manageAuthorized: boolean,
  ): Promise<CreatorPayoutMethodSummary>;
}

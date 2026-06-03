export type BridgeSuccessResponse = {
  success: true;
  bridge_tracking_id: string;
  message: string;
  campaign_id?: string;
};

export type BridgeFailureResponse = {
  success: false;
  bridge_tracking_id: string | null;
  error_type: "BRIDGE_VALIDATION_FAILURE" | "BRIDGE_BUSINESS_LOCK";
  diagnostic_details: unknown;
  error_code?: string;
  http_status?: number;
  target_lock_count?: number;
  fallback_ui_action?: string;
};


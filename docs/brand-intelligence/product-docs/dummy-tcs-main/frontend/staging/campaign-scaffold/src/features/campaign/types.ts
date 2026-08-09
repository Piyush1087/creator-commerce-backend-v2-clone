export type SurfaceState = "READY" | "EMPTY" | "UNAVAILABLE" | "ERROR";
export type CapabilityPresentation = "ENABLED" | "DISABLED" | "HIDDEN";
export type ShareChannel = "INSTAGRAM" | "COPY_LINK" | "WHATSAPP" | "NATIVE_SHARE";

export interface Capability {
  available: boolean;
  presentation: CapabilityPresentation;
  reasonCategory?: string;
  requiresConfirmation?: boolean;
}

export interface CampaignPageView {
  campaign: {
    id: string;
    name: string;
    lifecycleStatus: "DRAFT" | "PUBLISHED" | "LIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
    creationSource: "MANUAL" | "AI_RECOMMENDED";
    productCount: number;
    briefCount: number;
    capabilities: Record<string, Capability>;
  };
  hydration: {
    outcome: string;
    executionReady: boolean;
    primaryFocus: string;
    postLiveReadinessBlocked: boolean;
  };
  productsBriefsSummary: ProductsBriefsSummary;
  copilotSummary: CopilotSummary;
  performanceSummary: PerformanceSummaryView;
  workspaces: WorkspaceSummary[];
  share: { capability: Capability; supportedChannels: ShareChannel[] };
}

export interface ProductsBriefsSummary extends SurfaceSummary { products: Array<{ campaignAssetId: string; name: string; briefs: Array<{ briefId: string; name: string }> }>; }
export interface CopilotSummary extends SurfaceSummary { summary?: string; actions: Array<{ id: string; label: string; context?: string; action: string }> }
export interface PerformanceSummaryView extends SurfaceSummary { metrics: Array<{ metricId: string; label: string; value: string; tone: "neutral" | "success" | "attention" }> }
export interface CreatorCardView { campaignCreatorId: string; name: string; category: string; followers: string; engagement: string; avatarInitials: string; contextLabel?: string; }

export interface SurfaceSummary {
  state: SurfaceState;
  label?: string;
  capability?: Capability;
}

export interface WorkspaceSummary extends SurfaceSummary {
  workspace: "DISCOVERY" | "APPLICANTS" | "COLLABORATIONS";
  instantiated: boolean;
  visible: boolean;
  count?: number;
  expand: Capability;
}

export interface CampaignDetailsView { campaignId: string; state: SurfaceState; }
export interface ProductDetailsView { campaignAssetId: string; state: SurfaceState; }
export interface BriefDetailsView { briefId: string; state: SurfaceState; }
export interface DiscoveryWorkspaceView { state: SurfaceState; creators: CreatorCardView[]; nextCursor?: string; }
export interface CreatorProfileView { campaignCreatorId: string; state: SurfaceState; }
export interface OutreachComposerView { campaignCreatorId: string; state: SurfaceState; capability: Capability; }
export interface ApplicantsWorkspaceView { state: SurfaceState; applicants: Array<CreatorCardView & { applicationId: string; applicationStatus?: "PENDING" | "APPROVED" | "REJECTED"; intelligenceStatus: "PROCESSING" | "READY" | "UNAVAILABLE"; intelligenceLabel?: string }>; nextCursor?: string; }
export interface ReportingDetailView { campaignId: string; state: SurfaceState; }
export interface CollaborationReferenceView { collaborationId: string; label: string; state: SurfaceState; open: Capability; }

import type { ChatCapabilitySnapshot } from "../capabilities/chat-capability.contract";
import type { ChatEntityRef } from "../response/chat-response.contract";

export type ChatSurfaceKind = "HOME" | "WORKSPACE" | "MODULE";

export type ChatContext = {
  actor: { userId: string; role: string };
  workspace: { brandProfileId: string; membershipRole: string };
  conversation: { id: string | null };
  surface: { kind: ChatSurfaceKind };
  requestHints: {
    routePath?: string;
    selectedEntity?: { type: string; id: string };
  };
  capabilities: readonly ChatCapabilitySnapshot[];
  canonicalRefs: readonly ChatEntityRef[];
  intelligenceRefs: readonly ChatEntityRef[];
  providerReadiness: readonly [];
  turnStartedAt: string;
};

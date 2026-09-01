import type { AuthUser } from "../../auth/types/auth-user";
import type { ChatContext } from "../context/chat-context.contract";
import type {
  ChatEntityRef,
  ChatGroundingRef,
} from "../response/chat-response.contract";
import type { ChatCapabilityAvailabilityStatus } from "./chat-capability.contract";

export type ChatCapabilityExecutionContext = Readonly<{
  actor: AuthUser;
  chatContext: ChatContext;
  authorizedEntityRefs: readonly ChatEntityRef[];
}>;

export type ChatCapabilityExecutionResult = Readonly<{
  capabilityId: string;
  availability: ChatCapabilityAvailabilityStatus;
  data?: unknown;
  grounding: readonly ChatGroundingRef[];
  authorizedEntityRefs: readonly ChatEntityRef[];
  freshnessNotes?: readonly string[];
  limitations?: readonly string[];
  navigation?: Readonly<{
    destinationId: string;
    entityRef?: ChatEntityRef;
  }>;
}>;

export interface ChatCapabilityHandler {
  readonly capabilityId: string;
  execute(
    context: ChatCapabilityExecutionContext,
    input: Readonly<Record<string, unknown>>,
  ): Promise<ChatCapabilityExecutionResult>;
}

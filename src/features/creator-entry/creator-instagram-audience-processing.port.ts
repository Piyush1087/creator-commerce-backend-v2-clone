export const CREATOR_INSTAGRAM_AUDIENCE_PROCESSING_PORT = Symbol(
  "CREATOR_INSTAGRAM_AUDIENCE_PROCESSING_PORT",
);

export interface CreatorInstagramAudienceProcessingPort {
  scheduleCreatorAudience(input: {
    creatorProfileId: string;
    creatorWorkspaceId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    trigger: "INITIAL_CONNECT" | "RECONNECT";
  }): Promise<void>;
  scheduleCreatorContent(input: {
    creatorProfileId: string;
    creatorWorkspaceId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    trigger: "INITIAL_CONNECT" | "RECONNECT";
  }): Promise<void>;
}

import { Injectable } from "@nestjs/common";
import type { InstagramMediaTruth } from "../instagram/instagram-intelligence-provider.types";
import type { CreatorContentSemanticObservation } from "./creator-content-calculator";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { CreatorContentPersistenceIdentity } from "./creator-content.repository";

export type CreatorContentSemanticInput = Readonly<{
  media: InstagramMediaTruth;
  profileVersion: "creator-content-semantic-v0.1";
  actor: CreatorWorkspaceActorContext;
  identity: CreatorContentPersistenceIdentity;
  windowEnd: Date;
  sourceCaptureRef: string;
  sourceEvidenceRef: string;
}>;

export const CREATOR_CONTENT_SEMANTIC_ANALYZER = Symbol(
  "CREATOR_CONTENT_SEMANTIC_ANALYZER",
);
export interface CreatorContentSemanticAnalyzer {
  replayProfileIdentity?(): string;
  analyze(
    input: CreatorContentSemanticInput,
  ): Promise<CreatorContentSemanticObservation>;
}

/** Production-safe fail-closed adapter until a configured bounded model adapter is supplied. */
@Injectable()
export class MissingCreatorContentSemanticAnalyzer implements CreatorContentSemanticAnalyzer {
  async analyze(
    input: Readonly<{ media: InstagramMediaTruth }>,
  ): Promise<CreatorContentSemanticObservation> {
    return {
      providerMediaId: input.media.providerMediaId,
      state: "UNKNOWN",
      themes: [],
      captionPatterns: [],
      creativeStructures: [],
      visualExecution: [],
    };
  }
}

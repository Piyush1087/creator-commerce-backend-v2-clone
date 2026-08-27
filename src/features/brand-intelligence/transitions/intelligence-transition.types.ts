import {
  IntelligenceActionActorType,
  IntelligenceComponentTransitionOutcome,
  IntelligenceFreshness,
  type IntelligenceComponentTransition,
} from "@prisma/client";

import type { ComponentSemanticAddress } from "../semantic-path/component-path.types";

export type ExpectedCurrent =
  | Readonly<{ state: "ABSENT" }>
  | Readonly<{
      state: "PRESENT";
      generationId: string;
      revision: bigint;
    }>;

export interface TransitionActionContext {
  readonly id: string;
  readonly brandId: string;
  /** Optional only for legacy Brand actions; persisted actions always resolve it. */
  readonly subjectId?: string;
  readonly actionType: string;
  readonly actorType: IntelligenceActionActorType;
  readonly actorRef: string;
  readonly authorizationDecisionRef?: string;
  readonly requestIdempotencyKey: string;
  readonly correlationRef: string;
  readonly reasonCode: string;
  readonly processorExecutionId?: string;
}

interface DecisionBase extends ComponentSemanticAddress {
  readonly expectedCurrent: ExpectedCurrent;
  readonly reasonCode?: string;
}

export interface ApplyGenerationDecision extends DecisionBase {
  readonly kind: "APPLY_GENERATION";
  readonly generationId: string;
  readonly discrepancyCode?: string;
}

export interface AcceptCandidateDecision extends DecisionBase {
  readonly kind: "ACCEPT_CANDIDATE";
  readonly candidateId: string;
  /** New authorized immutable generation derived from the candidate lineage. */
  readonly acceptedGenerationId: string;
}

export interface RejectCandidateDecision extends DecisionBase {
  readonly kind: "REJECT_CANDIDATE";
  readonly candidateId: string;
}

export interface ObsoleteCandidateDecision extends DecisionBase {
  readonly kind: "OBSOLETE_CANDIDATE";
  readonly candidateId: string;
}

export interface SetFreshnessDecision extends DecisionBase {
  readonly kind: "SET_FRESHNESS";
  readonly freshness: IntelligenceFreshness;
  readonly evaluatedAt: Date;
  readonly staleSince?: Date;
  readonly staleReasonCode?: string;
  readonly invalidatingRef?: string;
}

export interface RetireDecision extends DecisionBase {
  readonly kind: "RETIRE";
}

export type IntelligenceTransitionDecision =
  | ApplyGenerationDecision
  | AcceptCandidateDecision
  | RejectCandidateDecision
  | ObsoleteCandidateDecision
  | SetFreshnessDecision
  | RetireDecision;

export interface IntelligenceTransitionCommand {
  readonly action: TransitionActionContext;
  readonly decisions: readonly IntelligenceTransitionDecision[];
}

export interface IntelligenceTransitionResult {
  readonly actionId: string;
  readonly replayed: boolean;
  readonly outcomes: readonly IntelligenceComponentTransition[];
}

export const RECORDED_TRANSITION_OUTCOMES =
  IntelligenceComponentTransitionOutcome;

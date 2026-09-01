import { Injectable } from "@nestjs/common";
import {
  IntelligenceActionActorType,
  IntelligenceAuthority,
  IntelligenceComponentCandidateStatus,
  IntelligenceComponentTransitionOutcome,
  IntelligenceFreshness,
  IntelligenceProtectionState,
  Prisma,
  type IntelligenceComponentGeneration,
  type IntelligenceComponentTransition,
  type IntelligenceCurrentComponent,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";
import { IntelligenceActionRepository } from "../persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../persistence/intelligence-candidate.repository";
import {
  compareSemanticAddresses,
  IntelligenceCurrentStateRepository,
} from "../persistence/intelligence-current-state.repository";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../semantic-path/component-path.types";
import type {
  IntelligenceTransitionCommand,
  IntelligenceTransitionDecision,
  IntelligenceTransitionResult,
  TransitionActionContext,
} from "./intelligence-transition.types";

const PROCESSOR_AUTHORITIES = new Set<IntelligenceAuthority>([
  IntelligenceAuthority.OBSERVED,
  IntelligenceAuthority.CREATOR_SHOP_DERIVED,
  IntelligenceAuthority.SYSTEM_DERIVED,
]);

function isProtected(current: IntelligenceCurrentComponent): boolean {
  return current.protectionState !== IntelligenceProtectionState.UNPROTECTED;
}

function isProcessor(action: TransitionActionContext): boolean {
  return action.actorType === IntelligenceActionActorType.PROCESSOR;
}

@Injectable()
export class IntelligenceTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentRepository: IntelligenceCurrentStateRepository,
    private readonly candidateRepository: IntelligenceCandidateRepository,
    private readonly actionRepository: IntelligenceActionRepository,
    private readonly pathCodec: ComponentPathCodec,
  ) {}

  async transition(
    command: IntelligenceTransitionCommand,
  ): Promise<IntelligenceTransitionResult> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.transitionInTransaction(tx, command),
      );
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /** Shares the caller's transaction when generation/reference persistence and CAS must commit atomically. */
  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    command: IntelligenceTransitionCommand,
  ): Promise<IntelligenceTransitionResult> {
    this.assertCommand(command);
    const actionLookup = await this.actionRepository.createOrReplay(tx, {
      id: command.action.id,
      brandId: command.action.brandId,
      subjectId: command.action.subjectId,
      actionType: command.action.actionType,
      actorType: command.action.actorType,
      actorRef: command.action.actorRef,
      authorizationDecisionRef: command.action.authorizationDecisionRef ?? null,
      requestIdempotencyKey: command.action.requestIdempotencyKey,
      correlationRef: command.action.correlationRef,
      reasonCode: command.action.reasonCode,
      requestedAtomicity: "PER_PATH_RECORDED",
      outcome: "RECORDED",
      processorExecutionId: command.action.processorExecutionId ?? null,
    });
    const scopedAction = {
      ...command.action,
      subjectId: actionLookup.action.subjectId,
    };
    const decisions = command.decisions
      .map((decision) => {
        if (
          decision.subjectId &&
          decision.subjectId !== actionLookup.action.subjectId
        ) {
          throw new IntelligencePersistenceError(
            "TENANCY_VIOLATION",
            "Transition decision belongs to another Intelligence subject",
          );
        }
        return { ...decision, subjectId: actionLookup.action.subjectId };
      })
      .sort(compareSemanticAddresses);
    const currents = await this.currentRepository.lockInCanonicalOrder(
      tx,
      decisions,
    );

    if (actionLookup.replayed) {
      const recorded = await this.actionRepository.getTransitions(
        tx,
        actionLookup.action.id,
      );
      this.assertReplay(decisions, recorded);
      return {
        actionId: actionLookup.action.id,
        replayed: true,
        outcomes: recorded,
      };
    }

    const outcomes: IntelligenceComponentTransition[] = [];
    for (const decision of decisions) {
      const current =
        currents.get(this.currentRepository.key(decision)) ?? null;
      outcomes.push(
        await this.applyDecision(tx, scopedAction, decision, current),
      );
    }
    return {
      actionId: actionLookup.action.id,
      replayed: false,
      outcomes,
    };
  }

  private async applyDecision(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: IntelligenceTransitionDecision,
    current: IntelligenceCurrentComponent | null,
  ): Promise<IntelligenceComponentTransition> {
    if (!this.expectedMatches(decision, current)) {
      const obsoleteProtectedProcessor =
        decision.kind === "APPLY_GENERATION" &&
        current !== null &&
        isProtected(current) &&
        isProcessor(action);
      return this.audit(
        tx,
        action,
        decision,
        current,
        obsoleteProtectedProcessor
          ? IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE
          : IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        obsoleteProtectedProcessor ? "STALE_PROTECTED_BASIS" : "CAS_CONFLICT",
      );
    }

    switch (decision.kind) {
      case "APPLY_GENERATION":
        return this.applyGeneration(tx, action, decision, current);
      case "ACCEPT_CANDIDATE":
        return this.acceptCandidate(tx, action, decision, current);
      case "REJECT_CANDIDATE":
        return this.resolveCandidate(tx, action, decision, current, "REJECTED");
      case "OBSOLETE_CANDIDATE":
        return this.resolveCandidate(tx, action, decision, current, "OBSOLETE");
      case "SET_FRESHNESS":
        return this.setFreshness(tx, action, decision, current);
      case "RETIRE":
        return this.retire(tx, action, decision, current);
    }
  }

  private async applyGeneration(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: Extract<
      IntelligenceTransitionDecision,
      { kind: "APPLY_GENERATION" }
    >,
    current: IntelligenceCurrentComponent | null,
  ): Promise<IntelligenceComponentTransition> {
    const generation = await tx.intelligenceComponentGeneration.findUnique({
      where: { id: decision.generationId },
    });
    if (!generation || !this.sameAddress(decision, generation)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
        generation ? "TENANCY_OR_ADDRESS_MISMATCH" : "GENERATION_NOT_FOUND",
        generation ?? undefined,
      );
    }
    if (!this.authorityAllowed(action, generation.authority)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
        "AUTHORITY_NOT_ALLOWED",
        generation,
      );
    }

    if (current && isProtected(current) && isProcessor(action)) {
      if (generation.supersedesComponentGenerationId !== null) {
        return this.audit(
          tx,
          action,
          decision,
          current,
          IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
          "CANDIDATE_MUST_NOT_SUPERSEDE_PROTECTED_CURRENT",
          generation,
        );
      }
      const basis = decision.expectedCurrent;
      if (basis.state !== "PRESENT") {
        return this.audit(
          tx,
          action,
          decision,
          current,
          IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
          "MISSING_PROTECTED_BASIS",
          generation,
        );
      }
      if (generation.valueHash === (await currentValueHash(current, tx))) {
        return this.audit(
          tx,
          action,
          decision,
          current,
          IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT,
          "EQUIVALENT_PROTECTED_VALUE",
          generation,
        );
      }
      const candidate = await this.candidateRepository.createOrGetPending(tx, {
        brandId: decision.brandId,
        subjectId: decision.subjectId ?? action.subjectId!,
        currentComponentId: current.id,
        objectSemanticId: decision.objectSemanticId,
        pathSchemeVersion: decision.pathSchemeVersion,
        componentSemanticPath: decision.componentSemanticPath,
        candidateComponentGenerationId: generation.id,
        basisCurrentComponentGenerationId: current.currentComponentGenerationId,
        basisCurrentRevision: current.revision,
        candidateValueHash: generation.valueHash,
        discrepancyCode: decision.discrepancyCode ?? "PROTECTED_VALUE_CONFLICT",
        producerExecutionId: action.processorExecutionId ?? null,
        producerActionId: action.processorExecutionId ? null : action.id,
      });
      if (candidate.status !== IntelligenceComponentCandidateStatus.PENDING) {
        return this.audit(
          tx,
          action,
          decision,
          current,
          IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
          "CANDIDATE_GENERATION_ALREADY_RESOLVED",
          generation,
          candidate.id,
        );
      }
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
        "PROTECTED_VALUE_CONFLICT",
        generation,
        candidate.id,
      );
    }

    if (
      current &&
      generation.supersedesComponentGenerationId !== null &&
      generation.supersedesComponentGenerationId !==
        current.currentComponentGenerationId
    ) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
        "INVALID_SUPERSESSION_EDGE",
        generation,
      );
    }
    if (!current && generation.supersedesComponentGenerationId !== null) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
        "UNEXPECTED_SUPERSESSION_EDGE",
        generation,
      );
    }

    const advanced = current
      ? await this.currentRepository.advanceExpectedRevision(
          tx,
          current,
          current.revision,
          current.currentComponentGenerationId,
          generation,
        )
      : await this.currentRepository.createExpectedAbsent(
          tx,
          decision,
          generation,
        );
    if (!advanced) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        "CAS_CONFLICT",
        generation,
      );
    }
    if (current && isProtected(current)) {
      await this.candidateRepository.obsoletePendingBasis(
        tx,
        current.id,
        current.currentComponentGenerationId,
        action.id,
      );
    }
    return this.audit(
      tx,
      action,
      decision,
      current,
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      decision.reasonCode ?? action.reasonCode,
      generation,
      undefined,
      advanced,
    );
  }

  private async acceptCandidate(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: Extract<
      IntelligenceTransitionDecision,
      { kind: "ACCEPT_CANDIDATE" }
    >,
    current: IntelligenceCurrentComponent | null,
  ): Promise<IntelligenceComponentTransition> {
    if (!current || !this.authorized(action)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_PROTECTED,
        "AUTHORIZED_CANDIDATE_ACCEPTANCE_REQUIRED",
      );
    }
    const candidate = await this.candidateRepository.lockById(
      tx,
      decision.candidateId,
    );
    const generation = await tx.intelligenceComponentGeneration.findUnique({
      where: { id: decision.acceptedGenerationId },
    });
    if (
      !candidate ||
      candidate.status !== IntelligenceComponentCandidateStatus.PENDING ||
      candidate.brandId !== decision.brandId ||
      candidate.currentComponentId !== current.id ||
      candidate.basisCurrentComponentGenerationId !==
        current.currentComponentGenerationId ||
      candidate.basisCurrentRevision !== current.revision ||
      !generation ||
      !this.sameAddress(decision, generation) ||
      generation.valueHash !== candidate.candidateValueHash ||
      generation.supersedesComponentGenerationId !==
        current.currentComponentGenerationId ||
      (generation.authority !== IntelligenceAuthority.BRAND_CONFIRMED &&
        generation.authority !== IntelligenceAuthority.SUPPORT_CONTROLLED)
    ) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
        "CANDIDATE_NOT_CURRENT",
        generation ?? undefined,
        candidate?.id,
      );
    }
    const advanced = await this.currentRepository.advanceExpectedRevision(
      tx,
      current,
      current.revision,
      current.currentComponentGenerationId,
      generation,
    );
    if (!advanced) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        "CAS_CONFLICT",
        generation,
        candidate.id,
      );
    }
    await this.candidateRepository.resolvePending(
      tx,
      candidate.id,
      IntelligenceComponentCandidateStatus.ACCEPTED,
      action.id,
    );
    await this.candidateRepository.obsoletePendingBasis(
      tx,
      current.id,
      current.currentComponentGenerationId,
      action.id,
      candidate.id,
    );
    return this.audit(
      tx,
      action,
      decision,
      current,
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      "CANDIDATE_ACCEPTED",
      generation,
      candidate.id,
      advanced,
    );
  }

  private async resolveCandidate(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: Extract<
      IntelligenceTransitionDecision,
      { kind: "REJECT_CANDIDATE" | "OBSOLETE_CANDIDATE" }
    >,
    current: IntelligenceCurrentComponent | null,
    status: "REJECTED" | "OBSOLETE",
  ): Promise<IntelligenceComponentTransition> {
    if (!current || !this.authorized(action)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_PROTECTED,
        "AUTHORIZED_CANDIDATE_RESOLUTION_REQUIRED",
      );
    }
    const candidate = await this.candidateRepository.lockById(
      tx,
      decision.candidateId,
    );
    if (
      !candidate ||
      candidate.status !== IntelligenceComponentCandidateStatus.PENDING ||
      candidate.brandId !== decision.brandId ||
      candidate.currentComponentId !== current.id ||
      candidate.basisCurrentComponentGenerationId !==
        current.currentComponentGenerationId ||
      candidate.basisCurrentRevision !== current.revision
    ) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
        "CANDIDATE_NOT_CURRENT",
        undefined,
        candidate?.id,
      );
    }
    const result = await this.candidateRepository.resolvePending(
      tx,
      candidate.id,
      status === "REJECTED"
        ? IntelligenceComponentCandidateStatus.REJECTED
        : IntelligenceComponentCandidateStatus.OBSOLETE,
      action.id,
    );
    if (result.count !== 1) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
        "CANDIDATE_NOT_CURRENT",
        undefined,
        candidate.id,
      );
    }
    return this.audit(
      tx,
      action,
      decision,
      current,
      status === "REJECTED"
        ? IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT
        : IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
      status === "REJECTED" ? "CANDIDATE_REJECTED" : "CANDIDATE_OBSOLETED",
      undefined,
      candidate.id,
    );
  }

  private async setFreshness(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: Extract<
      IntelligenceTransitionDecision,
      { kind: "SET_FRESHNESS" }
    >,
    current: IntelligenceCurrentComponent | null,
  ): Promise<IntelligenceComponentTransition> {
    if (!current) {
      return this.audit(
        tx,
        action,
        decision,
        null,
        IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        "CAS_CONFLICT",
      );
    }
    if (isProtected(current) && !this.authorized(action)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_PROTECTED,
        "AUTHORIZED_PROTECTED_FRESHNESS_REQUIRED",
      );
    }
    const allowed =
      (current.currentFreshness === IntelligenceFreshness.CURRENT &&
        (decision.freshness === IntelligenceFreshness.CURRENT ||
          decision.freshness === IntelligenceFreshness.STALE)) ||
      (current.currentFreshness === IntelligenceFreshness.STALE &&
        (decision.freshness === IntelligenceFreshness.STALE ||
          decision.freshness === IntelligenceFreshness.CURRENT)) ||
      (current.currentFreshness === IntelligenceFreshness.UNKNOWN &&
        decision.freshness === IntelligenceFreshness.CURRENT);
    if (!allowed) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
        "INVALID_FRESHNESS_TRANSITION",
      );
    }
    const updated = await this.currentRepository.setFreshnessExpectedRevision(
      tx,
      current,
      current.revision,
      decision,
    );
    return this.audit(
      tx,
      action,
      decision,
      current,
      updated
        ? IntelligenceComponentTransitionOutcome.APPLIED_CURRENT
        : IntelligenceComponentTransitionOutcome.REJECTED_CAS,
      updated ? "FRESHNESS_TRANSITION" : "CAS_CONFLICT",
      undefined,
      undefined,
      updated ?? undefined,
    );
  }

  private async retire(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: Extract<IntelligenceTransitionDecision, { kind: "RETIRE" }>,
    current: IntelligenceCurrentComponent | null,
  ): Promise<IntelligenceComponentTransition> {
    if (!current) {
      return this.audit(
        tx,
        action,
        decision,
        null,
        IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        "CAS_CONFLICT",
      );
    }
    if (!this.authorized(action)) {
      return this.audit(
        tx,
        action,
        decision,
        current,
        IntelligenceComponentTransitionOutcome.REJECTED_PROTECTED,
        "AUTHORIZED_RETIREMENT_REQUIRED",
      );
    }
    const updated = await this.currentRepository.retireExpectedRevision(
      tx,
      current,
      current.revision,
    );
    return this.audit(
      tx,
      action,
      decision,
      current,
      updated
        ? IntelligenceComponentTransitionOutcome.APPLIED_CURRENT
        : IntelligenceComponentTransitionOutcome.REJECTED_CAS,
      updated ? "CURRENT_RETIRED" : "CAS_CONFLICT",
      undefined,
      undefined,
      updated ?? undefined,
    );
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: TransitionActionContext,
    decision: IntelligenceTransitionDecision,
    current: IntelligenceCurrentComponent | null,
    outcome: IntelligenceComponentTransitionOutcome,
    reasonCode: string,
    proposed?: IntelligenceComponentGeneration,
    candidateId?: string,
    resulting?: IntelligenceCurrentComponent,
  ): Promise<IntelligenceComponentTransition> {
    const expected = decision.expectedCurrent;
    return this.actionRepository.createTransition(tx, {
      brandId: decision.brandId,
      subjectId: decision.subjectId ?? action.subjectId!,
      actionId: action.id,
      currentComponentId: current?.id ?? null,
      objectSemanticId: decision.objectSemanticId,
      pathSchemeVersion: decision.pathSchemeVersion,
      componentSemanticPath: decision.componentSemanticPath,
      fromGenerationId: current?.currentComponentGenerationId ?? null,
      expectedExists: expected.state === "PRESENT",
      expectedRevision: expected.state === "PRESENT" ? expected.revision : null,
      expectedGenerationId:
        expected.state === "PRESENT" ? expected.generationId : null,
      observedRevision: current?.revision ?? null,
      observedGenerationId: current?.currentComponentGenerationId ?? null,
      proposedGenerationId: proposed?.id ?? null,
      toGenerationId:
        outcome === IntelligenceComponentTransitionOutcome.APPLIED_CURRENT
          ? (resulting?.currentComponentGenerationId ?? proposed?.id ?? null)
          : null,
      candidateId: candidateId ?? null,
      transitionType: decision.kind,
      outcome,
      reasonCode,
      resultingRevision:
        outcome === IntelligenceComponentTransitionOutcome.APPLIED_CURRENT
          ? (resulting?.revision ?? null)
          : null,
    });
  }

  private expectedMatches(
    decision: IntelligenceTransitionDecision,
    current: IntelligenceCurrentComponent | null,
  ): boolean {
    const expected = decision.expectedCurrent;
    if (expected.state === "ABSENT") return current === null;
    return (
      current !== null &&
      current.currentComponentGenerationId === expected.generationId &&
      current.revision === expected.revision
    );
  }

  private authorityAllowed(
    action: TransitionActionContext,
    authority: IntelligenceAuthority,
  ): boolean {
    if (isProcessor(action)) return PROCESSOR_AUTHORITIES.has(authority);
    if (
      authority === IntelligenceAuthority.BRAND_CONFIRMED ||
      authority === IntelligenceAuthority.SUPPORT_CONTROLLED
    ) {
      return this.authorized(action);
    }
    return true;
  }

  private authorized(action: TransitionActionContext): boolean {
    return !isProcessor(action) && Boolean(action.authorizationDecisionRef);
  }

  private sameAddress(
    address: ComponentSemanticAddress,
    generation: IntelligenceComponentGeneration,
  ): boolean {
    return (
      generation.brandId === address.brandId &&
      generation.subjectId === address.subjectId &&
      generation.objectSemanticId === address.objectSemanticId &&
      generation.pathSchemeVersion === address.pathSchemeVersion &&
      generation.componentSemanticPath === address.componentSemanticPath
    );
  }

  private assertCommand(command: IntelligenceTransitionCommand): void {
    if (command.decisions.length === 0) {
      throw new IntelligencePersistenceError(
        "INVALID_TRANSITION",
        "A transition action must contain at least one component decision",
      );
    }
    const paths = new Set<string>();
    for (const decision of command.decisions) {
      this.pathCodec.assertCanonical(
        decision.componentSemanticPath,
        decision.pathSchemeVersion,
      );
      if (decision.brandId !== command.action.brandId) {
        throw new IntelligencePersistenceError(
          "TENANCY_VIOLATION",
          "Every transition decision must belong to the action Brand",
        );
      }
      const key = this.currentRepository.key(decision);
      if (paths.has(key)) {
        throw new IntelligencePersistenceError(
          "INVALID_TRANSITION",
          "An action cannot contain two decisions for the same semantic address",
        );
      }
      paths.add(key);
    }
    if (isProcessor(command.action) && !command.action.processorExecutionId) {
      throw new IntelligencePersistenceError(
        "INVALID_TRANSITION",
        "Processor actions require a processor execution identity",
      );
    }
  }

  private assertReplay(
    decisions: readonly IntelligenceTransitionDecision[],
    transitions: readonly IntelligenceComponentTransition[],
  ): void {
    if (decisions.length !== transitions.length) {
      throw new IntelligencePersistenceError(
        "IDEMPOTENCY_CONFLICT",
        "Action replay contains a different set of component decisions",
      );
    }
    const sortedDecisions = [...decisions].sort(compareSemanticAddresses);
    for (let index = 0; index < sortedDecisions.length; index += 1) {
      const decision = sortedDecisions[index];
      const transition = transitions[index];
      const expected = decision.expectedCurrent;
      const proposedId =
        decision.kind === "APPLY_GENERATION"
          ? decision.generationId
          : decision.kind === "ACCEPT_CANDIDATE"
            ? decision.acceptedGenerationId
            : null;
      const candidateId =
        "candidateId" in decision ? decision.candidateId : null;
      if (
        transition.brandId !== decision.brandId ||
        transition.subjectId !== decision.subjectId ||
        transition.objectSemanticId !== decision.objectSemanticId ||
        transition.pathSchemeVersion !== decision.pathSchemeVersion ||
        transition.componentSemanticPath !== decision.componentSemanticPath ||
        transition.transitionType !== decision.kind ||
        transition.expectedExists !== (expected.state === "PRESENT") ||
        transition.expectedRevision !==
          (expected.state === "PRESENT" ? expected.revision : null) ||
        transition.expectedGenerationId !==
          (expected.state === "PRESENT" ? expected.generationId : null) ||
        transition.proposedGenerationId !== proposedId ||
        (candidateId !== null && transition.candidateId !== candidateId)
      ) {
        throw new IntelligencePersistenceError(
          "IDEMPOTENCY_CONFLICT",
          "Action idempotency identity was replayed with different transition content",
        );
      }
    }
  }

  private mapError(error: unknown): IntelligencePersistenceError {
    if (error instanceof IntelligencePersistenceError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return new IntelligencePersistenceError(
          "TENANCY_VIOLATION",
          "A transition relation crossed a Brand or semantic address boundary",
        );
      }
      if (error.code === "P2002") {
        return new IntelligencePersistenceError(
          "IDEMPOTENCY_CONFLICT",
          "A transition persistence identity already has different content",
        );
      }
      return new IntelligencePersistenceError(
        "PERSISTENCE_INVARIANT",
        "Transition persistence violated a database invariant",
      );
    }
    return new IntelligencePersistenceError(
      "PERSISTENCE_INVARIANT",
      "Transition persistence failed",
    );
  }
}

async function currentValueHash(
  current: IntelligenceCurrentComponent,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const generation = await tx.intelligenceComponentGeneration.findUniqueOrThrow(
    {
      where: { id: current.currentComponentGenerationId },
      select: { valueHash: true },
    },
  );
  return generation.valueHash;
}

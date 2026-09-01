import { Injectable } from "@nestjs/common";
import {
  IntelligenceProcessorExecutionStatus,
  Prisma,
  type IntelligenceSubject,
  type IntelligenceProcessorExecution,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { canonicalJson } from "../contracts/bundle/canonical-json";
import { BundlePathOwnershipRegistry } from "../contracts/registry/bundle-path-ownership.registry";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import { IntelligenceExecutionError } from "./domain/intelligence-execution.error";
import type {
  CreateIntelligenceExecutionCommand,
  CreatedIntelligenceExecution,
  ProcessorExecutionRequest,
} from "./domain/intelligence-execution.types";
import {
  canonicalActiveScope,
  processorLogicalKeyV2,
  sha256CanonicalExecution,
} from "./domain/execution-hash";
import { ExecutionContractGate } from "./registry/execution-contract.gate";
import { resolveIntelligenceSubject } from "../subject/intelligence-subject.resolver";

interface PreparedProcessor {
  readonly request: ProcessorExecutionRequest;
  readonly processorId: string;
  readonly processorVersion: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly bundleHash: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
  readonly activeScope: Prisma.InputJsonValue;
  readonly activeScopeHash: string;
  readonly dependencyManifestHash: string;
  readonly evidenceManifestHash: string;
  readonly triggerIntentKey: string;
  readonly processorExecutionKey: string;
}

const executionInclude =
  Prisma.validator<Prisma.IntelligenceExecutionInclude>()({
    processorExecutions: true,
  });

type ExecutionWithProcessors = Prisma.IntelligenceExecutionGetPayload<{
  include: typeof executionInclude;
}>;

@Injectable()
export class IntelligenceExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractGate: ExecutionContractGate,
    private readonly ownership: BundlePathOwnershipRegistry,
    private readonly pathCodec: ComponentPathCodec,
  ) {}

  async createOrReturn(
    command: CreateIntelligenceExecutionCommand,
  ): Promise<CreatedIntelligenceExecution> {
    const subject = await resolveIntelligenceSubject(
      this.prisma,
      command.brandId,
      command.subject,
    );
    const prepared = this.prepare(command, subject);
    const existing = await this.findExisting(command, subject.id);
    if (existing) return this.assertReplay(existing, command, prepared);

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const raced = await tx.intelligenceExecution.findUnique({
            where: {
              brandId_subjectId_triggerIdempotencyKey: {
                brandId: command.brandId,
                subjectId: subject.id,
                triggerIdempotencyKey: command.triggerIdempotencyKey,
              },
            },
            include: executionInclude,
          });
          if (raced) return raced;
          return tx.intelligenceExecution.create({
            data: {
              brandId: command.brandId,
              subjectId: subject.id,
              triggerType: command.triggerType,
              triggerRef: command.triggerRef,
              triggerIdempotencyKey: command.triggerIdempotencyKey,
              correlationRef: command.correlationRef,
              requestedImpact: command.requestedImpact,
              processorExecutions: {
                create: prepared.map((item) => ({
                  brand: { connect: { id: command.brandId } },
                  subject: {
                    connect: {
                      id_brandId: {
                        id: subject.id,
                        brandId: command.brandId,
                      },
                    },
                  },
                  processorId: item.processorId,
                  processorVersion: item.processorVersion,
                  bundleId: item.bundleId,
                  bundleVersion: item.bundleVersion,
                  bundleHash: item.bundleHash,
                  outputContractId: item.outputContractId,
                  outputContractVersion: item.outputContractVersion,
                  activeScope: item.activeScope,
                  activeScopeHash: item.activeScopeHash,
                  dependencyManifest: item.request.dependencyManifest,
                  dependencyManifestHash: item.dependencyManifestHash,
                  evidenceManifest: item.request.evidenceManifest,
                  evidenceManifestHash: item.evidenceManifestHash,
                  triggerIntentKey: item.triggerIntentKey,
                  processorExecutionKey: item.processorExecutionKey,
                  processorKeyVersion: 2,
                  maxAttempts: item.request.maxAttempts,
                  status: item.request.dependencyEligible
                    ? IntelligenceProcessorExecutionStatus.QUEUED
                    : IntelligenceProcessorExecutionStatus.WAITING_FOR_DEPENDENCY,
                  eligibleAt: item.request.dependencyEligible
                    ? new Date()
                    : null,
                })),
              },
            },
            include: executionInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.assertReplay(created, command, prepared, false);
    } catch (error) {
      if (error instanceof IntelligenceExecutionError) throw error;
      // A concurrent creator may surface as a uniqueness or serialization
      // error depending on the Prisma/driver version. Re-read the durable
      // trigger identity before mapping any persistence error.
      const raced = await this.findExisting(command, subject.id);
      if (raced) return this.assertReplay(raced, command, prepared);
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "Execution creation failed a persistence invariant",
      );
    }
  }

  private prepare(
    command: CreateIntelligenceExecutionCommand,
    subject: IntelligenceSubject,
  ): readonly PreparedProcessor[] {
    if (command.processors.length === 0) {
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "An Intelligence execution requires at least one processor request",
      );
    }
    const prepared = command.processors.map((request) => {
      if (!Number.isInteger(request.maxAttempts) || request.maxAttempts <= 0) {
        throw new IntelligenceExecutionError(
          "INVALID_EXECUTION_STATE",
          "maxAttempts must be a positive integer",
        );
      }
      for (const address of request.activeScope) {
        if (address.brandId !== command.brandId) {
          throw new IntelligenceExecutionError(
            "INVALID_EXECUTION_STATE",
            "Active scope cannot cross Brand boundaries",
          );
        }
        if (address.subjectId && address.subjectId !== subject.id) {
          throw new IntelligenceExecutionError(
            "INVALID_EXECUTION_STATE",
            "Active scope cannot cross Intelligence subject boundaries",
          );
        }
        this.pathCodec.assertCanonical(
          address.componentSemanticPath,
          address.pathSchemeVersion,
        );
      }
      const manifest = this.contractGate.resolve(request);
      if (request.syntheticHarness?.explicit) {
        if (
          request.activeScope.length !== 1 ||
          request.activeScope[0].objectSemanticId !== "synthetic_test_object" ||
          request.activeScope[0].componentSemanticPath !== "$"
        ) {
          throw new IntelligenceExecutionError(
            "CONFIGURATION_DRIFT",
            "Synthetic harness owns only synthetic_test_object at the root path",
          );
        }
      } else {
        const scope = this.ownership.validateActiveScope(
          request.registryKey,
          request.activeScope,
        );
        if (!scope.valid) {
          throw new IntelligenceExecutionError(
            "CONFIGURATION_DRIFT",
            "Requested active scope is not owned by the verified processor contract",
          );
        }
      }
      const activeScope = canonicalActiveScope(request.activeScope);
      const activeScopeHash = sha256CanonicalExecution(activeScope);
      const dependencyManifestHash = sha256CanonicalExecution(
        request.dependencyManifest,
      );
      const evidenceManifestHash = sha256CanonicalExecution(
        request.evidenceManifest,
      );
      const triggerIntentKey = request.syntheticHarness?.explicit
        ? `synthetic:${request.syntheticHarness.scenario}:${request.executionIntentKey}`
        : request.executionIntentKey;
      return {
        request,
        processorId: manifest.processorId,
        processorVersion: manifest.processorVersion,
        bundleId: manifest.bundleId,
        bundleVersion: manifest.bundleVersion,
        bundleHash: manifest.bundleContentHash,
        outputContractId: manifest.outputContractId,
        outputContractVersion: manifest.outputContractVersion,
        activeScope: activeScope as Prisma.InputJsonValue,
        activeScopeHash,
        dependencyManifestHash,
        evidenceManifestHash,
        triggerIntentKey,
        processorExecutionKey: processorLogicalKeyV2({
          brandId: command.brandId,
          subject: {
            id: subject.id,
            type: subject.subjectType,
            ref: subject.subjectRef,
          },
          manifest,
          activeScope: request.activeScope,
          dependencyManifestHash,
          evidenceManifestHash,
          executionIntentKey: triggerIntentKey,
        }),
      };
    });
    const taskScopes = prepared.map(
      (item) => `${item.processorId}\u0000${item.activeScopeHash}`,
    );
    if (new Set(taskScopes).size !== taskScopes.length) {
      throw new IntelligenceExecutionError(
        "PROCESSOR_IDEMPOTENCY_CONFLICT",
        "One trigger cannot request duplicate processor/active-scope tasks",
      );
    }
    return prepared;
  }

  private findExisting(
    command: CreateIntelligenceExecutionCommand,
    subjectId: string,
  ): Promise<ExecutionWithProcessors | null> {
    return this.prisma.intelligenceExecution.findUnique({
      where: {
        brandId_subjectId_triggerIdempotencyKey: {
          brandId: command.brandId,
          subjectId,
          triggerIdempotencyKey: command.triggerIdempotencyKey,
        },
      },
      include: executionInclude,
    });
  }

  private assertReplay(
    existing: ExecutionWithProcessors,
    command: CreateIntelligenceExecutionCommand,
    prepared: readonly PreparedProcessor[],
    replayed = true,
  ): CreatedIntelligenceExecution {
    const expectedKeys = prepared
      .map((item) => item.processorExecutionKey)
      .sort();
    const existingKeys = existing.processorExecutions
      .map((item) => item.processorExecutionKey)
      .sort();
    if (
      existing.triggerType !== command.triggerType ||
      existing.triggerRef !== command.triggerRef ||
      canonicalJson(existing.requestedImpact) !==
        canonicalJson(command.requestedImpact) ||
      canonicalJson(existingKeys) !== canonicalJson(expectedKeys)
    ) {
      throw new IntelligenceExecutionError(
        "EXECUTION_IDEMPOTENCY_CONFLICT",
        "Trigger idempotency identity was reused for a different semantic impact",
      );
    }
    return {
      execution: existing,
      processorExecutions: existing.processorExecutions,
      replayed,
    };
  }
}

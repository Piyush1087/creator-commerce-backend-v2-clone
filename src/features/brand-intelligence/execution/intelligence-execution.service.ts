import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  IntelligenceProcessorExecutionStatus,
  Prisma,
  type IntelligenceExecution,
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
  CreateOwnerScopedIntelligenceExecutionCommand,
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

  /**
   * Creator owner-scope arm. The accepted 101-migration database has nullable
   * legacy brand keys, while the generated Prisma surface remains Brand-only;
   * therefore creation is expressed here at the shared persistence boundary.
   */
  async createOrReturnOwnerScoped(
    command: CreateOwnerScopedIntelligenceExecutionCommand,
  ): Promise<CreatedIntelligenceExecution> {
    const scopeRows = await this.prisma.$queryRaw<
      Array<{ ownerType: string; creatorProfileId: string | null }>
    >(Prisma.sql`
      SELECT owner_type::text AS "ownerType", creator_profile_id AS "creatorProfileId"
      FROM intelligence_owner_scopes
      WHERE owner_scope_id=${command.ownerScopeId}
    `);
    if (
      scopeRows[0]?.ownerType !== "CREATOR" ||
      scopeRows[0].creatorProfileId !== command.subjectRef
    ) {
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "Creator execution requires the exact typed owner scope",
      );
    }
    const subjectId = stableUuid(
      `creator-subject:${command.ownerScopeId}:${command.subjectRef}`,
    );
    const prepared = this.prepareOwnerScoped(command, subjectId);
    const executionId = stableUuid(
      `creator-execution:${command.ownerScopeId}:${command.subjectRef}:${command.triggerIdempotencyKey}`,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${command.ownerScopeId}:${command.triggerIdempotencyKey}`}, 0))`,
      );
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO intelligence_subjects
          (subject_id, owner_scope_id, brand_id, subject_type, subject_ref, updated_at)
        VALUES (${subjectId}, ${command.ownerScopeId}, NULL, 'CREATOR', ${command.subjectRef}, CURRENT_TIMESTAMP)
        ON CONFLICT (subject_id) DO NOTHING
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO intelligence_executions
          (execution_id, owner_scope_id, brand_id, subject_id, trigger_type,
           trigger_ref, trigger_idempotency_key, correlation_ref,
           requested_semantic_impact, status)
        VALUES (${executionId}, ${command.ownerScopeId}, NULL, ${subjectId},
          ${command.triggerType}, ${command.triggerRef}, ${command.triggerIdempotencyKey},
          ${command.correlationRef}, ${JSON.stringify(command.requestedImpact)}::jsonb,
          'PENDING'::"IntelligenceExecutionStatus")
        ON CONFLICT (execution_id) DO NOTHING
      `);
      for (const item of prepared) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO intelligence_processor_executions
            (processor_execution_id, execution_id, owner_scope_id, brand_id,
             subject_id, processor_id, processor_version, bundle_id,
             bundle_version, bundle_hash, output_contract_id,
             output_contract_version, active_scope, active_scope_hash,
             dependency_manifest, dependency_manifest_hash, evidence_manifest,
             evidence_manifest_hash, trigger_intent_key,
             processor_execution_key, processor_key_version, max_attempts,
             status, eligible_at, updated_at)
          VALUES (${item.id}, ${executionId}, ${command.ownerScopeId}, NULL,
            ${subjectId}, ${item.processorId}, ${item.processorVersion},
            ${item.bundleId}, ${item.bundleVersion}, ${item.bundleHash},
            ${item.outputContractId}, ${item.outputContractVersion},
            ${JSON.stringify(item.activeScope)}::jsonb, ${item.activeScopeHash},
            ${JSON.stringify(item.request.dependencyManifest)}::jsonb, ${item.dependencyManifestHash},
            ${JSON.stringify(item.request.evidenceManifest)}::jsonb, ${item.evidenceManifestHash},
            ${item.triggerIntentKey}, ${item.processorExecutionKey}, 2,
            ${item.request.maxAttempts},
            ${item.request.dependencyEligible ? "QUEUED" : "WAITING_FOR_DEPENDENCY"}::"IntelligenceProcessorExecutionStatus",
            ${item.request.dependencyEligible ? new Date() : null}, CURRENT_TIMESTAMP)
          ON CONFLICT (processor_execution_id) DO NOTHING
        `);
      }
    });
    const executionRows = await this.prisma.$queryRaw<
      IntelligenceExecution[]
    >(Prisma.sql`
      SELECT execution_id AS id, brand_id AS "brandId",
        owner_scope_id AS "ownerScopeId", subject_id AS "subjectId",
        trigger_type AS "triggerType", trigger_ref AS "triggerRef",
        trigger_idempotency_key AS "triggerIdempotencyKey",
        correlation_ref AS "correlationRef",
        requested_semantic_impact AS "requestedImpact", status,
        aggregate_result AS "aggregateResult", created_at AS "createdAt",
        started_at AS "startedAt", completed_at AS "completedAt"
      FROM intelligence_executions WHERE execution_id=${executionId}
    `);
    const processorExecutions = await this.prisma.$queryRaw<
      IntelligenceProcessorExecution[]
    >(Prisma.sql`
      SELECT processor_execution_id AS id, execution_id AS "executionId",
        brand_id AS "brandId", owner_scope_id AS "ownerScopeId",
        subject_id AS "subjectId", processor_id AS "processorId",
        processor_version AS "processorVersion", bundle_id AS "bundleId",
        bundle_version AS "bundleVersion", bundle_hash AS "bundleHash",
        output_contract_id AS "outputContractId",
        output_contract_version AS "outputContractVersion",
        active_scope AS "activeScope", active_scope_hash AS "activeScopeHash",
        dependency_manifest AS "dependencyManifest",
        dependency_manifest_hash AS "dependencyManifestHash",
        evidence_manifest AS "evidenceManifest",
        evidence_manifest_hash AS "evidenceManifestHash",
        trigger_intent_key AS "triggerIntentKey",
        processor_execution_key AS "processorExecutionKey",
        processor_key_version AS "processorKeyVersion", max_attempts AS "maxAttempts",
        status, result_readiness AS "resultReadiness", eligible_at AS "eligibleAt",
        attempt_count AS "attemptCount", lease_token AS "leaseToken",
        lease_owner_ref AS "leaseOwnerRef", lease_expires_at AS "leaseExpiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        last_error_category AS "lastErrorCategory", last_error_code AS "lastErrorCode",
        created_at AS "createdAt", started_at AS "startedAt",
        completed_at AS "completedAt", updated_at AS "updatedAt"
      FROM intelligence_processor_executions
      WHERE execution_id=${executionId}
      ORDER BY processor_execution_id
    `);
    const execution = executionRows[0];
    if (!execution) {
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "Creator execution was not persisted",
      );
    }
    const expectedKeys = prepared
      .map((item) => item.processorExecutionKey)
      .sort();
    const actualKeys = processorExecutions
      .map((item) => item.processorExecutionKey)
      .sort();
    if (
      execution.triggerType !== command.triggerType ||
      execution.triggerRef !== command.triggerRef ||
      canonicalJson(execution.requestedImpact) !==
        canonicalJson(command.requestedImpact) ||
      canonicalJson(actualKeys) !== canonicalJson(expectedKeys)
    ) {
      throw new IntelligenceExecutionError(
        "EXECUTION_IDEMPOTENCY_CONFLICT",
        "Creator trigger identity was reused with different semantic impact",
      );
    }
    return {
      execution,
      processorExecutions,
      replayed: processorExecutions.some((item) => item.attemptCount > 0),
    };
  }

  private prepareOwnerScoped(
    command: CreateOwnerScopedIntelligenceExecutionCommand,
    subjectId: string,
  ) {
    if (command.processors.length === 0) {
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "An Intelligence execution requires at least one processor request",
      );
    }
    return command.processors.map((request) => {
      for (const address of request.activeScope) {
        if (address.brandId !== command.ownerScopeId) {
          throw new IntelligenceExecutionError(
            "INVALID_EXECUTION_STATE",
            "Creator active scope cannot cross owner-scope boundaries",
          );
        }
        this.pathCodec.assertCanonical(
          address.componentSemanticPath,
          address.pathSchemeVersion,
        );
      }
      const manifest = this.contractGate.resolve(request);
      const scope = this.ownership.validateActiveScope(
        request.registryKey,
        request.activeScope,
      );
      if (!scope.valid) {
        throw new IntelligenceExecutionError(
          "CONFIGURATION_DRIFT",
          "Creator active scope is not owned by the verified contract",
        );
      }
      const activeScope = canonicalActiveScope(request.activeScope);
      const activeScopeHash = sha256CanonicalExecution(activeScope);
      const dependencyManifestHash = sha256CanonicalExecution(
        request.dependencyManifest,
      );
      const evidenceManifestHash = sha256CanonicalExecution(
        request.evidenceManifest,
      );
      const processorExecutionKey = processorLogicalKeyV2({
        brandId: command.ownerScopeId,
        subject: { id: subjectId, type: "CREATOR", ref: command.subjectRef },
        manifest,
        activeScope: request.activeScope,
        dependencyManifestHash,
        evidenceManifestHash,
        executionIntentKey: request.executionIntentKey,
      });
      return {
        id: stableUuid(`creator-processor:${processorExecutionKey}`),
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
        triggerIntentKey: request.executionIntentKey,
        processorExecutionKey,
      };
    });
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

function stableUuid(material: string): string {
  const chars = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

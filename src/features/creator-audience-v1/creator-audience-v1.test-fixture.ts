import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { encryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { type InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../brand-intelligence/contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../brand-intelligence/contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../brand-intelligence/execution/execution-aggregation.service";
import { ProcessorExecutorRegistry } from "../brand-intelligence/execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../brand-intelligence/execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ExecutionContractGate } from "../brand-intelligence/execution/registry/execution-contract.gate";
import { RetryBackoffPolicy } from "../brand-intelligence/execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../brand-intelligence/execution/processor-finalization.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { IntelligenceActionRepository } from "../brand-intelligence/persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../brand-intelligence/persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../brand-intelligence/persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../brand-intelligence/transitions/intelligence-transition.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import { CreatorAudiencePersistenceHook } from "../creator-audience/creator-audience-persistence.hook";
import { CreatorAudiencePipelineService } from "../creator-audience/creator-audience-pipeline.service";
import { CreatorAudienceProcessorExecutor } from "../creator-audience/creator-audience-processor.executor";
import { CreatorAudienceRepository } from "../creator-audience/creator-audience.repository";

import { AudienceV1SourceReader } from "./creator-audience-v1.source";
import { CreatorContentCurrentSourceAdapter } from "../creator-content/creator-content-current-source.adapter";
import { AudienceV1Pipeline } from "./creator-audience-v1.pipeline";
import { AudienceV1ProcessorExecutor } from "./creator-audience-v1.processor";
import { AudienceV1PersistenceHook } from "./creator-audience-v1.persistence";
import { CreatorContentProcessorExecutor } from "../creator-content/creator-content-processor.executor";
import { CreatorContentPersistenceHook } from "../creator-content/creator-content-persistence.hook";
import { CreatorContentPipelineService } from "../creator-content/creator-content-pipeline.service";
import { CreatorContentRepository } from "../creator-content/creator-content.repository";
import type { CreatorContentSemanticAnalyzer } from "../creator-content/creator-content-semantic.port";

export function audienceV1TestRuntime(
  db: PrismaClient,
  provider: InstagramIntelligenceProviderReadClient,
) {
  const prisma = db as never;
  const codec = new ComponentPathCodec();
  const semantic = new SemanticValidator();
  const contracts = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    semantic,
  );
  contracts.onModuleInit();
  const creatorExecutor = new CreatorAudienceProcessorExecutor();
  const source = new AudienceV1SourceReader(
    prisma,
    new CreatorContentCurrentSourceAdapter(prisma),
  );
  const v1Executor = new AudienceV1ProcessorExecutor();
  const executors = new ProcessorExecutorRegistry(
    new SyntheticProcessorExecutor(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    creatorExecutor,
    new CreatorContentProcessorExecutor(),
    undefined,
    v1Executor,
  );
  const ownership = new BundlePathOwnershipRegistry(contracts, codec);
  const aggregation = new ExecutionAggregationService();
  const retry = new RetryBackoffPolicy();
  const processorRepository = new ProcessorExecutionRepository(
    prisma,
    aggregation,
    retry,
  );
  const current = new IntelligenceCurrentStateRepository(prisma);
  const transitions = new IntelligenceTransitionService(
    prisma,
    current,
    new IntelligenceCandidateRepository(prisma),
    new IntelligenceActionRepository(prisma),
    codec,
  );
  const creatorPersistence = new CreatorAudiencePersistenceHook(
    new IntelligenceGenerationRepository(prisma, codec),
    current,
    transitions,
    new PersistenceTransitionValidator(contracts, ownership),
    new StructuralValidator(),
    semantic,
    contracts,
  );
  const v1Persistence = new AudienceV1PersistenceHook(
    new IntelligenceGenerationRepository(prisma, codec),
    current,
    transitions,
    new PersistenceTransitionValidator(contracts, ownership),
    new StructuralValidator(),
    semantic,
    contracts,
    source,
  );
  const contentPersistence = new CreatorContentPersistenceHook(
    new IntelligenceGenerationRepository(prisma, codec),
    current,
    transitions,
    new PersistenceTransitionValidator(contracts, ownership),
    new StructuralValidator(),
    semantic,
    contracts,
  );
  const worker = new ProcessorWorkerService(
    processorRepository,
    new ProcessorFinalizationService(
      prisma,
      processorRepository,
      aggregation,
      retry,
    ),
    executors,
    {
      persistBeforeCompletion: (tx, claim, result) =>
        claim.processorExecution.processorId === "creator_audience_v1"
          ? v1Persistence.persistBeforeCompletion(tx, claim, result)
          : claim.processorExecution.processorId === "creator_content_v0"
            ? contentPersistence.persistBeforeCompletion(tx, claim, result)
            : creatorPersistence.persistBeforeCompletion(tx, claim, result),
    },
  );
  const scopes = new IntelligenceOwnerScopeRepository(prisma);
  const pipeline = new CreatorAudiencePipelineService(
    new CreatorAudienceCredentialFenceService(prisma),
    new CreatorAudienceRepository(prisma, scopes),
    new IntelligenceExecutionService(
      prisma,
      new ExecutionContractGate(contracts, executors),
      ownership,
      codec,
    ),
    worker,
    provider,
  );
  const executions = new IntelligenceExecutionService(
    prisma,
    new ExecutionContractGate(contracts, executors),
    ownership,
    codec,
  );
  const v1 = new AudienceV1Pipeline(source, executions, worker, prisma);
  const content = (analyzer: CreatorContentSemanticAnalyzer) =>
    new CreatorContentPipelineService(
      new CreatorAudienceCredentialFenceService(prisma),
      new CreatorContentRepository(prisma, scopes),
      executions,
      worker,
      provider,
      analyzer,
    );
  return {
    pipeline,
    v1,
    source,
    scopes,
    contracts,
    executions,
    worker,
    content,
  };
}

export async function audienceV1TestOwner(db: PrismaClient) {
  const suffix = randomUUID();
  const organization = await db.organization.create({
    data: { kind: "CREATOR", name: `Final correction ${suffix}` },
  });
  const user = await db.user.create({
    data: {
      email: `${suffix}@example.test`,
      normalizedEmail: `${suffix}@example.test`,
      role: "CREATOR",
      authState: "ACTIVE",
      organizationId: organization.id,
      emailVerifiedAt: new Date(),
    },
  });
  const profile = await db.creatorProfile.create({
    data: { userId: user.id },
  });
  const workspace = await db.creatorWorkspace.create({
    data: { ownerProfileId: profile.id, organizationId: organization.id },
  });
  const providerAccountId = `fixture-${suffix}`;
  const integration = await db.creatorSocialIntegration.create({
    data: {
      creatorProfileId: profile.id,
      platformNetwork: "INSTAGRAM",
      nativePlatformUserId: providerAccountId,
      channelHandleString: `fixture_${suffix.slice(0, 8)}`,
      oauthAccessTokenEncrypted: encryptField(`synthetic-${suffix}`),
      tokenScopePermissions: [
        "instagram_business_basic",
        "instagram_business_manage_insights",
      ],
      tokenStateCondition: "ACTIVE",
      authorizationGeneration: 1,
      authorizationHealth: "USABLE",
      basicAuthorizationCapability: "AVAILABLE",
      insightsCapability: "AVAILABLE",
      professionalAccountType: "CREATOR",
    },
  });
  const actor: CreatorWorkspaceActorContext = {
    actorUserId: user.id,
    actorMembershipId: randomUUID(),
    actorRole: "OWNER",
    workspaceId: workspace.id,
    organizationId: organization.id,
    subjectCreatorProfileId: profile.id,
    subjectOwnerUserId: user.id,
    allowedActions: ["INSIGHTS_AUDIENCE_READ"],
  };
  return { profile, workspace, integration, actor, providerAccountId };
}

import { describe, expect, it, vi } from "vitest";

import type { InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";
import type { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import { CreatorAudiencePipelineService } from "./creator-audience-pipeline.service";
import type { CreatorAudienceRepository } from "./creator-audience.repository";
import type { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import type { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";

const actor = {
  actorUserId: "owner",
  actorMembershipId: "membership",
  actorRole: "OWNER" as const,
  workspaceId: "workspace",
  organizationId: "organization",
  subjectCreatorProfileId: "creator",
  subjectOwnerUserId: "owner",
  allowedActions: ["INSIGHTS_AUDIENCE_READ"],
};
const identity = {
  actor,
  integrationId: "integration",
  providerAccountId: "provider-account",
  authorizationGeneration: 2,
  capturedAt: new Date("2026-09-14T10:00:00Z"),
  requestIdentity: "creator-audience:test-replay",
};

function fixture(options: { unavailable?: boolean } = {}) {
  let current: unknown = null;
  const fence = {
    project: vi.fn().mockResolvedValue({
      authorized: true,
      integrationId: "integration",
      providerAccountId: "provider-account",
      authorizationGeneration: 2,
      sourceStatus: "CONNECTED",
    }),
    acquire: vi.fn().mockResolvedValue({
      integrationId: "integration",
      providerAccountId: "provider-account",
      authorizationGeneration: 2,
      accessToken: "synthetic-test-token",
    }),
  } as unknown as CreatorAudienceCredentialFenceService;
  const repository = {
    replay: vi.fn().mockImplementation(() => Promise.resolve(current)),
    begin: vi.fn().mockResolvedValue({}),
    fail: vi.fn().mockResolvedValue(undefined),
    readCurrent: vi.fn().mockResolvedValue(null),
    completeAcquisition: vi
      .fn()
      .mockImplementation(({ value, acquisition }) => {
        current = value;
        return Promise.resolve({
          kind: "CREATOR_AUDIENCE_EVIDENCE_MANIFEST_V1",
          identity: {
            ownerScopeId: "00000000-0000-4000-8000-000000000001",
            creatorProfileId: "00000000-0000-4000-8000-000000000002",
            creatorWorkspaceId: "00000000-0000-4000-8000-000000000003",
            integrationId: "00000000-0000-4000-8000-000000000004",
            providerAccountId: "provider-account",
            authorizationGeneration: 2,
            requestIdentity: identity.requestIdentity,
            captureRef: "capture",
            resourceRef: "resource",
          },
          evidence: acquisition.results.map((result, index) => ({
            evidenceRef: `evidence-${index}`,
            capabilityId:
              result.population === "FOLLOWERS"
                ? "instagram.audience_followers"
                : "instagram.audience_engaged",
            population: result.population,
            breakdown: result.breakdown,
            capturedAt: identity.capturedAt.toISOString(),
            contentHash: index.toString(16).padStart(64, "0"),
          })),
        });
      }),
    generationIdsForProcessorExecution: vi
      .fn()
      .mockResolvedValue(["generation"]),
  } as unknown as CreatorAudienceRepository;
  const executions = {
    createOrReturnOwnerScoped: vi.fn().mockResolvedValue({
      replayed: false,
      execution: {},
      processorExecutions: [{ id: "processor", status: "QUEUED" }],
    }),
  } as unknown as IntelligenceExecutionService;
  const worker = {
    runExact: vi.fn().mockResolvedValue({
      processorExecution: { id: "processor", status: "COMPLETED" },
    }),
  } as unknown as ProcessorWorkerService;
  const provider = {
    readProfile: vi.fn().mockResolvedValue({
      availability: "AVAILABLE",
      providerAccountId: "provider-account",
      appScopedUserId: { state: "OBSERVED", value: "provider-account" },
      username: { state: "OBSERVED", value: "creator" },
      name: { state: "OBSERVED", value: "Creator" },
      accountType: { state: "OBSERVED", value: "CREATOR" },
      followersCount: { state: "OBSERVED", value: 1000 },
      followsCount: { state: "OBSERVED", value: 5 },
      mediaCount: { state: "OBSERVED", value: 10 },
    }),
    readAudienceInsights: vi
      .fn()
      .mockImplementation((_, population, breakdown) =>
        Promise.resolve({
          availability: options.unavailable ? "UNAVAILABLE" : "AVAILABLE",
          population,
          breakdown,
          timeframe: "THIS_MONTH",
          values: options.unavailable ? [] : [{ dimension: "A", value: 100 }],
          denominator: options.unavailable ? undefined : 100,
          limitation: options.unavailable
            ? "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED"
            : null,
        }),
      ),
    readMediaInventory: vi.fn(),
    readMediaInsights: vi.fn(),
    readCarouselChildren: vi.fn(),
  } as unknown as InstagramIntelligenceProviderReadClient;
  return {
    service: new CreatorAudiencePipelineService(
      fence,
      repository,
      executions,
      worker,
      provider,
    ),
    fence,
    repository,
    provider,
    executions,
    worker,
  };
}

describe("Creator Audience provider → shared current pipeline", () => {
  it("replays exactly without a second credential, provider or persistence execution", async () => {
    const { service, fence, repository, provider, executions, worker } =
      fixture();
    const first = await service.execute(identity);
    const second = await service.execute(identity);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(fence.project).toHaveBeenCalledTimes(2);
    expect(fence.acquire).toHaveBeenCalledTimes(1);
    expect(provider.readProfile).toHaveBeenCalledTimes(1);
    expect(provider.readAudienceInsights).toHaveBeenCalledTimes(8);
    expect(repository.completeAcquisition).toHaveBeenCalledTimes(1);
    expect(executions.createOrReturnOwnerScoped).toHaveBeenCalledTimes(1);
    expect(worker.runExact).toHaveBeenCalledTimes(1);
  });

  it("does not publish empty failure over current", async () => {
    const { service, repository } = fixture({ unavailable: true });
    const result = await service.execute(identity);
    expect(result.value.status).toBe("UNAVAILABLE");
    expect(repository.fail).toHaveBeenCalledTimes(1);
    expect(repository.completeAcquisition).not.toHaveBeenCalled();
  });

  it("rejects changed account/generation before provider work", async () => {
    const { service, provider } = fixture();
    await expect(
      service.execute({ ...identity, providerAccountId: "substituted" }),
    ).rejects.toThrow("CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED");
    expect(provider.readProfile).not.toHaveBeenCalled();
  });
});

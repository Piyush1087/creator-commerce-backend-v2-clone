import { describe, expect, it, vi } from "vitest";

import type { InstagramTemporaryImageArtifact } from "../../instagram/media/instagram-image-acquisition.types";
import { InstagramB3aImagePipelineService } from "./instagram-b3a-image-pipeline.service";
import {
  INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
  InstagramB3aVisualModelPort,
} from "./instagram-b3a-visual-observation";

const identity = {
  brandProfileId: "brand-a",
  integrationId: "integration-a",
  providerAccountId: "provider-a",
  authorizationGeneration: 3,
  mediaId: "media-a",
  selection: "SELECTED" as const,
  now: () => new Date("2026-09-11T10:00:00.000Z"),
};

const artifact: InstagramTemporaryImageArtifact = {
  temporaryPath: "task-owned-random.img",
  mediaType: "image/png",
  byteLength: 123,
  width: 2,
  height: 3,
  sha256: "a".repeat(64),
  acquiredAt: "2026-09-11T09:59:59.000Z",
};

class FixtureModel extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "fixture-image-observer";
  readonly modelProfileVersion = "fixture-v1";
  observe = vi.fn().mockResolvedValue({
    description: "A geometric blue composition.",
    visibleElements: ["blue square"],
    dominantColors: ["blue"],
    composition: "Centered geometric composition.",
  });
}

function harness() {
  const acquisition = {
    acquire: vi.fn().mockResolvedValue({
      artifact,
      providerMediaId: identity.mediaId,
      providerObservedAt: "2026-09-10T08:00:00.000Z",
    }),
  };
  const model = new FixtureModel();
  const writer = {
    write: vi.fn().mockResolvedValue({
      resourceRef: "resource-a",
      captureRef: "capture-a",
      capabilityExecutionRef: "execution-a",
      artifactRefs: ["artifact-metadata", "artifact-observation"],
      evidenceRefs: ["evidence-a"],
      reused: false,
    }),
  };
  const temporaryStore = { remove: vi.fn().mockResolvedValue(undefined) };
  const service = new InstagramB3aImagePipelineService(
    acquisition as never,
    model,
    writer as never,
    temporaryStore as never,
  );
  return { service, acquisition, model, writer, temporaryStore };
}

describe("B3A minimum image observation pipeline", () => {
  it("persists one bounded descriptive observation with exact lineage and versions", async () => {
    const h = harness();
    const result = await h.service.execute(identity);

    expect(result).toMatchObject({
      visualInspection: "INSPECTED",
      visualSemanticResult: "AVAILABLE",
      reasonCode: "INSPECTED",
      lineage: {
        resourceRef: "resource-a",
        captureRef: "capture-a",
        capabilityExecutionRef: "execution-a",
      },
    });
    expect(h.model.observe).toHaveBeenCalledWith(
      expect.objectContaining({
        temporaryPath: artifact.temporaryPath,
        promptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
        observationContractVersion: INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
      }),
    );
    const write = h.writer.write.mock.calls[0][0];
    expect(write).toMatchObject({
      capabilityId: "instagram.media_visual_observations",
      resourceType: "INSTAGRAM_MEDIA",
      capturedAt: artifact.acquiredAt,
      observedAt: "2026-09-10T08:00:00.000Z",
      availability: "AVAILABLE",
    });
    expect(write.artifacts).toHaveLength(2);
    expect(write.evidence).toHaveLength(1);
    expect(write.evidence[0].artifactKey).toBe("visual-observation");
    const persisted = JSON.stringify(write);
    expect(persisted).not.toMatch(
      /creator|offering|collaboration|likely_collab|signal|pattern|learning|object/i,
    );
    expect(persisted).not.toContain(artifact.temporaryPath);
    expect(h.temporaryStore.remove).toHaveBeenCalledWith(
      artifact.temporaryPath,
    );
  });

  it("bypasses acquisition, model, persistence and negative evidence when not selected", async () => {
    const h = harness();
    const result = await h.service.execute({
      ...identity,
      selection: "NOT_SELECTED",
    });
    expect(result).toEqual({
      visualInspection: "NOT_INSPECTED",
      visualSemanticResult: "UNKNOWN",
      reasonCode: "NOT_SELECTED",
    });
    expect(h.acquisition.acquire).not.toHaveBeenCalled();
    expect(h.model.observe).not.toHaveBeenCalled();
    expect(h.writer.write).not.toHaveBeenCalled();
  });

  it.each([
    [
      "model error",
      () => Promise.reject(new Error("fixture failure")),
      "MODEL_FAILURE",
    ],
    [
      "invalid output",
      () => Promise.resolve({ creatorPresent: false }),
      "INVALID_MODEL_OUTPUT",
    ],
  ])(
    "keeps semantics UNKNOWN on %s and persists no visual Evidence",
    async (_label, implementation, reason) => {
      const h = harness();
      h.model.observe.mockImplementationOnce(implementation);
      const result = await h.service.execute(identity);
      expect(result).toMatchObject({
        visualInspection: "UNAVAILABLE",
        visualSemanticResult: "UNKNOWN",
        reasonCode: reason,
      });
      const write = h.writer.write.mock.calls[0][0];
      expect(write.availability).toBe("PARTIAL");
      expect(write.artifacts).toHaveLength(1);
      expect(write.evidence).toHaveLength(0);
      expect(h.temporaryStore.remove).toHaveBeenCalledWith(
        artifact.temporaryPath,
      );
    },
  );

  it("rejects unsupported negative creator/Offering/collaboration inference as UNKNOWN", async () => {
    const h = harness();
    h.model.observe.mockResolvedValueOnce({
      description: "No creator or offering is present.",
      visibleElements: [],
      dominantColors: ["blue"],
      composition: "Centered.",
    });
    const result = await h.service.execute(identity);
    expect(result.reasonCode).toBe("INVALID_MODEL_OUTPUT");
    expect(h.writer.write.mock.calls[0][0].evidence).toEqual([]);
  });

  it("cleans the artifact and returns UNKNOWN when the final persistence fence rejects", async () => {
    const h = harness();
    h.writer.write.mockRejectedValueOnce(
      new Error("STALE_AUTHORIZATION_GENERATION"),
    );
    await expect(h.service.execute(identity)).resolves.toEqual({
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      reasonCode: "FINAL_FENCE_REJECTED",
    });
    expect(h.temporaryStore.remove).toHaveBeenCalledWith(
      artifact.temporaryPath,
    );
  });

  it("returns explicit UNKNOWN/unavailable truth for missing locator and security rejection", async () => {
    const { InstagramImageAcquisitionError } =
      await import("../../instagram/media/instagram-image-acquisition.types");
    for (const [code, reason] of [
      ["LOCATOR_UNAVAILABLE", "LOCATOR_UNAVAILABLE"],
      ["UNSAFE_DNS", "SECURITY_REJECTED"],
    ] as const) {
      const h = harness();
      h.acquisition.acquire.mockRejectedValueOnce(
        new InstagramImageAcquisitionError(code),
      );
      const result = await h.service.execute(identity);
      expect(result).toMatchObject({
        visualInspection: "UNAVAILABLE",
        visualSemanticResult: "UNKNOWN",
        reasonCode: reason,
      });
      expect(h.model.observe).not.toHaveBeenCalled();
      expect(h.writer.write.mock.calls[0][0]).toMatchObject({
        availability: "UNAVAILABLE",
        artifacts: [],
        evidence: [],
      });
    }
  });

  it("cleans acquisition/model/transaction failure artifacts and keeps output locator-free", async () => {
    const h = harness();
    const result = await h.service.execute(identity);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("temporaryPath");
    expect(serialized).not.toContain("media_url");
    expect(h.temporaryStore.remove).toHaveBeenCalledTimes(1);
  });
});

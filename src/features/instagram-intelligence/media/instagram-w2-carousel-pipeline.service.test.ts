import { describe, expect, it, vi } from "vitest";

import type { InstagramCarouselChildrenTruth } from "../../instagram/instagram-intelligence-provider.types";
import { InstagramW2CarouselPipelineService } from "./instagram-w2-carousel-pipeline.service";

describe("InstagramW2CarouselPipelineService", () => {
  it("inspects every bounded child in provider ordinal with mixed cover-only truth and bounded concurrency", async () => {
    const fixture = harness({ childCount: 10, videoOrdinals: [2, 7] });
    const result = await fixture.service.execute(request(fixture.children));
    expect(result).toMatchObject({
      reused: false,
      visualInspection: "INSPECTED",
      reasonCode: "CAROUSEL_CHILDREN_INSPECTED",
      coverage: {
        providerChildCountReturned: 10,
        childCountRepresented: 10,
        childCountAttempted: 10,
        childCountVisuallyInspected: 10,
        childCountOcrInspected: 10,
        imageFullCount: 8,
        videoCoverOnlyCount: 2,
        unavailableUnsupportedFailedCount: 0,
        state: "COMPLETE",
        completeVisualScope: true,
        completeVideoScope: false,
      },
    });
    expect(fixture.maxConcurrency()).toBeLessThanOrEqual(3);
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(10);
    expect(
      fixture.acquisition.acquire.mock.calls.map((call) => [
        call[0].mediaId,
        call[0].locatorKind,
      ]),
    ).toEqual(
      fixture.children.children.map((child) => [
        child.providerMediaId,
        [2, 7].includes(child.ordinal) ? "VIDEO_COVER" : "CAROUSEL_CHILD",
      ]),
    );
    expect(fixture.store.remove).toHaveBeenCalledTimes(10);
    const write = fixture.writer.write.mock.calls[0]![0];
    expect(write.evidence).toHaveLength(10);
    expect(
      write.evidence.map((row: { payload: any }) => row.payload.child.ordinal),
    ).toEqual(Array.from({ length: 10 }, (_, index) => index));
    const first = write.evidence[0].payload;
    expect(first.atomicCues).toMatchObject({
      cta: { state: "OBSERVED", phrases: ["shop now"] },
      product: {
        state: "OBSERVED",
        canonicalOfferingId: "offering-1",
        canonicalOfferingMatch: "EXACT_PREEXISTING",
      },
      disclosure: {
        state: "OBSERVED",
        phrases: ["paid partnership"],
        collaborationTruth: "NONE",
        likelyCollabConfidenceCeiling: "LOW",
      },
    });
    expect(JSON.stringify(write)).not.toMatch(
      /temporaryPath|media_url|thumbnail_url|access_token|base64|reasoning/iu,
    );
  });

  it("replays before child acquisition with exact coverage and Evidence order", async () => {
    const fixture = harness({ childCount: 3, videoOrdinals: [1] });
    const first = await fixture.service.execute(request(fixture.children));
    const replay = await fixture.service.execute(request(fixture.children));
    expect(replay).toMatchObject({
      reused: true,
      reasonCode: "EXACT_CAROUSEL_EXECUTION_REUSED",
      coverage: first.coverage,
    });
    expect(replay.evidenceRefs).toEqual(first.evidenceRefs);
    expect(fixture.acquisition.assertReplayAuthorized).toHaveBeenCalledTimes(2);
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(3);
    expect(fixture.visual.observe).toHaveBeenCalledTimes(3);
    expect(fixture.text.observe).toHaveBeenCalledTimes(3);
    expect(fixture.writer.write).toHaveBeenCalledTimes(1);
  });

  it("preserves partial/unsupported/provider-cap truth and never manufactures a negative", async () => {
    const fixture = harness({
      childCount: 3,
      unsupportedOrdinals: [1],
      failingOrdinals: [2],
      availability: "PARTIAL",
      stopReason: "CAP_REACHED",
    });
    const result = await fixture.service.execute(request(fixture.children));
    expect(result.coverage).toMatchObject({
      providerAvailability: "PARTIAL",
      providerStopReason: "CAP_REACHED",
      providerChildCountReturned: 3,
      childCountRepresented: 3,
      childCountAttempted: 2,
      childCountVisuallyInspected: 1,
      unavailableUnsupportedFailedCount: 2,
      state: "PARTIAL",
      completeVisualScope: false,
      completeVideoScope: false,
    });
    expect(result.coverage.children.map((child) => child.state)).toEqual([
      "AVAILABLE",
      "UNKNOWN",
      "UNKNOWN",
    ]);
  });

  it("preserves provider empty and provider-failure truth without successful Evidence fabrication", async () => {
    const empty = harness({
      childCount: 0,
      availability: "AVAILABLE",
      stopReason: "EMPTY_SUCCESS",
    });
    const emptyResult = await empty.service.execute(request(empty.children));
    expect(emptyResult).toMatchObject({
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      coverage: {
        providerAvailability: "AVAILABLE",
        providerStopReason: "EMPTY_SUCCESS",
        childCountRepresented: 0,
        state: "UNAVAILABLE",
      },
    });
    expect(empty.writer.write.mock.calls[0]![0]).toMatchObject({
      availability: "UNAVAILABLE",
      artifacts: [],
      evidence: [],
    });

    const failedEnumeration = harness({
      childCount: 1,
      availability: "PARTIAL",
      stopReason: "PROVIDER_FAILURE",
    });
    const partial = await failedEnumeration.service.execute(
      request(failedEnumeration.children),
    );
    expect(partial.coverage).toMatchObject({
      providerStopReason: "PROVIDER_FAILURE",
      childCountVisuallyInspected: 1,
      state: "PARTIAL",
      completeVisualScope: false,
    });
  });

  it("keeps generic/ambiguous product evidence unlinked and explicit empty distinct", async () => {
    const fixture = harness({
      childCount: 2,
      duplicateOfferings: true,
      explicitEmptyOrdinals: [1],
    });
    await fixture.service.execute(request(fixture.children));
    const rows = fixture.writer.write.mock.calls[0]![0].evidence;
    expect(rows[0].payload.atomicCues.product).toMatchObject({
      state: "OBSERVED",
      canonicalOfferingId: null,
      canonicalOfferingMatch: "NONE",
    });
    expect(rows[1].payload.visualText).toEqual({
      state: "EXPLICIT_EMPTY",
      spans: [],
    });
    expect(rows[1].payload.atomicCues.cta.state).toBe("NOT_OBSERVED");
  });

  it("retains valid visual Evidence when the visual-text model is invalid or unavailable", async () => {
    for (const fixture of [
      harness({ childCount: 1, invalidText: true }),
      harness({ childCount: 1, unconfiguredText: true }),
    ]) {
      const result = await fixture.service.execute(request(fixture.children));
      expect(result).toMatchObject({
        visualSemanticResult: "AVAILABLE",
        coverage: {
          childCountAttempted: 1,
          childCountVisuallyInspected: 1,
          childCountOcrInspected: 0,
          visualUnavailableCount: 0,
          ocrUnavailableCount: 1,
          state: "PARTIAL",
          completeVisualScope: true,
          completeVisualTextScope: false,
        },
      });
      expect(result.evidenceRefs).toHaveLength(1);
      expect(fixture.store.remove).toHaveBeenCalledOnce();
      expect(
        fixture.writer.write.mock.calls[0]![0].evidence[0].payload,
      ).toMatchObject({
        modalityTruth: {
          visualState: "AVAILABLE",
          visualTextState: "UNKNOWN",
          overallState: "PARTIAL",
        },
      });
    }
  });

  it("retains exact OCR text and CTA Evidence when visual output fails validation or execution", async () => {
    for (const fixture of [
      harness({ childCount: 1, invalidVisualOrdinals: [0] }),
      harness({ childCount: 1, failingVisualOrdinals: [0] }),
    ]) {
      const result = await fixture.service.execute(request(fixture.children));
      expect(result.visualSemanticResult).toBe("AVAILABLE");
      expect(result.coverage).toMatchObject({
        childCountVisuallyInspected: 0,
        childCountOcrInspected: 1,
        visualUnavailableCount: 1,
        ocrUnavailableCount: 0,
        state: "PARTIAL",
        completeVisualScope: false,
        completeVisualTextScope: true,
      });
      const payload =
        fixture.writer.write.mock.calls[0]![0].evidence[0].payload;
      expect(payload).not.toHaveProperty("observation");
      expect(payload).toMatchObject({
        visualText: {
          state: "OBSERVED",
          spans: ["Glow Serum", "Paid partnership", "Shop now"],
        },
        modalityTruth: {
          visualState: "UNKNOWN",
          visualTextState: "OBSERVED",
          overallState: "PARTIAL",
        },
        atomicCues: { cta: { state: "OBSERVED", phrases: ["shop now"] } },
      });
    }
  });

  it("keeps both modalities unknown with no Evidence when both fail", async () => {
    const fixture = harness({
      childCount: 1,
      failingVisualOrdinals: [0],
      failingTextOrdinals: [0],
    });
    const result = await fixture.service.execute(request(fixture.children));
    expect(result).toMatchObject({
      evidenceRefs: [],
      coverage: {
        childCountVisuallyInspected: 0,
        childCountOcrInspected: 0,
        state: "UNAVAILABLE",
      },
    });
  });

  it("keeps visual availability distinct from OCR explicit-empty truth", async () => {
    const fixture = harness({ childCount: 1, explicitEmptyOrdinals: [0] });
    const result = await fixture.service.execute(request(fixture.children));
    expect(result.coverage.children[0]).toMatchObject({
      state: "AVAILABLE",
      visualState: "AVAILABLE",
      visualTextState: "EXPLICIT_EMPTY",
    });
    expect(result.coverage).toMatchObject({
      childCountVisuallyInspected: 1,
      childCountOcrInspected: 1,
      completeVisualScope: true,
      completeVisualTextScope: true,
    });
  });

  it("preserves mixed modality-partial counters and truth on exact replay", async () => {
    const fixture = harness({
      childCount: 3,
      failingTextOrdinals: [0],
      failingVisualOrdinals: [1],
      explicitEmptyOrdinals: [2],
    });
    const first = await fixture.service.execute(request(fixture.children));
    const replay = await fixture.service.execute(request(fixture.children));
    expect(first.coverage).toMatchObject({
      childCountVisuallyInspected: 2,
      childCountOcrInspected: 2,
      visualUnavailableCount: 1,
      ocrUnavailableCount: 1,
      state: "PARTIAL",
      completeVisualScope: false,
      completeVisualTextScope: false,
    });
    expect(replay).toMatchObject({ reused: true, coverage: first.coverage });
    expect(replay.evidenceRefs).toEqual(first.evidenceRefs);
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(3);
    expect(fixture.visual.observe).toHaveBeenCalledTimes(3);
    expect(fixture.text.observe).toHaveBeenCalledTimes(3);
  });

  it("does not reuse zero-Evidence failures or changed manifest/source/window/model identity", async () => {
    const fixture = harness({ childCount: 1, failingOrdinals: [0] });
    await fixture.service.execute(request(fixture.children));
    await fixture.service.execute(request(fixture.children));
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(2);

    const changed = harness({ childCount: 1 });
    await changed.service.execute(request(changed.children));
    await changed.service.execute({
      ...request(changed.children),
      sourceCaptureRef: "capture:source:changed",
    });
    await changed.service.execute({
      ...request(changed.children),
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
    });
    changed.text.modelProfileVersion = "text-v2";
    await changed.service.execute(request(changed.children));
    const reordered = {
      ...changed.children,
      children: changed.children.children.map((child) => ({
        ...child,
        ordinal: child.ordinal === 0 ? 1 : child.ordinal,
      })),
    };
    await changed.service.execute(request(reordered));
    expect(changed.acquisition.acquire).toHaveBeenCalledTimes(5);
  });

  it("rejects Brand/account/generation authorization substitutions before reuse", async () => {
    const fixture = harness({ childCount: 1 });
    await fixture.service.execute(request(fixture.children));
    for (const invalid of [
      { ...request(fixture.children), brandProfileId: "brand-2" },
      { ...request(fixture.children), providerAccountId: "account-2" },
      { ...request(fixture.children), authorizationGeneration: 8 },
    ]) {
      await expect(fixture.service.execute(invalid)).rejects.toThrow(
        "authorization fence rejected",
      );
    }
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(1);
  });
});

function harness(options: {
  childCount: number;
  videoOrdinals?: number[];
  unsupportedOrdinals?: number[];
  failingOrdinals?: number[];
  explicitEmptyOrdinals?: number[];
  duplicateOfferings?: boolean;
  invalidText?: boolean;
  unconfiguredText?: boolean;
  failingTextOrdinals?: number[];
  failingVisualOrdinals?: number[];
  invalidVisualOrdinals?: number[];
  availability?: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  stopReason?:
    | "EXHAUSTED"
    | "EMPTY_SUCCESS"
    | "CAP_REACHED"
    | "PROVIDER_FAILURE";
}) {
  const children: InstagramCarouselChildrenTruth = {
    availability: options.availability ?? "AVAILABLE",
    stopReason: options.stopReason ?? "EXHAUSTED",
    children: Array.from({ length: options.childCount }, (_, ordinal) => ({
      providerMediaId: `child-${ordinal}`,
      ordinal,
      mediaType: {
        state: "OBSERVED" as const,
        value: options.unsupportedOrdinals?.includes(ordinal)
          ? "AUDIO"
          : options.videoOrdinals?.includes(ordinal)
            ? "VIDEO"
            : "IMAGE",
      },
      mediaProductType: { state: "EXPLICIT_EMPTY" as const, value: "" },
    })),
  };
  let persisted:
    | {
        metadata: Record<string, unknown>;
        payloads: readonly Record<string, unknown>[];
        refs: readonly string[];
      }
    | undefined;
  let active = 0;
  let maximum = 0;
  const acquisition = {
    assertReplayAuthorized: vi.fn(async (input: any) => {
      if (
        input.brandProfileId !== "brand-1" ||
        input.expectedProviderAccountId !== "account-1" ||
        input.expectedAuthorizationGeneration !== 7
      )
        throw new Error("authorization fence rejected");
    }),
    acquire: vi.fn(async (input: any) => {
      const ordinal = Number(String(input.mediaId).split("-")[1]);
      if (options.failingOrdinals?.includes(ordinal))
        throw new Error("fixture acquisition failure");
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return {
        artifact: {
          temporaryPath: `task-owned-${ordinal}.image`,
          mediaType: "image/jpeg",
          byteLength: 100 + ordinal,
          width: 100,
          height: 100,
          sha256: String(ordinal).padStart(64, "a"),
          acquiredAt: "2026-09-13T00:00:00.000Z",
        },
        providerMediaId: input.mediaId,
        providerObservedAt: null,
      };
    }),
  };
  const visual = {
    providerIdentity: "fixture",
    modelIdentity: "visual-fixture",
    modelProfileVersion: "visual-v1",
    observe: vi.fn(async (input: any) => {
      const ordinal = Number(String(input.temporaryPath).match(/(\d+)/u)?.[1]);
      if (options.failingVisualOrdinals?.includes(ordinal))
        throw new Error("visual model failed");
      if (options.invalidVisualOrdinals?.includes(ordinal))
        return { description: "invalid" };
      return {
        description: "A package with visible text",
        visibleElements: ["product"],
        dominantColors: ["blue"],
        composition: "Centered package",
      };
    }),
  };
  const text = {
    providerIdentity: "fixture",
    modelIdentity: "text-fixture",
    modelProfileVersion: "text-v1",
    observe: vi.fn(async (input: any) => {
      if (options.unconfiguredText)
        throw new Error("visual-text model unconfigured");
      if (options.invalidText)
        return { state: "OBSERVED", spans: ["ignored"], unexpected: true };
      const ordinal = Number(String(input.temporaryPath).match(/(\d+)/u)?.[1]);
      if (options.failingTextOrdinals?.includes(ordinal))
        throw new Error("visual-text model failed");
      return options.explicitEmptyOrdinals?.includes(ordinal)
        ? { state: "EXPLICIT_EMPTY", spans: [] }
        : {
            state: "OBSERVED",
            spans: ["Glow Serum", "Shop now", "Paid partnership"],
          };
    }),
  };
  const prisma = {
    offering: {
      findMany: vi.fn().mockResolvedValue(
        options.duplicateOfferings
          ? [
              { id: "offering-1", name: "Glow Serum" },
              { id: "offering-2", name: "Glow Serum" },
            ]
          : [{ id: "offering-1", name: "Glow Serum" }],
      ),
    },
    dataExtractionEvidenceItem: {
      findMany: vi.fn(async (query: any) => {
        if (
          !persisted ||
          persisted.metadata.replayIdentity !==
            query.where.boundedPayload.equals
        )
          return [];
        return persisted.refs.map((evidenceRef, index) => ({
          evidenceRef,
          captureRef: "capture:w2",
          boundedPayload: persisted!.payloads[index],
          capture: {
            createdAt: new Date("2026-09-13T00:00:00.000Z"),
            contentArtifacts: [
              { inlineContent: JSON.stringify(persisted!.metadata) },
            ],
          },
        }));
      }),
    },
  };
  const writer = {
    write: vi.fn(async (input: any) => {
      const refs = input.evidence.map(
        (row: any) => `evidence:w2:${row.payload.child.ordinal}`,
      );
      if (refs.length) {
        persisted = {
          metadata: input.artifacts[0].payload,
          payloads: input.evidence.map((row: any) => row.payload),
          refs,
        };
      }
      return {
        resourceRef: "resource:w2",
        captureRef: "capture:w2",
        capabilityExecutionRef: "execution:w2",
        artifactRefs: [],
        evidenceRefs: refs,
        reused: false,
      };
    }),
  };
  const store = { remove: vi.fn().mockResolvedValue(undefined) };
  return {
    children,
    acquisition,
    visual,
    text,
    writer,
    store,
    maxConcurrency: () => maximum,
    service: new InstagramW2CarouselPipelineService(
      prisma as never,
      acquisition as never,
      visual as never,
      text as never,
      writer as never,
      store as never,
    ),
  };
}

function request(children: InstagramCarouselChildrenTruth) {
  return {
    brandProfileId: "brand-1",
    integrationId: "integration-1",
    providerAccountId: "account-1",
    authorizationGeneration: 7,
    parentMediaId: "carousel-1",
    children,
    windowEnd: new Date("2026-09-13T00:00:00.000Z"),
    sourceCaptureRef: "capture:source",
    sourceEvidenceRefs: ["evidence:source"],
    now: () => new Date("2026-09-13T00:00:00.000Z"),
  };
}

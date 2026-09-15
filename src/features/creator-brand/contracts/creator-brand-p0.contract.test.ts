import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { campaignStep2CompletionSchema } from "../../brand-uce/validation/campaign/campaign.schema";
import { sha256Canonical } from "../../brand-intelligence/contracts/bundle/canonical-json";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { BrandPreviewArtifactLoader } from "../../brand-onboarding/brand-preview/runtime/brand-preview-artifact.loader";
import {
  CREATOR_BRAND_REGISTRY_KEY,
  creatorBrandVerifiedContract,
} from "../creator-brand-runtime.contract";
import {
  CREATOR_BRAND_ARCHETYPE_SOURCE,
  creatorBrandCanonicalArchetypes,
} from "./creator-brand-archetype.adapter";
import {
  CREATOR_BRAND_ACTIONS,
  CREATOR_BRAND_MUTATION_BOUNDARY,
  CREATOR_BRAND_ROLE_POLICY,
  CreatorBrandMutationRequestSchema,
  CreatorBrandProfileInputSchema,
  CreatorBrandRevisionContractSchema,
} from "./creator-brand-profile.contract";
import {
  CREATOR_BRAND_NICHE_IDS,
  CREATOR_BRAND_VOICE_IDS,
} from "./creator-brand-taxonomies";
import { CreatorBrandSuggestionsSchema } from "./creator-brand-suggestions.contract";

const emptyProfile = () => ({
  headline: null,
  commercialBio: null,
  primaryNicheIds: [],
  creatorArchetypeIds: [],
  archetypeState: "UNCONFIGURED",
  voiceDescriptorIds: [],
  voiceDescription: null,
  visualStyleDescriptors: [],
  palette: null,
  languages: [],
});
const subject = () => ({
  creatorWorkspaceId: randomUUID(),
  ownerCreatorProfileId: randomUUID(),
  ownerUserId: randomUUID(),
});
function suggestionFixture(
  count = 5,
  coverage = 0.7,
  confidence: "LOW" | "MEDIUM" = "MEDIUM",
) {
  const owner = subject();
  const generationId = randomUUID();
  const posts = Array.from({ length: count }, (_, i) => ({
    providerMediaId: `post-${i}`,
    publicationDate: `2026-09-${i % 2 ? "14" : "15"}`,
    evidenceRefs: [`evidence-${i}`],
  }));
  const support = {
    confidence,
    eligiblePostIds: posts.map((p) => p.providerMediaId),
    evidenceRefs: posts.map((p) => p.evidenceRefs[0]),
    sourceComponentGenerationIds: [generationId],
    derivation: {
      kind: "DETERMINISTIC",
      algorithmVersion: "fixture-v1",
      contractVersion: "1.0",
    },
  };
  const absent = () => ({
    availability: "UNKNOWN",
    reason: "Source modality unavailable; no negative claim",
  });
  return {
    contractVersion: "1.0",
    objectSemanticId: "creator_brand_suggestions",
    subject: owner,
    authority: "CREATOR_SHOP_DERIVED",
    protection: "UNPROTECTED",
    autoApply: false,
    processorVersion: "1.0",
    sourceContent: {
      objectSemanticId: "creator_content",
      objectGenerationId: randomUUID(),
      ownerScopeId: randomUUID(),
      subject: owner,
      componentGenerations: [{ path: "$/f/content_snapshot", generationId }],
      evidenceRefs: posts.map((p) => p.evidenceRefs[0]),
      providerInventoryComplete: true,
      semanticCoverage: coverage,
      posts,
      windowDays: 90,
      windowEnd: "2026-09-15T12:00:00Z",
    },
    families: {
      positioning: {
        primaryNicheIds: {
          availability: "AVAILABLE",
          value: ["EDUCATION"],
          support,
        },
        headline: absent(),
      },
      voice_personality: {
        voiceDescriptorIds: absent(),
        voiceDescription: absent(),
      },
      creator_style: { creatorArchetypeIds: absent() },
      visual_identity: {
        visualStyleDescriptors: absent(),
        paletteCue: absent(),
      },
      languages: { languageTags: absent() },
    },
  };
}

describe("Creator Brand P0 executable contracts (no runtime implementation)", () => {
  it("does not promote model color words/guessed hex into exact palette cues", () => {
    const fixture = suggestionFixture();
    Object.assign(fixture.families.visual_identity.paletteCue, {
      availability: "AVAILABLE",
      value: { kind: "EXACT_HEX", colors: ["#ABCDEF"] },
      support: {
        ...fixture.families.positioning.primaryNicheIds.support,
        derivation: {
          kind: "MODEL",
          provider: "fixture",
          model: "fixture",
          profileVersion: "1",
          contractVersion: "1.0",
        },
      },
    });
    expect(CreatorBrandSuggestionsSchema.safeParse(fixture).success).toBe(
      false,
    );
  });
  it("accepts every inclusive canonical maximum without any Intelligence input", () => {
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        headline: "h".repeat(160),
        commercialBio: "b".repeat(1000),
        primaryNicheIds: CREATOR_BRAND_NICHE_IDS.slice(0, 3),
        creatorArchetypeIds: ["EDUCATOR", "STORYTELLER", "UGC_CREATOR"],
        archetypeState: "CONFIRMED",
        voiceDescriptorIds: CREATOR_BRAND_VOICE_IDS.slice(0, 3),
        voiceDescription: "v".repeat(300),
        visualStyleDescriptors: ["a".repeat(100), "b", "c", "d", "e"],
        palette: ["#000001", "#000002", "#000003", "#000004", "#000005"],
        languages: ["en", "fr", "de", "es", "pt", "it", "ja", "ko", "zh", "hi"],
      }).success,
    ).toBe(true);
  });
  it("manual progressive setup requires no source/model and distinguishes zero archetypes", () => {
    expect(
      CreatorBrandProfileInputSchema.parse(emptyProfile()).creatorArchetypeIds,
    ).toEqual([]);
    expect(
      CREATOR_BRAND_MUTATION_BOUNDARY.intelligenceRequiredForManualSetup,
    ).toBe(false);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(false);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: ["EDUCATOR"],
      }).success,
    ).toBe(false);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: ["EDUCATOR"],
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(true);
  });
  it.each([
    "creatorProfileId",
    "creatorWorkspaceId",
    "name",
    "avatar",
    "instagramHandle",
    "openToUgcProjects",
    "origin",
    "suggestionProvenance",
  ])(
    "rejects projected/caller identity or foreign mutation field %s",
    (key) => {
      expect(
        CreatorBrandProfileInputSchema.safeParse({
          ...emptyProfile(),
          [key]: "caller-claim",
        }).success,
      ).toBe(false);
    },
  );
  it.each([
    ["primaryNicheIds", [...CREATOR_BRAND_NICHE_IDS.slice(0, 4)]],
    ["voiceDescriptorIds", [...CREATOR_BRAND_VOICE_IDS.slice(0, 4)]],
    ["voiceDescription", "x".repeat(301)],
    ["visualStyleDescriptors", ["a", "b", "c", "d", "e", "f"]],
    [
      "palette",
      ["#000001", "#000002", "#000003", "#000004", "#000005", "#000006"],
    ],
    [
      "languages",
      ["en", "fr", "de", "es", "pt", "it", "ja", "ko", "zh", "hi", "ar"],
    ],
    ["headline", "x".repeat(161)],
    ["commercialBio", "x".repeat(1001)],
    ["visualStyleDescriptors", ["x".repeat(101)]],
    ["primaryNicheIds", ["UNAUTHORIZED"]],
    ["voiceDescriptorIds", ["CUSTOM"]],
    ["palette", ["blue"]],
    ["languages", ["not_a_tag"]],
  ])("rejects exceeded or noncanonical bound %s", (key, value) => {
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        [key as string]: value,
      }).success,
    ).toBe(false);
  });
  it("normalizes exact palette/language values and rejects canonical duplicates", () => {
    const value = CreatorBrandProfileInputSchema.parse({
      ...emptyProfile(),
      palette: ["#abcdef"],
      languages: ["EN-us"],
    });
    expect(value.palette).toEqual(["#ABCDEF"]);
    expect(value.languages).toEqual(["en-US"]);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        palette: ["#abcdef", "#ABCDEF"],
      }).success,
    ).toBe(false);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        languages: ["en-US", "EN-us"],
      }).success,
    ).toBe(false);
  });
  it("pins exactly the existing 30-ID Campaign artifact without changing 1..5", async () => {
    expect(CREATOR_BRAND_ARCHETYPE_SOURCE.blob).toBe(
      "5a2819f8a765857bb03c4b9ecc68d6fd4e7b707c",
    );
    const library = creatorBrandCanonicalArchetypes();
    expect(library).toHaveLength(30);
    expect(await new BrandPreviewArtifactLoader().loadArchetypes()).toEqual(
      library.map((item) => ({
        id: item.id,
        label: item.label,
        isActive: item.is_active,
      })),
    );
    const artifact = parse(
      readFileSync(
        join(
          __dirname,
          "..",
          "..",
          "brand-onboarding",
          "brand-preview",
          "runtime",
          "artifacts",
          "creator_archetypes.yaml",
        ),
        "utf8",
      ),
    );
    expect(artifact.rules).toMatchObject({
      campaign_selection_min: 1,
      campaign_selection_max: 5,
    });
    for (const count of [0, 1, 5, 6]) {
      expect(
        campaignStep2CompletionSchema.safeParse({
          creatorArchetypes: library.slice(0, count).map((item) => item.id),
          minimumFollowers: 20_000,
          maximumFollowers: 100_000,
          audienceAgeMin: 18,
          audienceAgeMax: 34,
          audienceGender: "ALL",
          audienceAffinityIds: ["AFFINITY_1"],
          audienceGeographies: [{ scope: "COUNTRY", placeId: "india" }],
        }).success,
      ).toBe(count === 1 || count === 5);
    }
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: library.slice(0, 3).map((i) => i.id),
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(true);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: library.slice(0, 4).map((i) => i.id),
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(false);
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: ["CUSTOM"],
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(false);
    expect(CREATOR_BRAND_MUTATION_BOUNDARY.ugcArchetypeImpliesWillingness).toBe(
      false,
    );
    expect(
      CreatorBrandProfileInputSchema.safeParse({
        ...emptyProfile(),
        creatorArchetypeIds: ["UGC_CREATOR"],
        archetypeState: "CONFIRMED",
      }).success,
    ).toBe(true);
  });
  it("consumes the exact Product niche/voice sets, not unrelated taxonomy", () => {
    expect(CREATOR_BRAND_NICHE_IDS.join("\n")).toBe(
      "BEAUTY\nFASHION\nLIFESTYLE\nHEALTH_WELLNESS\nFITNESS\nFOOD_COOKING\nTRAVEL\nPARENTING_FAMILY\nHOME_INTERIORS\nTECHNOLOGY\nGAMING\nEDUCATION\nCAREER_PRODUCTIVITY\nBUSINESS_ENTREPRENEURSHIP\nPERSONAL_FINANCE\nARTS_CULTURE\nENTERTAINMENT_COMEDY\nMUSIC\nPHOTOGRAPHY_FILM\nBOOKS_WRITING\nSPORTS\nAUTOMOTIVE\nPETS_ANIMALS\nSUSTAINABILITY\nDIY_CRAFTS\nRELATIONSHIPS\nSPIRITUALITY_MINDFULNESS",
    );
    expect(CREATOR_BRAND_VOICE_IDS.join(" ")).toBe(
      "EDUCATIONAL WARM DIRECT PLAYFUL ASPIRATIONAL PRACTICAL ANALYTICAL CONVERSATIONAL BOLD HUMOROUS CALM ENERGETIC",
    );
  });
  it("accepts exact LOW and MEDIUM thresholds, no HIGH or incomplete-source suggestion", () => {
    expect(
      CreatorBrandSuggestionsSchema.safeParse(suggestionFixture(3, 0.5, "LOW"))
        .success,
    ).toBe(true);
    expect(
      CreatorBrandSuggestionsSchema.safeParse(suggestionFixture()).success,
    ).toBe(true);
    for (const fixture of [
      suggestionFixture(2, 0.5, "LOW"),
      suggestionFixture(3, 0.49, "LOW"),
      suggestionFixture(4, 0.7),
      suggestionFixture(5, 0.69),
    ])
      expect(CreatorBrandSuggestionsSchema.safeParse(fixture).success).toBe(
        false,
      );
    const incomplete = suggestionFixture();
    incomplete.sourceContent.providerInventoryComplete = false;
    expect(CreatorBrandSuggestionsSchema.safeParse(incomplete).success).toBe(
      false,
    );
    const sameDate = suggestionFixture();
    sameDate.sourceContent.posts.forEach(
      (post) => (post.publicationDate = "2026-09-15"),
    );
    expect(CreatorBrandSuggestionsSchema.safeParse(sameDate).success).toBe(
      false,
    );
    const high = suggestionFixture();
    Object.assign(high.families.positioning.primaryNicheIds.support, {
      confidence: "HIGH",
    });
    expect(CreatorBrandSuggestionsSchema.safeParse(high).success).toBe(false);
  });
  it("rejects foreign source subject, field Evidence, component, post and sixth Bio family", () => {
    const fixtures = Array.from({ length: 7 }, () => suggestionFixture());
    fixtures[0].sourceContent.subject = { ...subject() };
    fixtures[1].families.positioning.primaryNicheIds.support.evidenceRefs = [
      "foreign",
    ];
    fixtures[2].families.positioning.primaryNicheIds.support.sourceComponentGenerationIds =
      [randomUUID()];
    fixtures[3].families.positioning.primaryNicheIds.support.eligiblePostIds[0] =
      "foreign";
    Object.assign(fixtures[4].families, { commercialBio: "NOT_AUTHORIZED" });
    fixtures[5].autoApply = true;
    fixtures[6].sourceContent.componentGenerations[0].path =
      "$/f/content_performance";
    fixtures.forEach((f) =>
      expect(CreatorBrandSuggestionsSchema.safeParse(f).success).toBe(false),
    );
  });
  it("freezes explicit roles and revision/concurrency/audit without executing mutations", () => {
    expect(CREATOR_BRAND_ACTIONS).toHaveLength(3);
    expect(CREATOR_BRAND_ROLE_POLICY.OWNER).toEqual(
      CREATOR_BRAND_ROLE_POLICY.MANAGER,
    );
    expect(Object.values(CREATOR_BRAND_ROLE_POLICY.ASSISTANT)).toEqual([
      true,
      false,
      false,
    ]);
    const request = {
      intent: "MANUAL",
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
      values: emptyProfile(),
    };
    expect(CreatorBrandMutationRequestSchema.safeParse(request).success).toBe(
      true,
    );
    expect(
      CreatorBrandMutationRequestSchema.safeParse({
        ...request,
        origin: "SUGGESTION_USED",
      }).success,
    ).toBe(false);
    expect(
      CreatorBrandMutationRequestSchema.safeParse({
        ...request,
        expectedRevision: -1,
      }).success,
    ).toBe(false);
    const revision = {
      subject: subject(),
      actor: {
        actorUserId: randomUUID(),
        actorMembershipId: randomUUID(),
        actorRole: "MANAGER",
      },
      revision: 1,
      previousRevision: 0,
      idempotencyKey: randomUUID(),
      createdAt: "2026-09-15T12:00:00Z",
      origin: "MANUAL",
      confirmedValues: emptyProfile(),
      serverVerifiedSuggestionReference: null,
    };
    expect(CreatorBrandRevisionContractSchema.safeParse(revision).success).toBe(
      true,
    );
    expect(
      CreatorBrandRevisionContractSchema.safeParse({ ...revision, revision: 3 })
        .success,
    ).toBe(false);
    expect(
      CreatorBrandRevisionContractSchema.safeParse({
        ...revision,
        actor: { ...revision.actor, actorRole: "ASSISTANT" },
      }).success,
    ).toBe(false);
    expect(
      CREATOR_BRAND_MUTATION_BOUNDARY.rewriteHistoricalApplicationsCollaborations,
    ).toBe(false);
  });
  it("retains frozen P0 bundle hash and five paths when P2 activates registration", () => {
    const contract = creatorBrandVerifiedContract();
    const { artifacts, bundleContentHash, ...identity } =
      contract.bundle.manifest;
    expect(artifacts).toEqual([]);
    expect(bundleContentHash).toBe(
      sha256Canonical({ identity, artifacts: contract.bundle.artifacts }),
    );
    expect(contract).toEqual(creatorBrandVerifiedContract());
    expect(contract.registration.ownedPathPatterns).toHaveLength(5);
    expect(contract.registration.executionEnabled).toBe(true);
    expect(
      contract.bundle.artifacts.processorDefinition.execution_enabled,
    ).toBe(false);
    expect(contract.bundle.manifest.bundleContentHash).toBe(
      "5f8c179abd6d9a6e146d9322d93a961f80467183889c6d49f801dfb15410472c",
    );
    const registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    registry.onModuleInit();
    expect(registry.isReady()).toBe(true);
    expect(registry.getVerifiedBundle(CREATOR_BRAND_REGISTRY_KEY)).toEqual(
      contract.bundle,
    );
    const value = suggestionFixture();
    const semanticContext = {
      bundle: contract.bundle,
      evidenceManifest: value.sourceContent.evidenceRefs.map((evidenceRef) => ({
        evidenceRef,
        capabilityId: "instagram.media_insights",
        semanticId: "fixture-media",
        revisionIdentity: "fixture-revision",
        sourceClass: "INSTAGRAM_OWNED",
        freshness: "CURRENT" as const,
      })),
      businessStateManifest: [],
    };
    expect(new SemanticValidator().validate(value, semanticContext).valid).toBe(
      true,
    );
    Object.assign(value.families.positioning.primaryNicheIds.support, {
      confidence: "HIGH",
    });
    expect(new SemanticValidator().validate(value, semanticContext).valid).toBe(
      false,
    );
    expect(
      registry
        .registrations()
        .filter(
          (r) => r.processorId === CREATOR_BRAND_REGISTRY_KEY.processorId,
        ),
    ).toEqual([contract.registration]);
    expect(readdirSync(join(__dirname, ".."))).not.toEqual(
      expect.arrayContaining([
        "creator-brand-processor.executor.ts",
        "creator-brand-content-read.adapter.ts",
        "creator-brand-scheduler.ts",
      ]),
    );
  });
});

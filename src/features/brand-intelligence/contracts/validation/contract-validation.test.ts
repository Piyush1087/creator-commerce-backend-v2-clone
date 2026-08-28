import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { ContractBundleIntegrityVerifier } from "../bundle/contract-bundle.integrity";
import type { ContractRegistryKey } from "../bundle/contract-bundle.types";
import { BundlePathOwnershipRegistry } from "../registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../registry/contract-runtime.registry";
import {
  BRAND_COMMUNICATION_EVIDENCE_MANIFEST,
  EMPTY_BUSINESS_STATE_MANIFEST,
  VALID_BRAND_COMMUNICATION_EXPLICIT_NULL,
  VALID_BRAND_COMMUNICATION_FULL,
  VALID_BRAND_COMMUNICATION_PARTIAL,
} from "./fixtures/brand-communication.fixtures";
import {
  BRAND_MEANING_BUSINESS_STATE_MANIFEST,
  BRAND_MEANING_EVIDENCE_MANIFEST,
  VALID_BRAND_MEANING_EXPLICIT_NULL,
  VALID_BRAND_MEANING_FULL,
  VALID_BRAND_MEANING_PARTIAL,
} from "./fixtures/brand-meaning.fixtures";
import { PersistenceTransitionValidator } from "./persistence-transition.validator";
import { SemanticValidator } from "./semantic.validator";
import {
  validateDurableIdentityNamespace,
  validateEstablishingLineage,
  validateHardConstraintGrounding,
} from "./semantic-policy.mechanisms";
import { StructuralValidator } from "./structural.validator";

const GENERATED_ROOT = join(
  process.cwd(),
  "src",
  "features",
  "brand-intelligence",
  "generated",
  "contract-bundles",
);
const COMMUNICATION_KEY: ContractRegistryKey = {
  processorId: "brand_communication",
  processorVersion: "1.0",
  outputContractId: "brand_communication_output_contract",
  outputContractVersion: "1.0",
};
const MEANING_KEY: ContractRegistryKey = {
  processorId: "brand_meaning",
  processorVersion: "1.0",
  outputContractId: "brand_meaning_output_contract",
  outputContractVersion: "1.0",
};

function address(
  objectSemanticId: string,
  componentSemanticPath = "$",
): ComponentSemanticAddress {
  return {
    brandId: "brand-1",
    objectSemanticId,
    pathSchemeVersion: 1,
    componentSemanticPath,
  };
}

describe("W1.0C contract validation", () => {
  let registry: ContractRuntimeRegistry;
  let ownership: BundlePathOwnershipRegistry;
  let structural: StructuralValidator;
  let semantic: SemanticValidator;
  let persistence: PersistenceTransitionValidator;

  beforeEach(() => {
    semantic = new SemanticValidator();
    registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      semantic,
    );
    registry.verifyAtRoot(GENERATED_ROOT);
    ownership = new BundlePathOwnershipRegistry(
      registry,
      new ComponentPathCodec(),
    );
    structural = new StructuralValidator();
    persistence = new PersistenceTransitionValidator(registry, ownership);
  });

  it("distinguishes canonical syntax from registered semantic ownership", () => {
    const owned = [
      address("communication_profile"),
      address("communication_profile", "$/f/primary_language"),
      address("communication_profile", "$/f/tone_traits/i/warm-direct"),
    ];
    expect(ownership.validateActiveScope(COMMUNICATION_KEY, owned).valid).toBe(
      true,
    );
    expect(
      ownership.validateActiveScope(COMMUNICATION_KEY, [
        address("communication_profile", "$/f/tone_traits/f/0"),
        address("audience_profile"),
      ]).valid,
    ).toBe(false);
    expect(
      ownership.validateActiveScope(COMMUNICATION_KEY, [owned[1], owned[1]])
        .valid,
    ).toBe(false);
  });

  it.each([
    ["communication full", COMMUNICATION_KEY, VALID_BRAND_COMMUNICATION_FULL],
    [
      "communication partial",
      COMMUNICATION_KEY,
      VALID_BRAND_COMMUNICATION_PARTIAL,
    ],
    [
      "communication explicit null",
      COMMUNICATION_KEY,
      VALID_BRAND_COMMUNICATION_EXPLICIT_NULL,
    ],
    ["meaning full", MEANING_KEY, VALID_BRAND_MEANING_FULL],
    ["meaning partial", MEANING_KEY, VALID_BRAND_MEANING_PARTIAL],
    ["meaning explicit null", MEANING_KEY, VALID_BRAND_MEANING_EXPLICIT_NULL],
  ])(
    "accepts contract-valid structural fixture: %s",
    (_label, key, fixture) => {
      expect(
        structural.validate(registry.getVerifiedBundle(key), fixture).valid,
      ).toBe(true);
    },
  );

  it("rejects unknown fields, wrong enums, and missing semantic item IDs without salvage", () => {
    const unknown = structuredClone(VALID_BRAND_MEANING_FULL) as Record<
      string,
      unknown
    >;
    unknown.unexpected = true;
    const unknownResult = structural.validate(
      registry.getVerifiedBundle(MEANING_KEY),
      unknown,
    );
    expect(unknownResult.valid).toBe(false);
    expect(unknownResult.issues.map((item) => item.code)).toContain(
      "UNKNOWN_FIELD",
    );
    expect("value" in unknownResult).toBe(false);

    const wrongEnum = structuredClone(VALID_BRAND_COMMUNICATION_FULL) as {
      output_metadata: { primary_language: { authority: string } };
    };
    wrongEnum.output_metadata.primary_language.authority = "BRAND_CONFIRMED";
    expect(
      structural
        .validate(registry.getVerifiedBundle(COMMUNICATION_KEY), wrongEnum)
        .issues.map((item) => item.code),
    ).toContain("INVALID_ENUM");

    const missingId = structuredClone(VALID_BRAND_COMMUNICATION_FULL) as {
      communication_profile: { tone_traits: Record<string, unknown>[] };
    };
    delete missingId.communication_profile.tone_traits[0].semantic_id;
    expect(
      structural
        .validate(registry.getVerifiedBundle(COMMUNICATION_KEY), missingId)
        .issues.map((item) => item.code),
    ).toContain("MISSING_REQUIRED_FIELD");
  });

  it("accepts positive semantic fixtures and rejects protected authority", () => {
    const communicationContext = {
      bundle: registry.getVerifiedBundle(COMMUNICATION_KEY),
      evidenceManifest: BRAND_COMMUNICATION_EVIDENCE_MANIFEST,
      businessStateManifest: EMPTY_BUSINESS_STATE_MANIFEST,
    };
    expect(
      semantic.validate(VALID_BRAND_COMMUNICATION_FULL, communicationContext)
        .valid,
    ).toBe(true);
    expect(
      semantic.validate(VALID_BRAND_COMMUNICATION_PARTIAL, communicationContext)
        .valid,
    ).toBe(true);
    expect(
      semantic.validate(
        VALID_BRAND_COMMUNICATION_EXPLICIT_NULL,
        communicationContext,
      ).valid,
    ).toBe(true);

    const protectedOutput = structuredClone(VALID_BRAND_COMMUNICATION_FULL) as {
      output_metadata: { primary_language: { authority: string } };
    };
    protectedOutput.output_metadata.primary_language.authority =
      "BRAND_CONFIRMED";
    expect(
      semantic
        .validate(protectedOutput, communicationContext)
        .issues.map((item) => item.code),
    ).toContain("PROCESSOR_AUTHORITY_FORBIDDEN");
  });

  it("validates Evidence capability and canonical business-state manifests", () => {
    const meaningContext = {
      bundle: registry.getVerifiedBundle(MEANING_KEY),
      evidenceManifest: BRAND_MEANING_EVIDENCE_MANIFEST,
      businessStateManifest: BRAND_MEANING_BUSINESS_STATE_MANIFEST,
    };
    for (const output of [
      VALID_BRAND_MEANING_FULL,
      VALID_BRAND_MEANING_PARTIAL,
      VALID_BRAND_MEANING_EXPLICIT_NULL,
    ]) {
      expect(semantic.validate(output, meaningContext).valid).toBe(true);
    }
    const invalidEvidence = [
      ...BRAND_MEANING_EVIDENCE_MANIFEST,
      {
        evidenceRef: "ev:bad:1",
        capabilityId: "provider.private_payload",
        semanticId: "raw_page",
        revisionIdentity: "capture:5",
      },
    ];
    expect(
      semantic
        .validate(VALID_BRAND_MEANING_FULL, {
          ...meaningContext,
          evidenceManifest: invalidEvidence,
        })
        .issues.map((item) => item.code),
    ).toContain("INVALID_EVIDENCE_MANIFEST");
    expect(
      semantic
        .validate(VALID_BRAND_MEANING_FULL, {
          ...meaningContext,
          businessStateManifest: [],
        })
        .issues.map((item) => item.code),
    ).toContain("UNKNOWN_BUSINESS_STATE_REFERENCE");
  });

  it("provides generic cross-domain semantic-policy mechanisms", () => {
    expect(
      validateDurableIdentityNamespace("preview:audience:young-adults", [
        "preview",
      ]).map((item) => item.code),
    ).toContain("NON_DURABLE_IDENTITY_NAMESPACE");
    expect(
      validateEstablishingLineage(
        {
          targetSemanticId: "serviceability",
          sourceSemanticIds: ["audience_geography"],
        },
        {
          targetSemanticId: "serviceability",
          forbiddenSourceSemanticIds: ["audience_geography"],
          issueCode: "AUDIENCE_GEOGRAPHY_CANNOT_ESTABLISH_SERVICEABILITY",
        },
      ).map((item) => item.code),
    ).toContain("AUDIENCE_GEOGRAPHY_CANNOT_ESTABLISH_SERVICEABILITY");
    expect(
      validateHardConstraintGrounding(
        {
          semanticDomain: "visual_identity",
          hardConstraint: true,
          groundingValues: ["REPEATED_VISUAL_PATTERN"],
        },
        {
          semanticDomain: "visual_identity",
          explicitGroundingValues: ["EXPLICIT_BRAND_RULE"],
          issueCode: "VISUAL_PROCESSOR_CANNOT_INVENT_HARD_CONSTRAINT",
        },
      ).map((item) => item.code),
    ).toContain("VISUAL_PROCESSOR_CANNOT_INVENT_HARD_CONSTRAINT");
  });

  it("validates transition proposals without executing W1.0B CAS", () => {
    const scalar = address("brand_description");
    expect(
      persistence.validate({
        registryKey: MEANING_KEY,
        activeScope: [scalar],
        currentState: [{ ...scalar, exists: false, protected: false }],
        proposals: [
          {
            ...scalar,
            disposition: "APPLY_CURRENT",
            authority: "CREATOR_SHOP_DERIVED",
            expectedCurrent: { state: "ABSENT" },
            evidenceRefs: ["ev:company:1"],
            businessStateRefs: [],
          },
        ],
      }).valid,
    ).toBe(true);

    const language = address("communication_profile", "$/f/primary_language");
    const protectedSnapshot = {
      ...language,
      exists: true,
      generationId: "generation-7",
      revision: 4n,
      authority: "BRAND_CONFIRMED",
      protected: true,
    } as const;
    const base = {
      ...language,
      authority: "CREATOR_SHOP_DERIVED",
      expectedCurrent: {
        state: "PRESENT" as const,
        generationId: "generation-7",
        revision: 4n,
      },
      basisGenerationId: "generation-7",
      basisRevision: 4n,
      evidenceRefs: ["ev:language:1"],
      businessStateRefs: [],
    };
    expect(
      persistence.validate({
        registryKey: COMMUNICATION_KEY,
        activeScope: [language],
        currentState: [protectedSnapshot],
        proposals: [{ ...base, disposition: "CREATE_CANDIDATE" }],
      }).valid,
    ).toBe(true);
    const rejectedResult = persistence.validate({
      registryKey: COMMUNICATION_KEY,
      activeScope: [language],
      currentState: [protectedSnapshot],
      proposals: [
        {
          ...base,
          disposition: "APPLY_CURRENT",
          expectedCurrent: {
            state: "PRESENT",
            generationId: "stale-generation",
            revision: 3n,
          },
        },
      ],
    });
    expect(rejectedResult.valid).toBe(false);
    expect(rejectedResult.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "EXPECTED_BASIS_MISMATCH",
        "PROTECTED_CURRENT_OVERWRITE",
      ]),
    );
  });
});

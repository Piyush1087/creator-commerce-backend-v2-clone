import {
  serviceabilityEvidenceSupport,
  serviceabilityLocationSupport,
} from "../../input/evidence/serviceability-evidence-admission";
import type {
  ServiceabilityBasis,
  ServiceabilityItemMetadata,
  ServiceabilityMetadata,
  ServiceabilityOutput,
  ServiceableMarket,
} from "../../processors/serviceability/serviceability.types";
import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  EvidenceManifestEntry,
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";

const unique = (values: readonly string[] | null | undefined) =>
  new Set(values ?? []).size === (values ?? []).length;
const sameText = (a: string | null, b: string | null) =>
  (a ?? "").trim().toLocaleLowerCase("en-US") ===
  (b ?? "").trim().toLocaleLowerCase("en-US");

function assertionMatches(
  market: ServiceableMarket,
  assertion: {
    polarity: string;
    scope: string;
    country_code: string | null;
    region: string | null;
    locality: string | null;
  },
) {
  return (
    assertion.polarity === "SUPPORTED" &&
    assertion.scope === market.scope &&
    assertion.country_code === market.country_code &&
    sameText(assertion.region, market.region) &&
    sameText(assertion.locality, market.locality)
  );
}

export class ServiceabilitySemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "serviceability_synthesis";
  validate(
    raw: Readonly<Record<string, unknown>>,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const output = raw as unknown as ServiceabilityOutput;
    const issues: ValidationIssue[] = [];
    const issue = (code: string) =>
      issues.push({ category: "SEMANTIC", code, message: code });
    const profile = output.serviceability_profile;
    const metadata = output.output_metadata;
    const evidence = new Map(
      context.evidenceManifest.map((entry) => [entry.evidenceRef, entry]),
    );
    const business = new Map(
      context.businessStateManifest.map((entry) => [
        entry.businessStateRef,
        entry,
      ]),
    );
    const checkRefs = (meta: ServiceabilityMetadata | null) => {
      if (!meta) return;
      if (
        !unique(meta.evidence_refs) ||
        !unique(meta.business_state_refs) ||
        meta.freshness !== "CURRENT" ||
        meta.evidence_refs.some((ref) => !evidence.has(ref)) ||
        (meta.business_state_refs ?? []).some((ref) => !business.has(ref))
      )
        issue("SERVICEABILITY_METADATA_REFERENCE_INVALID");
    };
    const itemMetadata = (
      items: readonly { semantic_id: string }[] | null,
      metas: readonly ServiceabilityItemMetadata[] | null,
    ) => {
      const ids = (items ?? []).map((item) => item.semantic_id);
      const metadataIds = (metas ?? []).map((item) => item.semantic_id);
      if (
        new Set(ids).size !== ids.length ||
        new Set(metadataIds).size !== metadataIds.length ||
        ids.length !== metadataIds.length ||
        ids.some((id) => !metadataIds.includes(id))
      )
        issue("SERVICEABILITY_ITEM_METADATA_MISMATCH");
      (metas ?? []).forEach(checkRefs);
    };
    if (!profile) {
      if (Object.values(metadata).some((value) => value !== null))
        issue("SERVICEABILITY_NULL_METADATA_MISMATCH");
      return issues;
    }
    if (
      metadata.coverage_is_heterogeneous === null ||
      metadata.coverage_is_heterogeneous.authority !== "CREATOR_SHOP_DERIVED"
    )
      issue("SERVICEABILITY_COVERAGE_METADATA_INVALID");
    checkRefs(metadata.overall_scope);
    checkRefs(metadata.coverage_is_heterogeneous);
    checkRefs(metadata.mixed_coverage_note);
    itemMetadata(profile.serviceable_markets, metadata.serviceable_markets);
    itemMetadata(profile.serviceability_basis, metadata.serviceability_basis);
    if (
      (profile.overall_scope === null) !== (metadata.overall_scope === null) ||
      (profile.mixed_coverage_note === null) !==
        (metadata.mixed_coverage_note === null)
    )
      issue("SERVICEABILITY_SCALAR_METADATA_MISMATCH");
    for (const meta of [
      metadata.overall_scope,
      metadata.coverage_is_heterogeneous,
      metadata.mixed_coverage_note,
      ...(metadata.serviceable_markets ?? []),
    ])
      if (meta && meta.authority !== "CREATOR_SHOP_DERIVED")
        issue("SERVICEABILITY_DERIVED_AUTHORITY_REQUIRED");

    const markets = profile.serviceable_markets ?? [];
    const bases = profile.serviceability_basis ?? [];
    for (const market of markets) {
      if (!market.semantic_id.trim()) issue("SERVICEABILITY_MARKET_ID_INVALID");
      const c = market.country_code;
      if (
        (c !== null && !/^[A-Z]{2}$/.test(c)) ||
        (market.radius_km !== null && market.radius_km < 0)
      )
        issue("SERVICEABILITY_GEOGRAPHY_NORMALIZATION_INVALID");
      if (
        (market.scope === "GLOBAL" &&
          [c, market.region, market.locality, market.radius_km].some(
            (value) => value !== null,
          )) ||
        (["COUNTRY", "MULTI_COUNTRY_MEMBER"].includes(market.scope) &&
          (c === null ||
            market.region !== null ||
            market.locality !== null ||
            market.radius_km !== null)) ||
        (market.scope === "REGIONAL" &&
          (c === null || market.region === null || market.locality !== null)) ||
        (market.scope === "LOCAL" && (c === null || market.locality === null))
      )
        issue("SERVICEABILITY_GEOGRAPHY_SHAPE_INVALID");
    }
    const marketIds = new Set(markets.map((market) => market.semantic_id));
    for (const basis of bases) {
      const refs = basis.evidence_refs ?? [];
      const stateRefs = basis.business_state_refs ?? [];
      if (
        !basis.semantic_id.trim() ||
        !unique(refs) ||
        !unique(stateRefs) ||
        !unique(basis.applies_to_market_refs) ||
        !unique(basis.offering_refs) ||
        (!refs.length && !stateRefs.length) ||
        refs.some((ref) => !evidence.has(ref)) ||
        stateRefs.some((ref) => !business.has(ref)) ||
        (basis.applies_to_market_refs ?? []).some((id) => !marketIds.has(id))
      )
        issue("SERVICEABILITY_BASIS_REFERENCE_INVALID");
      const evidenceEntries = refs
        .map((ref) => evidence.get(ref))
        .filter((entry): entry is EvidenceManifestEntry => !!entry);
      const support = evidenceEntries
        .map((entry) => serviceabilityEvidenceSupport(entry))
        .filter((entry): entry is NonNullable<typeof entry> => !!entry);
      const expected =
        basis.basis_type === "SHIPPING_OR_DELIVERY_POLICY"
          ? ["SHIPPING_DELIVERY_GEOGRAPHY"]
          : basis.basis_type === "DIGITAL_SERVICE_AVAILABILITY"
            ? ["DIGITAL_REMOTE_AVAILABILITY"]
            : basis.basis_type === "FIRST_PARTY_SERVICE_AREA_STATEMENT"
              ? [
                  "SERVICE_AREA_STATEMENT",
                  "BOOKING_AVAILABILITY",
                  "TRANSACTION_AVAILABILITY",
                ]
              : [];
      if (
        expected.length &&
        (!support.length ||
          support.some((item) => !expected.includes(item.observation_type)))
      )
        issue("SERVICEABILITY_BASIS_TYPE_SUPPORT_MISMATCH");
      if (basis.basis_type === "CANONICAL_OFFERING_AVAILABILITY")
        issue("SERVICEABILITY_CANONICAL_AVAILABILITY_UNAVAILABLE");
      if (basis.basis_type === "BRAND_CONFIRMED_GEOGRAPHY_INPUT")
        issue("SERVICEABILITY_BRAND_CONFIRMED_INPUT_UNAVAILABLE");
      if (basis.basis_type === "CANONICAL_LOCATION_COVERAGE") {
        const locationRefs = stateRefs
          .map((ref) => business.get(ref))
          .filter((entry) => entry?.semanticId.startsWith("location:"));
        const locationEvidence = evidenceEntries.some((entry) =>
          serviceabilityLocationSupport(entry),
        );
        if (!locationRefs.length || !support.length || !locationEvidence)
          issue("SERVICEABILITY_LOCATION_COVERAGE_NOT_GROUNDED");
      }
      for (const offering of basis.offering_refs ?? []) {
        const identity = [...business.values()].find(
          (entry) => entry.semanticId === `offering:${offering}:identity`,
        );
        if (
          !identity ||
          !support.some((item) => item.offering_ref === offering)
        )
          issue("SERVICEABILITY_OFFERING_REFERENCE_INVALID");
      }
    }
    for (const market of markets) {
      const establishing = bases.filter((basis) =>
        (basis.applies_to_market_refs ?? []).includes(market.semantic_id),
      );
      if (
        !establishing.length ||
        !establishing.some((basis) =>
          (basis.evidence_refs ?? [])
            .map((ref) => evidence.get(ref))
            .map((entry) => entry && serviceabilityEvidenceSupport(entry))
            .some((item) =>
              item?.geography_assertions.some((a) =>
                assertionMatches(market, a),
              ),
            ),
        )
      )
        issue("SERVICEABILITY_MARKET_NOT_GROUNDED");
    }
    const countryMarkets = new Set(
      markets
        .filter((market) =>
          ["COUNTRY", "MULTI_COUNTRY_MEMBER"].includes(market.scope),
        )
        .map((market) => market.country_code),
    );
    if (profile.overall_scope === "MULTI_COUNTRY" && countryMarkets.size < 2)
      issue("SERVICEABILITY_MULTI_COUNTRY_UNSUPPORTED");
    const supportedGlobal = context.evidenceManifest.some((entry) =>
      serviceabilityEvidenceSupport(entry)?.geography_assertions.some(
        (assertion) =>
          assertion.polarity === "SUPPORTED" && assertion.scope === "GLOBAL",
      ),
    );
    const materialRestriction = context.evidenceManifest.some((entry) => {
      const parsed = serviceabilityEvidenceSupport(entry);
      return (
        entry.polarity === "RESTRICTION" ||
        !!entry.conflictGroupRef ||
        parsed?.geography_assertions.some((a) => a.polarity === "EXCLUDED")
      );
    });
    if (
      profile.overall_scope === "GLOBAL" &&
      (!supportedGlobal ||
        materialRestriction ||
        !markets.some((market) => market.scope === "GLOBAL"))
    )
      issue("SERVICEABILITY_GLOBAL_UNSAFE");
    const coverageByCandidate = new Map<string, Set<string>>();
    for (const entry of context.evidenceManifest) {
      const supported = serviceabilityEvidenceSupport(entry);
      const candidate =
        supported?.offering_ref ?? supported?.offering_candidate_ref;
      if (!supported || !candidate) continue;
      const set = coverageByCandidate.get(candidate) ?? new Set<string>();
      supported.geography_assertions
        .filter((a) => a.polarity === "SUPPORTED")
        .forEach((a) =>
          set.add(
            [a.scope, a.country_code, a.region, a.locality, a.radius_km].join(
              ":",
            ),
          ),
        );
      coverageByCandidate.set(candidate, set);
    }
    const coverageSignatures = new Set(
      [...coverageByCandidate.values()].map((set) => [...set].sort().join("|")),
    );
    const explicitHeterogeneous =
      coverageByCandidate.size >= 2 && coverageSignatures.size >= 2;
    if (profile.coverage_is_heterogeneous !== explicitHeterogeneous)
      issue("SERVICEABILITY_HETEROGENEOUS_COVERAGE_UNSUPPORTED");
    if (profile.coverage_is_heterogeneous && !profile.mixed_coverage_note)
      issue("SERVICEABILITY_MIXED_COVERAGE_NOTE_REQUIRED");
    if (
      profile.mixed_coverage_note &&
      /\b(every|all)\s+offerings?\b.*\b(everywhere|all markets?|globally)\b/iu.test(
        profile.mixed_coverage_note,
      )
    )
      issue("SERVICEABILITY_UNIVERSAL_OFFERING_CLAIM");
    return issues;
  }
}

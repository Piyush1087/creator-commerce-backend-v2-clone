import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CoreIdentitySnapshotSchema } from "../surface-scan/stage1a/core-identity.schema";
import {
  BrandStateReadTelemetryService,
  type BrandStateReadTelemetryPort,
} from "./brand-state-read-telemetry.service";
import type {
  BrandStateAuthority,
  BrandStateCandidates,
  BrandStateProvenanceStatus,
  BrandStateRead,
  BrandStateSemantic,
  BrandStateSource,
  CanonicalBrandStateReadRequest,
  CanonicalBrandStateSnapshot,
  CurrencyResolutionStatus,
} from "./brand-state-read.types";

type BrandProfileState = {
  domain: string;
  name: string;
  logoUrl: string | null;
  industry: string;
  subIndustry: string | null;
  countryCode: string | null;
  currencyCode: string;
  igHandle: string | null;
  ytHandle: string | null;
  tiktokHandle: string | null;
};

type LegacyIdentityValues = Partial<
  Record<Exclude<BrandStateSemantic, "industry" | "website_url">, string>
>;

const PROFILE_SELECT = {
  domain: true,
  name: true,
  logoUrl: true,
  industry: true,
  subIndustry: true,
  countryCode: true,
  currencyCode: true,
  igHandle: true,
  ytHandle: true,
  tiktokHandle: true,
} as const;

@Injectable()
export class CanonicalBrandStateService {
  private readonly telemetry: BrandStateReadTelemetryPort;

  constructor(
    private readonly prisma: PrismaService,
    telemetry: BrandStateReadTelemetryService,
  ) {
    this.telemetry = telemetry;
  }

  async readSnapshot(
    request: CanonicalBrandStateReadRequest,
  ): Promise<CanonicalBrandStateSnapshot> {
    if (request.lifecycleMode === "POST_PROFILE" && !request.brandProfileId) {
      throw new BadRequestException(
        "POST_PROFILE canonical Brand-state reads require brandProfileId",
      );
    }

    const [lead, profile] = await Promise.all([
      this.prisma.discoveryLead.findUnique({
        where: { id: request.leadId },
        select: {
          normalizedUrl: true,
          industry: true,
          subIndustry: true,
          temporaryPayload: true,
          brandIntelligenceScan: {
            select: {
              authoritativeIdentity: true,
              stage1aSnapshot: true,
            },
          },
        },
      }),
      request.lifecycleMode === "POST_PROFILE"
        ? this.prisma.brandProfile.findUnique({
            where: { id: request.brandProfileId },
            select: PROFILE_SELECT,
          })
        : Promise.resolve(null),
    ]);

    if (!lead) throw new NotFoundException("Discovery lead not found");
    if (request.lifecycleMode === "POST_PROFILE" && !profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const candidates = request.candidates ?? {};
    const legacy = this.legacyValues(
      lead.brandIntelligenceScan?.authoritativeIdentity,
      lead.brandIntelligenceScan?.stage1aSnapshot,
      lead.temporaryPayload,
    );
    const confirmedIndustry =
      value(candidates.confirmedIndustry) ??
      this.confirmedIndustry(lead.temporaryPayload);
    const industryCrossCheck = confirmedIndustry
      ? (value(lead.industry) ?? confirmedIndustry)
      : null;
    const provisionalSubIndustry =
      value(candidates.provisionalSubIndustry) ?? value(lead.subIndustry);

    const snapshot =
      request.lifecycleMode === "PRE_PROFILE"
        ? this.preProfile({
            normalizedUrl: lead.normalizedUrl,
            confirmedIndustry,
            provisionalSubIndustry,
            candidates,
            legacy,
          })
        : this.postProfile({
            normalizedUrl: lead.normalizedUrl,
            industryCrossCheck,
            provisionalSubIndustry,
            profile: profile as BrandProfileState,
            candidates,
            legacy,
          });

    this.recordTelemetry(snapshot, request.correlationId, {
      website_url: Boolean(lead.normalizedUrl),
      brand_name: Boolean(value(candidates.brandName) ?? legacy.brand_name),
      brand_logo: Boolean(value(candidates.brandLogo) ?? legacy.brand_logo),
      industry: Boolean(confirmedIndustry),
      sub_industry: Boolean(provisionalSubIndustry ?? legacy.sub_industry),
      country: Boolean(value(candidates.country)),
      reporting_currency: Boolean(value(candidates.reportingCurrency)),
      instagram_handle: Boolean(
        value(candidates.instagramHandle) ?? legacy.instagram_handle,
      ),
      youtube_handle: Boolean(
        value(candidates.youtubeHandle) ?? legacy.youtube_handle,
      ),
      tiktok_handle: Boolean(
        value(candidates.tiktokHandle) ?? legacy.tiktok_handle,
      ),
    });
    return snapshot;
  }

  private preProfile(args: {
    normalizedUrl: string;
    confirmedIndustry: string | null;
    provisionalSubIndustry: string | null;
    candidates: BrandStateCandidates;
    legacy: LegacyIdentityValues;
  }): CanonicalBrandStateSnapshot {
    return {
      lifecycle_mode: "PRE_PROFILE",
      website_url: selected(
        "website_url",
        args.normalizedUrl,
        "DISCOVERY_LEAD",
        "APPLICATION_CANONICAL",
      ),
      brand_name: observedOrLegacy(
        "brand_name",
        args.candidates.brandName,
        args.legacy.brand_name,
      ),
      brand_logo: observedOrLegacy(
        "brand_logo",
        args.candidates.brandLogo,
        args.legacy.brand_logo,
      ),
      industry: args.confirmedIndustry
        ? selected(
            "industry",
            args.confirmedIndustry,
            "GATEKEEPER_CONFIRMED",
            "GATEKEEPER_CONFIRMED",
          )
        : empty("industry"),
      sub_industry: args.provisionalSubIndustry
        ? selected(
            "sub_industry",
            args.provisionalSubIndustry,
            "GATEKEEPER_PROVISIONAL",
            "PROVISIONAL",
          )
        : legacyRead("sub_industry", args.legacy.sub_industry, "PROVISIONAL"),
      country: value(args.candidates.country)
        ? observed("country", args.candidates.country as string)
        : empty("country"),
      reporting_currency: value(args.candidates.reportingCurrency)
        ? observed(
            "reporting_currency",
            args.candidates.reportingCurrency as string,
            "UNKNOWN_PROVENANCE",
          )
        : empty("reporting_currency", "UNKNOWN_PROVENANCE"),
      instagram_handle: observedOrLegacy(
        "instagram_handle",
        args.candidates.instagramHandle,
        args.legacy.instagram_handle,
      ),
      youtube_handle: observedOrLegacy(
        "youtube_handle",
        args.candidates.youtubeHandle,
        args.legacy.youtube_handle,
      ),
      tiktok_handle: observedOrLegacy(
        "tiktok_handle",
        args.candidates.tiktokHandle,
        args.legacy.tiktok_handle,
      ),
    };
  }

  private postProfile(args: {
    normalizedUrl: string;
    industryCrossCheck: string | null;
    provisionalSubIndustry: string | null;
    profile: BrandProfileState;
    candidates: BrandStateCandidates;
    legacy: LegacyIdentityValues;
  }): CanonicalBrandStateSnapshot {
    const nameCandidate =
      value(args.candidates.brandName) ?? args.legacy.brand_name ?? null;
    const logoCandidate =
      value(args.candidates.brandLogo) ?? args.legacy.brand_logo ?? null;
    const instagramCandidate =
      value(args.candidates.instagramHandle) ??
      args.legacy.instagram_handle ??
      null;
    const youtubeCandidate =
      value(args.candidates.youtubeHandle) ??
      args.legacy.youtube_handle ??
      null;
    const tiktokCandidate =
      value(args.candidates.tiktokHandle) ?? args.legacy.tiktok_handle ?? null;

    return {
      lifecycle_mode: "POST_PROFILE",
      website_url: canonical(
        "website_url",
        args.profile.domain,
        args.normalizedUrl,
        "APPLICATION_CANONICAL",
        comparableWebsite,
      ),
      brand_name: canonical(
        "brand_name",
        args.profile.name,
        nameCandidate,
        "APPLICATION_CANONICAL",
        comparableText,
      ),
      brand_logo: args.profile.logoUrl
        ? canonical(
            "brand_logo",
            args.profile.logoUrl,
            logoCandidate,
            "APPLICATION_CANONICAL",
            comparableUrl,
          )
        : value(args.candidates.brandLogo)
          ? observed("brand_logo", args.candidates.brandLogo as string)
          : legacyRead("brand_logo", args.legacy.brand_logo),
      industry: canonical(
        "industry",
        args.profile.industry,
        args.industryCrossCheck,
        args.industryCrossCheck
          ? "GATEKEEPER_CONFIRMED"
          : "APPLICATION_CANONICAL",
        comparableText,
      ),
      sub_industry: args.profile.subIndustry
        ? canonical(
            "sub_industry",
            args.profile.subIndustry,
            args.provisionalSubIndustry,
            "PROVISIONAL",
            comparableText,
            "UNATTRIBUTED_CANONICAL_FIELD",
          )
        : args.provisionalSubIndustry
          ? selected(
              "sub_industry",
              args.provisionalSubIndustry,
              "GATEKEEPER_PROVISIONAL",
              "PROVISIONAL",
              true,
            )
          : legacyRead("sub_industry", args.legacy.sub_industry, "PROVISIONAL"),
      country: args.profile.countryCode
        ? canonical(
            "country",
            args.profile.countryCode,
            value(args.candidates.country),
            "APPLICATION_CANONICAL",
            comparableText,
          )
        : profileNullable(
            "country",
            args.profile.countryCode,
            value(args.candidates.country),
          ),
      reporting_currency: canonical(
        "reporting_currency",
        args.profile.currencyCode,
        value(args.candidates.reportingCurrency),
        "UNVERIFIED_PROVENANCE",
        comparableText,
        "UNATTRIBUTED_CANONICAL_FIELD",
        "UNKNOWN_PROVENANCE",
      ),
      instagram_handle: args.profile.igHandle
        ? canonical(
            "instagram_handle",
            args.profile.igHandle,
            instagramCandidate,
            "APPLICATION_CANONICAL",
            comparableHandle,
          )
        : value(args.candidates.instagramHandle)
          ? observed(
              "instagram_handle",
              args.candidates.instagramHandle as string,
            )
          : legacyRead("instagram_handle", args.legacy.instagram_handle),
      youtube_handle: args.profile.ytHandle
        ? canonical(
            "youtube_handle",
            args.profile.ytHandle,
            youtubeCandidate,
            "UNVERIFIED_PROVENANCE",
            comparableHandle,
            "UNATTRIBUTED_CANONICAL_FIELD",
          )
        : value(args.candidates.youtubeHandle)
          ? observed("youtube_handle", args.candidates.youtubeHandle as string)
          : legacyRead("youtube_handle", args.legacy.youtube_handle),
      tiktok_handle: args.profile.tiktokHandle
        ? canonical(
            "tiktok_handle",
            args.profile.tiktokHandle,
            tiktokCandidate,
            "UNVERIFIED_PROVENANCE",
            comparableHandle,
            "UNATTRIBUTED_CANONICAL_FIELD",
          )
        : value(args.candidates.tiktokHandle)
          ? observed("tiktok_handle", args.candidates.tiktokHandle as string)
          : legacyRead("tiktok_handle", args.legacy.tiktok_handle),
    };
  }

  private confirmedIndustry(payload: Prisma.JsonValue | null): string | null {
    const root = object(payload);
    const gatekeeper = object(root.gatekeeper);
    const confirmation = object(gatekeeper.confirmation);
    const decision = object(gatekeeper.decision);
    return decision.outcome === "ADMITTED" &&
      confirmation.surface_eligible === true
      ? value(confirmation.confirmed_industry)
      : null;
  }

  private legacyValues(
    authoritative: Prisma.JsonValue | null | undefined,
    snapshot: Prisma.JsonValue | null | undefined,
    payload: Prisma.JsonValue | null,
  ): LegacyIdentityValues {
    const payloadSnapshot = object(payload).stage1a;
    for (const candidate of [authoritative, snapshot, payloadSnapshot]) {
      const parsed = CoreIdentitySnapshotSchema.safeParse(candidate);
      if (!parsed.success) continue;
      return {
        brand_name: value(parsed.data.brand_name.value) ?? undefined,
        brand_logo: value(parsed.data.brand_logo.value) ?? undefined,
        sub_industry: value(parsed.data.sub_industry.value) ?? undefined,
        country: value(parsed.data.country.value) ?? undefined,
        reporting_currency:
          value(parsed.data.reporting_currency.value) ?? undefined,
        instagram_handle:
          value(parsed.data.social_handles.value.instagram) ?? undefined,
        youtube_handle:
          value(parsed.data.social_handles.value.youtube) ?? undefined,
        tiktok_handle:
          value(parsed.data.social_handles.value.tiktok) ?? undefined,
      };
    }
    return {};
  }

  private recordTelemetry(
    snapshot: CanonicalBrandStateSnapshot,
    correlationId: string | undefined,
    candidates: Record<BrandStateSemantic, boolean>,
  ): void {
    for (const semantic of SEMANTICS) {
      const read = snapshot[semantic];
      this.telemetry.record({
        event: "brand_state.read",
        semantic,
        lifecycle_mode: snapshot.lifecycle_mode,
        selected_source: read.source,
        authority: read.authority,
        fallback_used: read.fallback_used,
        conflict_detected: read.conflict_detected,
        candidate_present: candidates[semantic],
        legacy_fallback_used: read.source === "LEGACY_IDENTITY_COMPATIBILITY",
        ...(read.provenance_status
          ? { provenance_status: read.provenance_status }
          : {}),
        ...(read.resolution_status
          ? { resolution_status: read.resolution_status }
          : {}),
        ...(correlationId ? { correlation_id: correlationId } : {}),
      });
    }
  }
}

const SEMANTICS: BrandStateSemantic[] = [
  "website_url",
  "brand_name",
  "brand_logo",
  "industry",
  "sub_industry",
  "country",
  "reporting_currency",
  "instagram_handle",
  "youtube_handle",
  "tiktok_handle",
];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function value(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function empty(
  semantic: BrandStateSemantic,
  resolutionStatus?: CurrencyResolutionStatus,
): BrandStateRead<string> {
  return {
    semantic,
    value: null,
    source: "UNKNOWN",
    authority: "UNKNOWN",
    fallback_used: false,
    conflict_detected: false,
    ...(resolutionStatus ? { resolution_status: resolutionStatus } : {}),
  };
}

function selected(
  semantic: BrandStateSemantic,
  selectedValue: string,
  source: BrandStateSource,
  authority: BrandStateAuthority,
  fallbackUsed = false,
): BrandStateRead<string> {
  return {
    semantic,
    value: selectedValue,
    source,
    authority,
    fallback_used: fallbackUsed,
    conflict_detected: false,
  };
}

function observed(
  semantic: BrandStateSemantic,
  observedValue: string,
  resolutionStatus?: CurrencyResolutionStatus,
): BrandStateRead<string> {
  return {
    ...selected(
      semantic,
      observedValue,
      "PRE_VERIFICATION_CANDIDATE",
      "OBSERVED",
      true,
    ),
    ...(resolutionStatus ? { resolution_status: resolutionStatus } : {}),
  };
}

function legacyRead(
  semantic: BrandStateSemantic,
  legacyValue: string | undefined,
  authority: BrandStateAuthority = "UNKNOWN",
): BrandStateRead<string> {
  return legacyValue
    ? {
        ...selected(
          semantic,
          legacyValue,
          "LEGACY_IDENTITY_COMPATIBILITY",
          authority,
          true,
        ),
        provenance_status: "LEGACY_MIGRATION_POSSIBLE",
      }
    : empty(semantic);
}

function observedOrLegacy(
  semantic: BrandStateSemantic,
  candidate: string | null | undefined,
  legacy: string | undefined,
): BrandStateRead<string> {
  const current = value(candidate);
  return current ? observed(semantic, current) : legacyRead(semantic, legacy);
}

function canonical(
  semantic: BrandStateSemantic,
  canonicalValue: string,
  candidate: string | null | undefined,
  authority: BrandStateAuthority,
  normalize: (value: string) => string,
  provenanceStatus?: BrandStateProvenanceStatus,
  resolutionStatus?: CurrencyResolutionStatus,
): BrandStateRead<string> {
  const alternative = value(candidate);
  const conflict = Boolean(
    alternative && normalize(canonicalValue) !== normalize(alternative),
  );
  return {
    semantic,
    value: canonicalValue,
    source: "BRAND_PROFILE",
    authority,
    fallback_used: false,
    conflict_detected: conflict,
    ...(conflict ? { candidate_value: alternative } : {}),
    ...(provenanceStatus ? { provenance_status: provenanceStatus } : {}),
    ...(resolutionStatus ? { resolution_status: resolutionStatus } : {}),
  };
}

function profileNullable(
  semantic: BrandStateSemantic,
  profileValue: string | null,
  candidate?: string | null,
): BrandStateRead<string> {
  const alternative = value(candidate);
  return {
    semantic,
    value: profileValue,
    source: "BRAND_PROFILE",
    authority: "APPLICATION_CANONICAL",
    fallback_used: false,
    conflict_detected: Boolean(alternative),
    ...(alternative ? { candidate_value: alternative } : {}),
  };
}

function comparableText(input: string): string {
  return input.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function comparableUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLocaleLowerCase();
  } catch {
    return input.trim().replace(/\/$/, "").toLocaleLowerCase();
  }
}

function comparableWebsite(input: string): string {
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return `${url.hostname.replace(/^www\./, "").toLocaleLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return comparableUrl(input)
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");
  }
}

function comparableHandle(input: string): string {
  try {
    const url = new URL(input);
    return url.pathname.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";
  } catch {
    return input.trim().replace(/^@/, "").replace(/\/$/, "").toLowerCase();
  }
}

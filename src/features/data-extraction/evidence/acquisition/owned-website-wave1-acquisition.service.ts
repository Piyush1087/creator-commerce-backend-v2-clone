import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { TextContextBuilderService } from "../../../brand-onboarding/surface-scan/stage1b/text-context-builder.service";
import { ZyteHomepageStrategy } from "../../../brand-onboarding/surface-scan/stage1a/zyte-homepage.strategy";
import {
  asCapabilityExecutionRef,
  asCaptureRef,
  asNormalizedContentRef,
  asProviderExecutionRef,
  asResourceRef,
  type BrandId,
  type CaptureRef,
  type ResourceRef,
} from "../domain/evidence-identities";
import type {
  DataExtractionContentArtifactRecord,
  DataExtractionResourceRecord,
} from "../domain/evidence-records";
import {
  WAVE1_EVIDENCE_CAPABILITIES,
  type CapabilityAvailability,
  type EvidenceAcquisitionQuality,
  type EvidenceCapabilityId,
  type EvidenceCoverage,
  type EvidenceFreshnessIntent,
  type EvidencePageRole,
  type EvidenceRetryability,
} from "../domain/evidence-vocabulary";
import { normalizeOwnedWebsiteUrl } from "../identity/resource-identity";
import {
  DataExtractionPersistenceError,
  persistenceError,
} from "../persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import type {
  DataExtractionCapabilityAcquisitionPortV1,
  DataExtractionCapabilityAcquisitionRequestV1,
  DataExtractionCapabilityAcquisitionResultV1,
} from "../ports/evidence-runtime.ports";

export const OWNED_WEBSITE_WAVE1_BOUNDS = Object.freeze({
  maximumDiscoveredLinksConsidered: 30,
  maximumSelectedSecondaryPages: 3,
  maximumAcquisitionAttemptsPerPage: 2,
  maximumRenderedOrProviderFallbacksPerPage: 1,
  maximumSourceBodyChars: 60_000,
  maximumNormalizedTextChars: 15_000,
  localConcurrency: 1,
});

export type OwnedWebsiteAttemptRole = "PRIMARY" | "FALLBACK";

export interface OwnedWebsiteAcquisitionAttempt {
  readonly providerExecutionRef: string;
  readonly attemptRole: OwnedWebsiteAttemptRole;
}

export interface OwnedWebsitePageAcquisition {
  readonly url: string;
  readonly html?: string;
  readonly cleanText?: string;
  readonly internalLinks: readonly string[];
  readonly quality: EvidenceAcquisitionQuality;
  readonly attempts: readonly OwnedWebsiteAcquisitionAttempt[];
  readonly reasonCodes: readonly string[];
}

export interface OwnedWebsitePageAcquisitionMechanics {
  acquire(url: string): Promise<OwnedWebsitePageAcquisition>;
}

const quality = (
  state: EvidenceAcquisitionQuality["state"],
  detailCodes: readonly string[] = [],
): EvidenceAcquisitionQuality => ({
  state,
  failureCategories:
    state === "UNAVAILABLE" ? ["RESOURCE_UNAVAILABLE"] : [],
  detailCodes,
});

@Injectable()
export class ExistingOwnedWebsiteAcquisitionMechanics
  implements OwnedWebsitePageAcquisitionMechanics
{
  constructor(
    private readonly contextBuilder: TextContextBuilderService,
    private readonly zyte: ZyteHomepageStrategy,
  ) {}

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    const attempts: OwnedWebsiteAcquisitionAttempt[] = [];
    let directBody = "";
    let directFailure = false;

    const primaryRef = `provider-execution:${randomUUID()}`;
    attempts.push({ providerExecutionRef: primaryRef, attemptRole: "PRIMARY" });

    try {
      directBody = await this.directFetch(url);
      if (directBody.trim().length >= 500) {
        return this.toPage(url, directBody, quality("COMPLETE"), attempts, []);
      }
    } catch {
      directFailure = true;
    }

    if (this.zyte.isConfigured()) {
      const fallbackRef = `provider-execution:${randomUUID()}`;
      attempts.push({ providerExecutionRef: fallbackRef, attemptRole: "FALLBACK" });
      try {
        const fallbackBody = await this.zyte.fetchHtml(url);
        if (fallbackBody.trim().length >= 40) {
          return this.toPage(
            url,
            fallbackBody,
            quality("DEGRADED", ["PROVIDER_FALLBACK_USED"]),
            attempts,
            directFailure ? ["DIRECT_FETCH_FAILED"] : [],
          );
        }
      } catch {
        if (directBody.trim().length >= 100) {
          return this.toPage(
            url,
            directBody,
            quality("PARTIAL", ["FALLBACK_FAILED_USING_BOUNDED_DIRECT_BODY"]),
            attempts,
            ["FALLBACK_FAILED"],
          );
        }
        return {
          url,
          internalLinks: [],
          quality: quality("UNAVAILABLE", ["DIRECT_AND_FALLBACK_UNAVAILABLE"]),
          attempts,
          reasonCodes: [
            ...(directFailure ? ["DIRECT_FETCH_FAILED"] : []),
            "FALLBACK_FAILED",
            "NO_USABLE_CONTENT",
          ],
        };
      }
    }

    if (directBody.trim().length >= 100) {
      return this.toPage(
        url,
        directBody,
        quality("PARTIAL", ["DIRECT_BODY_BELOW_FULL_USABILITY_THRESHOLD"]),
        attempts,
        [],
      );
    }

    return {
      url,
      internalLinks: [],
      quality: quality("UNAVAILABLE", ["NO_USABLE_DIRECT_OR_FALLBACK_CONTENT"]),
      attempts,
      reasonCodes: [
        ...(directFailure ? ["DIRECT_FETCH_FAILED"] : []),
        "NO_USABLE_CONTENT",
      ],
    };
  }

  private async directFetch(url: string): Promise<string> {
    assertSafeOwnedWebsiteUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "CreatorShopDataExtraction/1.0" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const requested = new URL(url);
      const finalUrl = new URL(response.url);
      assertSafeOwnedWebsiteUrl(finalUrl.toString());
      if (apex(requested.hostname) !== apex(finalUrl.hostname)) {
        throw new Error("REDIRECT_INTEGRITY_FAILED");
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private toPage(
    url: string,
    html: string,
    acquisitionQuality: EvidenceAcquisitionQuality,
    attempts: readonly OwnedWebsiteAcquisitionAttempt[],
    reasonCodes: readonly string[],
  ): OwnedWebsitePageAcquisition {
    const boundedHtml = html.slice(0, OWNED_WEBSITE_WAVE1_BOUNDS.maximumSourceBodyChars);
    const built = this.contextBuilder.build([{ url, html: boundedHtml }])[0];
    return {
      url,
      html: boundedHtml,
      cleanText: built?.clean_text.slice(
        0,
        OWNED_WEBSITE_WAVE1_BOUNDS.maximumNormalizedTextChars,
      ),
      internalLinks: (built?.internal_links ?? []).slice(
        0,
        OWNED_WEBSITE_WAVE1_BOUNDS.maximumDiscoveredLinksConsidered,
      ),
      quality: acquisitionQuality,
      attempts,
      reasonCodes,
    };
  }
}

@Injectable()
export class OwnedWebsiteWave1AcquisitionService
  implements DataExtractionCapabilityAcquisitionPortV1
{
  constructor(
    private readonly persistence: DataExtractionPersistenceService,
    private readonly mechanics: ExistingOwnedWebsiteAcquisitionMechanics,
  ) {}

  async request(
    request: DataExtractionCapabilityAcquisitionRequestV1,
  ): Promise<DataExtractionCapabilityAcquisitionResultV1> {
    this.assertRequest(request);
    const rootUrl = normalizeOwnedWebsiteUrl(request.ownedWebsiteRoot);
    assertSafeOwnedWebsiteUrl(rootUrl);

    const repositories = this.persistence.repositories();
    const existing = await repositories.capabilityExecutions.findByRequestKey(
      request.brandId,
      request.requestKey,
    );
    if (existing) {
      await this.assertReplayMatches(request, rootUrl, existing.resourceScope);
      if (existing.completedAt) {
        return {
          capabilityExecutionRef: existing.capabilityExecutionRef,
          evidenceRefs: [],
          resourceRefs: existing.resourceScope,
          captureRefs: await this.captureRefsForResources(
            request.brandId,
            existing.resourceScope,
          ),
        };
      }
    }

    const rootIdentity = resourceIdentity(request.brandId, rootUrl);
    const capabilityExecutionRef =
      existing?.capabilityExecutionRef ??
      asCapabilityExecutionRef(`capability-execution:${randomUUID()}`);
    const executionScopeHash = hash(
      `${request.brandId}|${request.capabilityId}|${rootIdentity.canonicalResourceKey}`,
    );

    const execution =
      existing ??
      (await repositories.capabilityExecutions.createOrGet({
        brandId: request.brandId,
        capabilityExecutionRef,
        capabilityId: request.capabilityId,
        normalizationContractVersion: request.normalizationContractVersion,
        resourceScopeHash: executionScopeHash,
        freshnessIntent: request.freshnessIntent,
        sourceRevisionRef: request.sourceRevisionRef,
        requestKey: request.requestKey,
        coverage: "SINGLE_RESOURCE",
      }));

    const acquired: Array<{
      resource: DataExtractionResourceRecord;
      captureRef: CaptureRef;
      acquisitionQuality: EvidenceAcquisitionQuality;
      reasonCodes: readonly string[];
      pageRole: EvidencePageRole;
    }> = [];

    const root = await this.prepareResource(
      request,
      execution.capabilityExecutionRef,
      rootUrl,
      "HOMEPAGE",
    );
    acquired.push(root);

    if (root.acquisitionQuality.state === "UNAVAILABLE") {
      await this.completeExecution(request, execution.capabilityExecutionRef, acquired);
      return {
        capabilityExecutionRef: execution.capabilityExecutionRef,
        evidenceRefs: [],
        resourceRefs: acquired.map((entry) => entry.resource.resourceRef),
        captureRefs: acquired.map((entry) => entry.captureRef),
      };
    }

    const rootArtifacts = await repositories.contentArtifacts.listForCapture(
      request.brandId,
      root.captureRef,
    );
    const rootHtml =
      rootArtifacts.find((artifact) => artifact.artifactKind === "ACQUIRED_SOURCE_BODY")
        ?.inlineContent ?? "";
    const rootContext = rootHtml
      ? new TextContextBuilderService().build([{ url: rootUrl, html: rootHtml }])[0]
      : undefined;
    const selected = selectSecondaryUrls(
      rootContext?.internal_links ?? [],
      request.capabilityId,
    ).slice(0, OWNED_WEBSITE_WAVE1_BOUNDS.maximumSelectedSecondaryPages);

    for (const selectedPage of selected) {
      const prepared = await this.prepareResource(
        request,
        execution.capabilityExecutionRef,
        selectedPage.url,
        selectedPage.pageRole,
      );
      acquired.push(prepared);
    }

    await this.completeExecution(request, execution.capabilityExecutionRef, acquired);
    return {
      capabilityExecutionRef: execution.capabilityExecutionRef,
      evidenceRefs: [],
      resourceRefs: acquired.map((entry) => entry.resource.resourceRef),
      captureRefs: acquired.map((entry) => entry.captureRef),
    };
  }

  private async prepareResource(
    request: DataExtractionCapabilityAcquisitionRequestV1,
    capabilityExecutionRef: ReturnType<typeof asCapabilityExecutionRef>,
    rawUrl: string,
    pageRole: EvidencePageRole,
  ) {
    const canonicalUrl = normalizeOwnedWebsiteUrl(rawUrl);
    assertSameOwnedWebsiteRoot(request.ownedWebsiteRoot, canonicalUrl);
    const identity = resourceIdentity(request.brandId, canonicalUrl);
    const repositories = this.persistence.repositories();
    const resource = await repositories.resources.createOrGet({
      brandId: request.brandId,
      resourceRef: identity.resourceRef,
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      canonicalResourceKey: identity.canonicalResourceKey,
      canonicalUrl,
      pageRole,
    });

    const reusable = await this.reusableCapture(
      request.brandId,
      resource.resourceRef,
      request.freshnessIntent,
    );
    if (reusable) {
      await repositories.capabilityResources.attach(
        request.brandId,
        capabilityExecutionRef,
        resource.resourceRef,
      );
      return {
        resource,
        captureRef: reusable.captureRef,
        acquisitionQuality: reusable.acquisitionQuality,
        reasonCodes: [] as readonly string[],
        pageRole,
      };
    }

    const captureRef = asCaptureRef(`capture:${randomUUID()}`);
    const acquisitionRequestKey = `${request.requestKey}:${hash(resource.canonicalResourceKey).slice(0, 24)}`;
    const startedAt = new Date().toISOString();

    const existingRequestCapture =
      await repositories.captures.findByAcquisitionRequestKey(
        request.brandId,
        acquisitionRequestKey,
      );
    if (existingRequestCapture) {
      await repositories.capabilityResources.attach(
        request.brandId,
        capabilityExecutionRef,
        resource.resourceRef,
      );
      return {
        resource,
        captureRef: existingRequestCapture.captureRef,
        acquisitionQuality: existingRequestCapture.acquisitionQuality,
        reasonCodes: [] as readonly string[],
        pageRole,
      };
    }

    await repositories.captures.create({
      brandId: request.brandId,
      captureRef,
      resourceRef: resource.resourceRef,
      capabilityExecutionRef,
      acquisitionRequestKey,
      startedAt,
      acquisitionQuality: quality("PARTIAL", ["ACQUISITION_RUNNING"]),
    });

    const page = await this.mechanics.acquire(canonicalUrl);
    const terminalAt = new Date().toISOString();

    await this.persistence.withTransaction(async (tx) => {
      await tx.capabilityResources.attach(
        request.brandId,
        capabilityExecutionRef,
        resource.resourceRef,
      );
      for (const attempt of page.attempts) {
        await tx.providerExecutionLinks.attachToCapture(
          request.brandId,
          captureRef,
          asProviderExecutionRef(attempt.providerExecutionRef),
          attempt.attemptRole,
        );
      }
      if (page.html) {
        await tx.contentArtifacts.insert(
          artifact(
            request.brandId,
            captureRef,
            "ACQUIRED_SOURCE_BODY",
            "text/html",
            page.html,
          ),
        );
      }
      if (page.cleanText) {
        await tx.contentArtifacts.insert(
          artifact(
            request.brandId,
            captureRef,
            "NORMALIZED_TEXT",
            "text/plain",
            page.cleanText,
            request.normalizationContractVersion,
          ),
        );
      }
      if (page.quality.state === "UNAVAILABLE") {
        await tx.captures.markFailed(request.brandId, captureRef, {
          capturedAt: terminalAt,
          acquisitionQuality: page.quality,
        });
      } else {
        await tx.captures.markCompleted(request.brandId, captureRef, {
          capturedAt: terminalAt,
          sourceContentHash: page.html ? hash(page.html) : undefined,
          acquisitionQuality: page.quality,
        });
        await tx.freshnessAssessments.record({
          brandId: request.brandId,
          targetType: "CAPTURE",
          targetRef: captureRef,
          state: "CURRENT",
          evaluatedAt: terminalAt,
          basis: "SAME_ACTIVE_RUN",
        });
        await tx.freshnessAssessments.record({
          brandId: request.brandId,
          targetType: "RESOURCE",
          targetRef: resource.resourceRef,
          state: "CURRENT",
          evaluatedAt: terminalAt,
          basis: "SAME_ACTIVE_RUN",
          priorCaptureRef: captureRef,
        });
      }
    });

    return {
      resource,
      captureRef,
      acquisitionQuality: page.quality,
      reasonCodes: page.reasonCodes,
      pageRole,
    };
  }

  private async reusableCapture(
    brandId: BrandId,
    resourceRef: ResourceRef,
    intent: EvidenceFreshnessIntent,
  ) {
    if (intent === "FORCE_RECAPTURE") return null;
    const repositories = this.persistence.repositories();
    const latest = await repositories.captures.findLatestForResource(
      brandId,
      resourceRef,
    );
    if (!latest || !latest.capturedAt || latest.acquisitionQuality.state === "UNAVAILABLE") {
      return null;
    }
    const artifacts = await repositories.contentArtifacts.listForCapture(
      brandId,
      latest.captureRef,
    );
    if (artifacts.length === 0) return null;
    if (intent === "REUSE_ALLOWED") return latest;
    const freshness = await repositories.freshnessAssessments.latestForTarget(
      brandId,
      "RESOURCE",
      resourceRef,
    );
    return freshness?.state === "CURRENT" ? latest : null;
  }

  private async completeExecution(
    request: DataExtractionCapabilityAcquisitionRequestV1,
    capabilityExecutionRef: ReturnType<typeof asCapabilityExecutionRef>,
    acquired: readonly Array<{
      acquisitionQuality: EvidenceAcquisitionQuality;
      reasonCodes: readonly string[];
      pageRole: EvidencePageRole;
    }>,
  ) {
    const root = acquired[0];
    const availableCount = acquired.filter(
      (entry) => entry.acquisitionQuality.state !== "UNAVAILABLE",
    ).length;
    const reasonCodes = [...new Set(acquired.flatMap((entry) => entry.reasonCodes))];
    const aggregate = aggregateQuality(acquired.map((entry) => entry.acquisitionQuality));
    const coverage = coverageForCount(availableCount);
    const availability = capabilityAvailability(
      request.capabilityId,
      acquired,
      availableCount,
    );
    const retryability = retryabilityFor(availability, reasonCodes);

    await this.persistence.repositories().capabilityExecutions.complete(
      request.brandId,
      capabilityExecutionRef,
      {
        availability: root?.acquisitionQuality.state === "UNAVAILABLE" ? "UNAVAILABLE" : availability,
        retryability,
        reasonCodes,
        coverage,
        acquisitionQuality: aggregate,
        completedAt: new Date().toISOString(),
      },
    );
  }

  private async assertReplayMatches(
    request: DataExtractionCapabilityAcquisitionRequestV1,
    rootUrl: string,
    resourceScope: readonly ResourceRef[],
  ) {
    const repositories = this.persistence.repositories();
    const existing = await repositories.capabilityExecutions.findByRequestKey(
      request.brandId,
      request.requestKey,
    );
    if (
      !existing ||
      existing.capabilityId !== request.capabilityId ||
      existing.freshnessIntent !== request.freshnessIntent ||
      existing.normalizationContractVersion !== request.normalizationContractVersion
    ) {
      throw persistenceError("IDEMPOTENCY_CONFLICT");
    }
    if (resourceScope.length > 0) {
      const resources = await Promise.all(
        resourceScope.map((ref) => repositories.resources.findByRef(request.brandId, ref)),
      );
      const rootMatches = resources.some(
        (resource) => resource?.pageRole === "HOMEPAGE" && resource.canonicalUrl === rootUrl,
      );
      if (!rootMatches) throw persistenceError("IDEMPOTENCY_CONFLICT");
    }
  }

  private async captureRefsForResources(
    brandId: BrandId,
    resourceRefs: readonly ResourceRef[],
  ): Promise<readonly CaptureRef[]> {
    const repositories = this.persistence.repositories();
    const captures = await Promise.all(
      resourceRefs.map((resourceRef) =>
        repositories.captures.findLatestForResource(brandId, resourceRef),
      ),
    );
    return captures.filter((value): value is NonNullable<typeof value> => Boolean(value)).map((value) => value.captureRef);
  }

  private assertRequest(request: DataExtractionCapabilityAcquisitionRequestV1) {
    if (!WAVE1_EVIDENCE_CAPABILITIES.includes(request.capabilityId)) {
      throw new DataExtractionPersistenceError(
        "PERSISTENCE_INVARIANT",
        "DATA_EXTRACTION_UNSUPPORTED_WAVE1_CAPABILITY",
      );
    }
    if (!request.requestKey?.trim() || !request.ownedWebsiteRoot?.trim()) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  }
}

function artifact(
  brandId: BrandId,
  captureRef: CaptureRef,
  artifactKind: DataExtractionContentArtifactRecord["artifactKind"],
  mediaType: string,
  inlineContent: string,
  normalizationContractVersion?: string,
): DataExtractionContentArtifactRecord {
  return {
    brandId,
    contentArtifactRef: asNormalizedContentRef(`content:${randomUUID()}`),
    captureRef,
    artifactKind,
    mediaType,
    contentHash: hash(inlineContent),
    byteLength: Buffer.byteLength(inlineContent, "utf8"),
    inlineContent,
    normalizationContractVersion,
    createdAt: new Date().toISOString(),
  };
}

function resourceIdentity(brandId: BrandId, canonicalUrl: string) {
  const canonicalResourceKey = canonicalUrl;
  return {
    canonicalResourceKey,
    resourceRef: asResourceRef(
      `resource:${hash(`${brandId}|OWNED_WEBSITE|${canonicalResourceKey}`).slice(0, 32)}`,
    ),
  };
}

function selectSecondaryUrls(
  links: readonly string[],
  capabilityId: EvidenceCapabilityId,
): Array<{ url: string; pageRole: EvidencePageRole }> {
  const unique = [...new Set(links)].slice(
    0,
    OWNED_WEBSITE_WAVE1_BOUNDS.maximumDiscoveredLinksConsidered,
  );
  const scored = unique
    .map((url) => ({ url, pageRole: inferPageRole(url) }))
    .filter((entry) => entry.pageRole !== "HOMEPAGE")
    .map((entry) => ({ ...entry, score: pageScore(capabilityId, entry.pageRole) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  return scored;
}

function pageScore(capabilityId: EvidenceCapabilityId, role: EvidencePageRole): number {
  const company = new Set<EvidencePageRole>([
    "ABOUT_COMPANY",
    "BRAND_STORY",
    "MISSION_VALUES",
    "COMPANY_OVERVIEW",
  ]);
  const offering = new Set<EvidencePageRole>([
    "PORTFOLIO_OVERVIEW",
    "CATEGORY_OVERVIEW",
    "SERVICE_OVERVIEW",
    "SOLUTIONS_OVERVIEW",
    "PRICING_PLANS",
    "OFFERING_DETAIL",
  ]);
  if (capabilityId === "owned_website.brand_company_context") return company.has(role) ? 3 : 0;
  if (capabilityId === "owned_website.offering_context") return offering.has(role) ? 3 : 0;
  if (capabilityId === "owned_website.brand_messaging") return company.has(role) ? 3 : offering.has(role) ? 1 : 0;
  if (capabilityId === "observed_brand_communication_language_signals") return company.has(role) || offering.has(role) ? 2 : 0;
  return company.has(role) || offering.has(role) ? 1 : 0;
}

export function inferPageRole(value: string): EvidencePageRole {
  let path = "";
  try {
    path = new URL(value).pathname.toLowerCase();
  } catch {
    return "OTHER";
  }
  if (path === "/" || path === "") return "HOMEPAGE";
  if (/mission|values/.test(path)) return "MISSION_VALUES";
  if (/our-story|brand-story|story/.test(path)) return "BRAND_STORY";
  if (/about/.test(path)) return "ABOUT_COMPANY";
  if (/company|who-we-are/.test(path)) return "COMPANY_OVERVIEW";
  if (/pricing|plans?/.test(path)) return "PRICING_PLANS";
  if (/solutions?/.test(path)) return "SOLUTIONS_OVERVIEW";
  if (/services?/.test(path)) return "SERVICE_OVERVIEW";
  if (/collections?|categories?/.test(path)) return "CATEGORY_OVERVIEW";
  if (/products?|shop/.test(path)) return "PORTFOLIO_OVERVIEW";
  return "OTHER";
}

function capabilityAvailability(
  capabilityId: EvidenceCapabilityId,
  acquired: readonly Array<{ pageRole: EvidencePageRole }>,
  availableCount: number,
): CapabilityAvailability {
  if (availableCount === 0) return "UNAVAILABLE";
  if (
    capabilityId === "owned_website.brand_company_context" &&
    !acquired.some((entry) => ["ABOUT_COMPANY", "BRAND_STORY", "MISSION_VALUES", "COMPANY_OVERVIEW"].includes(entry.pageRole))
  ) {
    return "PARTIAL";
  }
  if (
    capabilityId === "owned_website.offering_context" &&
    !acquired.some((entry) => ["PORTFOLIO_OVERVIEW", "CATEGORY_OVERVIEW", "SERVICE_OVERVIEW", "SOLUTIONS_OVERVIEW", "PRICING_PLANS", "OFFERING_DETAIL"].includes(entry.pageRole))
  ) {
    return "PARTIAL";
  }
  return "AVAILABLE";
}

function aggregateQuality(values: readonly EvidenceAcquisitionQuality[]): EvidenceAcquisitionQuality {
  if (values.length === 0) return quality("UNAVAILABLE", ["PAGE_SELECTION_EMPTY"]);
  const available = values.filter((value) => value.state !== "UNAVAILABLE");
  if (available.length === 0) return quality("UNAVAILABLE", ["NO_USABLE_CONTENT"]);
  if (values.some((value) => value.state === "DEGRADED")) return quality("DEGRADED", ["ONE_OR_MORE_PROVIDER_FALLBACKS"]);
  if (values.some((value) => value.state === "PARTIAL") || available.length < values.length) return quality("PARTIAL", ["ONE_OR_MORE_PAGES_PARTIAL"]);
  return quality("COMPLETE");
}

function retryabilityFor(
  availability: CapabilityAvailability,
  reasonCodes: readonly string[],
): EvidenceRetryability {
  if (availability !== "UNAVAILABLE") return "NOT_APPLICABLE";
  if (reasonCodes.includes("ROOT_UNREACHABLE")) return "NON_RETRYABLE";
  return "RETRYABLE";
}

function coverageForCount(count: number): EvidenceCoverage {
  if (count <= 1) return "SINGLE_RESOURCE";
  if (count === 2) return "MULTI_RESOURCE_PARTIAL";
  return "MULTI_RESOURCE_BROAD";
}

function assertSafeOwnedWebsiteUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("UNSAFE_URL_PROTOCOL");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1"
  ) {
    throw new Error("PRIVATE_NETWORK_URL_REJECTED");
  }
}

function assertSameOwnedWebsiteRoot(root: string, candidate: string) {
  const rootUrl = new URL(normalizeOwnedWebsiteUrl(root));
  const candidateUrl = new URL(normalizeOwnedWebsiteUrl(candidate));
  if (apex(rootUrl.hostname) !== apex(candidateUrl.hostname)) {
    throw new Error("CROSS_SITE_RESOURCE_REJECTED");
  }
}

function apex(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

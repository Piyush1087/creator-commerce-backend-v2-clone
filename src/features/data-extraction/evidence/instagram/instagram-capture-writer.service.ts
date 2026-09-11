import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../../prisma/prisma.service";
import { INSTAGRAM_DE_CONTRACT } from "../../../instagram-intelligence/contracts/instagram-intelligence.registry";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asNormalizedContentRef,
  asProviderExecutionRef,
  asSemanticObservationKey,
  type BrandId,
} from "../domain/evidence-identities";
import type {
  AcquisitionQuality,
  CapabilityAvailability,
  EvidenceCoverage,
  EvidenceFreshness,
  EvidenceRepresentativeness,
  EvidenceRetryability,
} from "../domain/evidence-vocabulary";
import { resolveInstagramResourceIdentity } from "../identity/resource-identity";
import { persistenceError } from "../persistence/evidence-persistence.errors";
import { createDataExtractionRepositorySet } from "../persistence/prisma-evidence-repositories";

type InstagramCapabilityId =
  (typeof INSTAGRAM_DE_CONTRACT.capabilities)[number];
type InstagramResourceType =
  (typeof INSTAGRAM_DE_CONTRACT.resourceTypes)[number];

export type InstagramCaptureArtifactInput = Readonly<{
  artifactKey: string;
  payload: Readonly<Record<string, unknown>>;
  mediaType?: string;
}>;

export type InstagramCaptureEvidenceInput = Readonly<{
  evidenceKey: string;
  payload: Readonly<Record<string, unknown>>;
  artifactKey?: string;
  freshness: EvidenceFreshness;
  representativeness: EvidenceRepresentativeness;
  semanticObservationKey?: string;
}>;

export type WriteInstagramCaptureInput = Readonly<{
  brandId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  resourceType: InstagramResourceType;
  mediaId?: string;
  capabilityId: InstagramCapabilityId;
  requestKey: string;
  providerExecutionRef: string;
  normalizationContractVersion: string;
  startedAt: string;
  completedAt: string;
  capturedAt?: string;
  observedAt?: string;
  availability: Extract<
    CapabilityAvailability,
    "AVAILABLE" | "PARTIAL" | "UNAVAILABLE"
  >;
  retryability: EvidenceRetryability;
  reasonCodes: readonly string[];
  coverage: EvidenceCoverage;
  acquisitionQuality: Readonly<{
    state: AcquisitionQuality;
    failureCategories: readonly string[];
    detailCodes: readonly string[];
  }>;
  artifacts: readonly InstagramCaptureArtifactInput[];
  evidence: readonly InstagramCaptureEvidenceInput[];
}>;

export type InstagramCaptureWriteResult = Readonly<{
  resourceRef: string;
  captureRef: string;
  capabilityExecutionRef: string;
  artifactRefs: readonly string[];
  evidenceRefs: readonly string[];
  reused: boolean;
}>;

type LockedInstagramIntegration = Readonly<{
  integrationId: string;
  brandId: string;
  providerAccountId: string | null;
  authorizationGeneration: number;
  status: string;
  isActive: boolean;
}>;

const MAX_STRUCTURED_ARTIFACT_BYTES = 65_536;
const forbiddenKey =
  /(?:access|refresh)?token|secret|credential|signed.*url|ephemeral.*url|media.*url|raw(?:image|video|frame)|binary/i;
const forbiddenString =
  /(?:x-amz-(?:signature|credential)|[?&](?:access_token|signature|token)=|(?:cdninstagram|fbcdn)\.)/i;

@Injectable()
export class InstagramCaptureWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    input: WriteInstagramCaptureInput,
  ): Promise<InstagramCaptureWriteResult> {
    validateInput(input);
    const brandId = asBrandId(input.brandId);
    const identity = resolveInstagramResourceIdentity(input);
    const identityKey = [
      input.providerAccountId,
      input.authorizationGeneration,
      input.capabilityId,
      input.requestKey,
    ].join(":");
    const capabilityExecutionRef = asCapabilityExecutionRef(
      `capability-execution:instagram:${digest(identityKey)}`,
    );
    const captureRef = asCaptureRef(`capture:instagram:${digest(identityKey)}`);
    const requestKey = `instagram:${digest(identityKey)}`;
    const artifactRefs = input.artifacts.map((artifact) =>
      asNormalizedContentRef(
        `content:instagram:${digest(`${identityKey}:artifact:${artifact.artifactKey}`)}`,
      ),
    );
    const evidenceRefs = input.evidence.map((evidence) =>
      asEvidenceRef(
        `evidence:instagram:${digest(`${identityKey}:evidence:${evidence.evidenceKey}`)}`,
      ),
    );

    return this.prisma.$transaction(async (tx) => {
      const integrations = await tx.$queryRaw<LockedInstagramIntegration[]>(
        Prisma.sql`
          SELECT
            "integration_id" AS "integrationId",
            "brand_id" AS "brandId",
            "provider_account_id" AS "providerAccountId",
            "authorization_generation" AS "authorizationGeneration",
            "status"::text AS "status",
            "is_active" AS "isActive"
          FROM "brand_integrations"
          WHERE "brand_id" = ${brandId}
            AND "provider" = 'INSTAGRAM'::"BrandIntegrationProvider"
          FOR UPDATE
        `,
      );
      const integration = integrations[0];
      if (
        integrations.length !== 1 ||
        !integration?.isActive ||
        !["CONNECTED", "PARTIALLY_CONNECTED"].includes(integration.status) ||
        !integration.providerAccountId
      ) {
        throw persistenceError("INSTAGRAM_INTEGRATION_NOT_READY");
      }
      if (integration.providerAccountId !== input.providerAccountId) {
        throw persistenceError("PROVIDER_ACCOUNT_MISMATCH");
      }
      if (
        integration.authorizationGeneration !== input.authorizationGeneration
      ) {
        throw persistenceError("STALE_AUTHORIZATION_GENERATION");
      }

      const repositories = createDataExtractionRepositorySet(tx);
      const resource = await repositories.resources.createOrGet({
        brandId,
        resourceRef: identity.resourceRef,
        sourceClass: INSTAGRAM_DE_CONTRACT.sourceClass as never,
        resourceType: identity.resourceType as never,
        providerAccountId: identity.providerAccountId,
        canonicalResourceKey: identity.canonicalResourceKey,
        canonicalUrl: identity.canonicalUrl,
      });
      const claimed =
        await repositories.capabilityExecutions.createOrGetClaimed({
          brandId,
          capabilityExecutionRef,
          capabilityId: input.capabilityId as never,
          providerIntegrationId: integration.integrationId,
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
          normalizationContractVersion: input.normalizationContractVersion,
          resourceScopeHash: digest(resource.resourceRef),
          freshnessIntent: "FORCE_RECAPTURE",
          requestKey,
          coverage: input.coverage,
        });
      await repositories.capabilityResources.attach(
        brandId,
        capabilityExecutionRef,
        resource.resourceRef,
      );
      await repositories.captures.create({
        brandId,
        captureRef,
        resourceRef: resource.resourceRef,
        capabilityExecutionRef,
        providerIntegrationId: integration.integrationId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
        acquisitionRequestKey: requestKey,
        startedAt: input.startedAt,
        acquisitionQuality: input.acquisitionQuality,
      });
      const providerExecutionRef = asProviderExecutionRef(
        input.providerExecutionRef,
      );
      await repositories.providerExecutionLinks.attachToCapture(
        brandId,
        captureRef,
        providerExecutionRef,
        "INSTAGRAM_CAPTURE",
      );
      await repositories.providerExecutionLinks.attachToCapabilityExecution(
        brandId,
        capabilityExecutionRef,
        providerExecutionRef,
        "INSTAGRAM_CAPABILITY",
      );

      for (const [index, artifact] of input.artifacts.entries()) {
        const content = canonicalJson(artifact.payload);
        await repositories.contentArtifacts.insert({
          brandId,
          contentArtifactRef: artifactRefs[index],
          captureRef,
          artifactKind: "STRUCTURED_SOURCE_FRAGMENT",
          mediaType: artifact.mediaType ?? "application/json",
          contentHash: digest(content),
          byteLength: Buffer.byteLength(content),
          inlineContent: content,
          normalizationContractVersion: input.normalizationContractVersion,
          createdAt: input.completedAt,
        });
      }

      if (input.availability === "UNAVAILABLE") {
        await repositories.captures.markFailed(brandId, captureRef, {
          acquisitionQuality: input.acquisitionQuality,
        });
      } else {
        await repositories.captures.markCompleted(brandId, captureRef, {
          capturedAt: input.capturedAt!,
          ...(input.observedAt ? { observedAt: input.observedAt } : {}),
          acquisitionQuality: input.acquisitionQuality,
        });
      }

      for (const [index, evidence] of input.evidence.entries()) {
        const artifactIndex = evidence.artifactKey
          ? input.artifacts.findIndex(
              (artifact) => artifact.artifactKey === evidence.artifactKey,
            )
          : -1;
        if (evidence.artifactKey && artifactIndex < 0) {
          throw persistenceError("PERSISTENCE_INVARIANT");
        }
        const payload = canonicalJson(evidence.payload);
        const evidenceRef = evidenceRefs[index];
        const semanticObservationKey = evidence.semanticObservationKey
          ? asSemanticObservationKey(evidence.semanticObservationKey)
          : undefined;
        await repositories.evidenceItems.insertOrGetExact({
          brandId,
          evidenceRef,
          capabilityId: input.capabilityId as never,
          normalizationContractVersion: input.normalizationContractVersion,
          resourceRef: resource.resourceRef,
          captureRef,
          sourceClass: INSTAGRAM_DE_CONTRACT.sourceClass as never,
          resourceType: identity.resourceType as never,
          capturedAt: input.capturedAt!,
          freshnessAtEmission: {
            state: evidence.freshness,
            basis: `INSTAGRAM_CAPTURE_${evidence.freshness}`,
            evaluatedAt: input.completedAt,
          },
          representativeness: evidence.representativeness,
          coverageSnapshot: input.coverage,
          qualitySnapshot: input.acquisitionQuality,
          provenance: {
            acquisitionOrNormalizationRunRef: capabilityExecutionRef,
            captureMethodClass: "PROVIDER_MEDIATED_FETCH",
            normalizationContractVersion: input.normalizationContractVersion,
            parentEvidenceRefs: [],
            parentCaptureRefs: [],
            providerExecutionRef,
          },
          deduplication: {
            itemFingerprint: digest(
              `${identityKey}:${evidence.evidenceKey}:${payload}`,
            ),
            repetitionCount: 1,
            supportingResourceRefs: [resource.resourceRef],
          },
          ...(artifactIndex >= 0
            ? { normalizedContentRef: artifactRefs[artifactIndex] }
            : {}),
          boundedNormalizedPayload: evidence.payload,
          contentHash: digest(payload),
          ...(semanticObservationKey ? { semanticObservationKey } : {}),
          relationshipRefs: [],
        });
        await repositories.capabilityEvidence.attach(
          brandId,
          capabilityExecutionRef,
          evidenceRef,
        );
        if (semanticObservationKey) {
          await repositories.semanticObservations.createOrGet(
            brandId,
            semanticObservationKey,
            input.capabilityId as never,
          );
          await repositories.semanticObservations.attachSupport(
            brandId,
            semanticObservationKey,
            evidenceRef,
          );
        }
      }

      await repositories.capabilityExecutions.complete(
        brandId,
        capabilityExecutionRef,
        {
          availability: input.availability,
          retryability: input.retryability,
          reasonCodes: input.reasonCodes,
          coverage: input.coverage,
          acquisitionQuality: input.acquisitionQuality,
          completedAt: input.completedAt,
        },
      );

      return {
        resourceRef: resource.resourceRef,
        captureRef,
        capabilityExecutionRef,
        artifactRefs,
        evidenceRefs,
        reused: !claimed.created,
      };
    });
  }
}

function validateInput(input: WriteInstagramCaptureInput): void {
  if (
    !input.brandId ||
    !input.providerAccountId ||
    !Number.isSafeInteger(input.authorizationGeneration) ||
    input.authorizationGeneration < 0 ||
    !input.requestKey.trim() ||
    !input.providerExecutionRef.trim() ||
    !(INSTAGRAM_DE_CONTRACT.capabilities as readonly string[]).includes(
      input.capabilityId,
    )
  ) {
    throw persistenceError("PERSISTENCE_INVARIANT");
  }
  if (input.availability === "UNAVAILABLE") {
    if (
      input.artifacts.length ||
      input.evidence.length ||
      input.capturedAt ||
      input.observedAt ||
      input.acquisitionQuality.state !== "UNAVAILABLE" ||
      input.reasonCodes.length === 0
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  } else if (!input.capturedAt) {
    throw persistenceError("PERSISTENCE_INVARIANT");
  }
  const artifactKeys = new Set<string>();
  for (const artifact of input.artifacts) {
    if (
      !artifact.artifactKey.trim() ||
      artifactKeys.has(artifact.artifactKey)
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
    artifactKeys.add(artifact.artifactKey);
    assertSafePayload(artifact.payload);
  }
  const evidenceKeys = new Set<string>();
  for (const evidence of input.evidence) {
    if (
      !evidence.evidenceKey.trim() ||
      evidenceKeys.has(evidence.evidenceKey)
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
    evidenceKeys.add(evidence.evidenceKey);
    if (
      evidence.artifactKey !== undefined &&
      (!evidence.artifactKey.trim() || !artifactKeys.has(evidence.artifactKey))
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
    assertSafePayload(evidence.payload);
  }
}

function assertSafePayload(value: Readonly<Record<string, unknown>>): void {
  const serialized = canonicalJson(value);
  if (Buffer.byteLength(serialized) > MAX_STRUCTURED_ARTIFACT_BYTES) {
    throw persistenceError("UNSAFE_INSTAGRAM_PAYLOAD");
  }
  const visit = (candidate: unknown): void => {
    if (typeof candidate === "string" && forbiddenString.test(candidate)) {
      throw persistenceError("UNSAFE_INSTAGRAM_PAYLOAD");
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (candidate && typeof candidate === "object") {
      for (const [key, nested] of Object.entries(candidate)) {
        if (forbiddenKey.test(key)) {
          throw persistenceError("UNSAFE_INSTAGRAM_PAYLOAD");
        }
        visit(nested);
      }
    }
  };
  visit(value);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandPreviewRuntimeState,
  IndustryVertical,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { GatekeeperPersistenceService } from "../gatekeeper/gatekeeper-persistence.service";
import { SUPPORTED_MVP_INDUSTRIES } from "../gatekeeper/gatekeeper-v1.types";

const SUPPORTED = new Set<IndustryVertical>(SUPPORTED_MVP_INDUSTRIES);

@Injectable()
export class BrandPreviewRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatekeeper: GatekeeperPersistenceService,
  ) {}

  async startOrResume(leadId: string) {
    const result = await this.gatekeeper.getGatekeeperResult(leadId);
    const industry = result.confirmation.confirmed_industry;
    if (
      result.decision.outcome !== "ADMITTED" ||
      !result.confirmation.surface_eligible ||
      !industry ||
      !SUPPORTED.has(industry)
    ) {
      throw new BadRequestException(
        "Brand Preview requires an ADMITTED Gatekeeper result and confirmed supported Industry",
      );
    }
    try {
      await this.prisma.brandPreviewRun.create({
        data: {
          discoveryLeadId: leadId,
          state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
          phase: "UNDERSTANDING_BRAND",
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
    return this.get(leadId);
  }

  async retry(leadId: string) {
    const updated = await this.prisma.brandPreviewRun.updateMany({
      where: {
        discoveryLeadId: leadId,
        state: BrandPreviewRuntimeState.PREVIEW_FAILED_RECOVERABLE,
        retryAllowed: true,
      },
      data: {
        state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
        phase: "UNDERSTANDING_BRAND",
        completeness: null,
        retryAllowed: false,
        errorCode: null,
        enrichmentAttempted: false,
        leaseToken: null,
        leaseExpiresAt: null,
        previewOutputSnapshot: Prisma.DbNull,
        processorMetadata: Prisma.DbNull,
        completedAt: null,
        startedAt: new Date(),
        attempt: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.brandPreviewRun.findUnique({
        where: { discoveryLeadId: leadId },
      });
      if (!existing) throw new NotFoundException("Brand Preview run not found");
      if (existing.state === BrandPreviewRuntimeState.ANALYSIS_ACTIVE) {
        return this.get(leadId);
      }
      throw new BadRequestException("Brand Preview retry is not allowed");
    }
    return this.get(leadId);
  }

  async getOrStartEligible(leadId: string) {
    const existing = await this.prisma.brandPreviewRun.findUnique({
      where: { discoveryLeadId: leadId },
      select: { id: true },
    });
    return existing ? this.get(leadId) : this.startOrResume(leadId);
  }

  async get(leadId: string) {
    const run = await this.prisma.brandPreviewRun.findUnique({
      where: { discoveryLeadId: leadId },
    });
    if (!run) throw new NotFoundException("Brand Preview run not found");
    const payload =
      run.state === BrandPreviewRuntimeState.PREVIEW_READY
        ? publicPreview(run.previewOutputSnapshot)
        : undefined;
    return {
      runId: run.id,
      state: run.state,
      ...(run.phase ? { phase: run.phase } : {}),
      ...(run.completeness ? { completeness: run.completeness } : {}),
      retryAllowed: run.retryAllowed,
      ...(payload ? { preview: payload } : {}),
      verificationContext: {
        brandProfileId: run.brandProfileId,
      },
    };
  }
}

function navigableWebsiteUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value;
  const raw = value.trim();
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).toString();
  } catch {
    return raw;
  }
}

function publicIdentity(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const identity = value as Record<string, unknown>;
  const website = identity.website_url ?? identity.websiteUrl;
  return {
    ...identity,
    website_url: navigableWebsiteUrl(website),
  };
}

function publicPreview(value: Prisma.JsonValue | null): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const raw = value as Record<string, unknown>;
  const strip = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const {
      internal_grounding_refs: _refs,
      internal_confidence: _confidence,
      provider: _provider,
      model: _model,
      chain_of_thought: _reasoning,
      ...publicItem
    } = item as Record<string, unknown>;
    return publicItem;
  };
  return {
    identity: publicIdentity(raw.identity),
    brand_descriptor: raw.brand_descriptor,
    brand_understanding_narrative: raw.brand_understanding_narrative,
    audience_groups: Array.isArray(raw.audience_groups)
      ? raw.audience_groups.map(strip)
      : [],
    creator_marketing_opportunities: Array.isArray(
      raw.creator_marketing_opportunities,
    )
      ? raw.creator_marketing_opportunities.map(strip)
      : [],
    creator_archetype_recommendations: Array.isArray(
      raw.creator_archetype_recommendations,
    )
      ? raw.creator_archetype_recommendations.map(strip)
      : [],
  };
}

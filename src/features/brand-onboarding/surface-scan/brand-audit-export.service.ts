import { Injectable, NotFoundException } from "@nestjs/common";
import type { BrandIntelligenceStage } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  CoreIdentitySnapshotSchema,
  type CoreIdentitySnapshot,
} from "./stage1a/core-identity.schema";
import {
  BrandDnaSnapshotSchema,
  type BrandDnaSnapshot,
} from "./stage2/brand-dna.schema";
import type { RuntimeContextPackage } from "./stage1b/runtime-context.types";

export type AuditFieldRow = {
  field: string;
  value: string;
  source: string;
  sourceDetail: string;
  confidence: number | null;
  edited: boolean;
  evidence: string;
};

export type BrandAuditExportResponse = {
  leadId: string;
  brandProfileId: string | null;
  domain: string | null;
  generatedAt: string;
  currentStage: BrandIntelligenceStage | null;
  pipelineError: string | null;
  surfaceScan: {
    completedAt: string | null;
    scanId: string;
    discoveredLinksCount: number;
    discoveredLinksSample: string[];
    fields: AuditFieldRow[];
    confirmedIdentity: AuditFieldRow[] | null;
  };
  phaseB: {
    stage1b: {
      status: string | null;
      plannedUrls: string[];
      pageCount: number | null;
      completedAt: string | null;
    };
    crawledPages: Array<{
      url: string;
      pageType: string;
      title: string | null;
      textChars: number;
    }>;
    websiteAssets: {
      colors: string[];
      fonts: string[];
      logo: string | null;
    };
    websiteSummary: {
      homepageExcerpt: string;
      aboutExcerpt: string | null;
      navLabels: string[];
    };
    brandDna: {
      fields: AuditFieldRow[];
      personas: Array<{
        index: number;
        fields: AuditFieldRow[];
      }>;
    } | null;
  };
};

type FieldEvidence = {
  page_url: string;
  page_type: string;
  excerpt: string;
};

type UniversalWrapper = {
  value: unknown;
  confidence: number;
  evidence: FieldEvidence[];
  source: string;
  edited: boolean;
};

/**
 * Product-team audit payload for Brand DNA page PDF export.
 */
@Injectable()
export class BrandAuditExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getByLeadId(leadId: string): Promise<BrandAuditExportResponse> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        normalizedUrl: true,
        temporaryPayload: true,
      },
    });
    if (!lead) {
      throw new NotFoundException("Discovery lead not found");
    }

    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: leadId },
    });

    let domain: string | null = null;
    try {
      domain = new URL(lead.normalizedUrl).hostname.replace(/^www\./, "");
    } catch {
      domain = null;
    }

    const stage1a = this.parseStage1a(scan?.stage1aSnapshot, lead.temporaryPayload);
    const confirmed = this.parseCoreIdentity(scan?.authoritativeIdentity);
    const runtime = this.parseRuntimeContext(scan?.runtimeContext);
    const brandDna = this.parseBrandDna(scan?.brandDnaVerifiedSnapshot);
    const stage1bMeta = this.parseStage1bMeta(lead.temporaryPayload);

    return {
      leadId,
      brandProfileId: scan?.brandProfileId ?? null,
      domain,
      generatedAt: new Date().toISOString(),
      currentStage: scan?.currentStage ?? null,
      pipelineError: scan?.errorLogs ?? null,
      surfaceScan: {
        completedAt: scan?.updatedAt?.toISOString() ?? null,
        scanId: stage1a?.scan_id ?? "—",
        discoveredLinksCount: stage1a?.discovered_root_links.length ?? 0,
        discoveredLinksSample: (stage1a?.discovered_root_links ?? []).slice(0, 12),
        fields: stage1a ? flattenCoreIdentity(stage1a) : [],
        confirmedIdentity: confirmed ? flattenCoreIdentity(confirmed) : null,
      },
      phaseB: {
        stage1b: stage1bMeta,
        crawledPages: (runtime?.pages ?? []).map((page) => ({
          url: page.url,
          pageType: page.page_type,
          title: page.title ?? null,
          textChars: page.clean_text.length,
        })),
        websiteAssets: {
          colors: runtime?.website_assets.colors ?? [],
          fonts: runtime?.website_assets.fonts ?? [],
          logo: runtime?.website_assets.logo ?? null,
        },
        websiteSummary: {
          homepageExcerpt: runtime?.website_summary.homepage_excerpt ?? "",
          aboutExcerpt: runtime?.website_summary.about_excerpt ?? null,
          navLabels: runtime?.website_summary.nav_labels ?? [],
        },
        brandDna: brandDna ? flattenBrandDna(brandDna) : null,
      },
    };
  }

  private parseStage1a(
    stage1aSnapshot: unknown,
    temporaryPayload: unknown,
  ): CoreIdentitySnapshot | null {
    if (stage1aSnapshot) {
      const parsed = CoreIdentitySnapshotSchema.safeParse(stage1aSnapshot);
      if (parsed.success) {
        return parsed.data;
      }
    }
    const payload =
      temporaryPayload &&
      typeof temporaryPayload === "object" &&
      !Array.isArray(temporaryPayload)
        ? (temporaryPayload as Record<string, unknown>)
        : null;
    const parsed = CoreIdentitySnapshotSchema.safeParse(payload?.stage1a);
    return parsed.success ? parsed.data : null;
  }

  private parseCoreIdentity(raw: unknown): CoreIdentitySnapshot | null {
    if (!raw) {
      return null;
    }
    const parsed = CoreIdentitySnapshotSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private parseRuntimeContext(raw: unknown): RuntimeContextPackage | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    return raw as RuntimeContextPackage;
  }

  private parseBrandDna(raw: unknown): BrandDnaSnapshot | null {
    if (!raw) {
      return null;
    }
    const parsed = BrandDnaSnapshotSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private parseStage1bMeta(temporaryPayload: unknown): BrandAuditExportResponse["phaseB"]["stage1b"] {
    const payload =
      temporaryPayload &&
      typeof temporaryPayload === "object" &&
      !Array.isArray(temporaryPayload)
        ? (temporaryPayload as Record<string, unknown>)
        : null;
    const stage1b =
      payload?.stage1b &&
      typeof payload.stage1b === "object" &&
      !Array.isArray(payload.stage1b)
        ? (payload.stage1b as Record<string, unknown>)
        : null;

    const plannedUrls = Array.isArray(stage1b?.plannedUrls)
      ? stage1b.plannedUrls.filter((u): u is string => typeof u === "string")
      : [];

    return {
      status: typeof stage1b?.status === "string" ? stage1b.status : null,
      plannedUrls,
      pageCount: typeof stage1b?.pageCount === "number" ? stage1b.pageCount : null,
      completedAt:
        typeof stage1b?.completedAt === "string" ? stage1b.completedAt : null,
    };
  }
}

function flattenCoreIdentity(snapshot: CoreIdentitySnapshot): AuditFieldRow[] {
  const rows: AuditFieldRow[] = [
    wrapperRow("Brand name", snapshot.brand_name),
    wrapperRow("Website", snapshot.website_url),
    wrapperRow("Country", snapshot.country),
    wrapperRow("Reporting currency", snapshot.reporting_currency),
    wrapperRow("Industry", snapshot.industry),
    wrapperRow("Sub-industry", snapshot.sub_industry),
    wrapperRow("Tagline", snapshot.tagline),
    wrapperRow("Logo URL", snapshot.brand_logo),
    wrapperRow("Social handles", snapshot.social_handles),
  ];
  return rows;
}

function flattenBrandDna(snapshot: BrandDnaSnapshot): {
  fields: AuditFieldRow[];
  personas: Array<{ index: number; fields: AuditFieldRow[] }>;
} {
  const fields: AuditFieldRow[] = [
    wrapperRow("Industry niche", snapshot.industry_niche),
    wrapperRow("Brand positioning", snapshot.brand_positioning),
    wrapperRow("Brand narrative", snapshot.brand_narrative),
    wrapperRow("Core value proposition", snapshot.core_value_proposition),
    wrapperRow("Key differentiators", snapshot.key_differentiators),
    wrapperRow("Tone of voice", snapshot.tone_of_voice),
    wrapperRow("Visual aesthetic", snapshot.visual_aesthetic),
  ];

  const personas = snapshot.audience_personas.map((persona, index) => ({
    index: index + 1,
    fields: [
      wrapperRow("Name", persona.name),
      wrapperRow("Age range", persona.age_range),
      wrapperRow("Gender", persona.gender),
      wrapperRow("Geography", persona.geography),
      wrapperRow("Affluence", persona.affluence_score),
      wrapperRow("Traits", persona.traits),
    ],
  }));

  return { fields, personas };
}

function wrapperRow(label: string, wrapper: UniversalWrapper): AuditFieldRow {
  return {
    field: label,
    value: formatAuditValue(wrapper.value),
    source: wrapper.source,
    sourceDetail: sourceDetailLabel(wrapper.source),
    confidence: wrapper.confidence > 0 ? wrapper.confidence : null,
    edited: wrapper.edited,
    evidence: formatAuditEvidence(wrapper.evidence),
  };
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "—";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(", ") : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).trim()}`);
    return entries.length > 0 ? entries.join("; ") : "—";
  }
  return String(value);
}

function formatAuditEvidence(evidence: FieldEvidence[]): string {
  if (!evidence.length) {
    return "—";
  }
  return evidence
    .slice(0, 2)
    .map((item) => {
      const excerpt = item.excerpt.trim();
      const clipped =
        excerpt.length > 140 ? `${excerpt.slice(0, 140)}…` : excerpt;
      return `[${item.page_type}] ${item.page_url}: ${clipped}`;
    })
    .join(" | ");
}

function sourceDetailLabel(source: string): string {
  switch (source) {
    case "CRAWLER":
      return "Website crawl (Zyte / Playwright)";
    case "AI":
      return "Gemini";
    case "USER":
      return "User confirmed";
    case "SYSTEM":
      return "System / derived";
    default:
      return source;
  }
}

import { Injectable } from "@nestjs/common";
import { PerformanceColor, ScanStatus } from "@prisma/client";
import { randomUUID } from "crypto";

import { BrandCentreDnaService } from "../../brand-centre/services/brand-centre-dna.service";
import { BrandCentreIntelligenceService } from "../../brand-centre/services/brand-centre-intelligence.service";
import type { MetricItem } from "../schemas/copilot-payload.schema";
import type { DataTableData } from "../schemas/copilot-payload.schema";

export type BrandCentreReadContext = {
  brandProfileId: string;
  dna: {
    brandName: string;
    scanStatus: ScanStatus;
    tagline: string | null;
    toneSummary: string | null;
    audienceSummary: string | null;
    personaCount: number;
    offeringCount: number;
    competitorCount: number;
    verifiedFieldEstimate: string;
    doNotSayList: string[];
    visualIdentity: {
      palette: string[];
      fonts: string[];
      aesthetics: string[];
    };
    coreDnaBlocks: Array<{ label: string; complete: boolean }>;
  };
  intelligence: {
    available: boolean;
    unavailableReason?: string;
    activeLeakCount: number;
    baselineHealth: unknown;
    shareOfVoice: unknown;
    topLeaks: Array<{ title: string; bucket: string; priority: string }>;
    leaks: Array<{
      title: string;
      bucket: string;
      priority: string;
      plannerStatus: string;
    }>;
  };
  personas: Array<{
    name: string;
    ageRange: string;
    interests: string;
    psychographics: string;
  }>;
};

export type BrandCentreStatFactSheet = {
  brandName: string;
  scanStatus: string;
  coreDnaBlocks: string;
  coreDnaBlockLabels: string[];
  competitorCount: number;
  personaCount: number;
  offeringCount: number;
  activeLeakCount: number;
  intelligenceAvailable: boolean;
  brandSafetyScore: number | null;
  shareOfVoicePercent: number | null;
  topLeakTitles: string[];
  visualIdentityPalette: string[];
  visualIdentityFonts: string[];
  visualIdentityAesthetics: string[];
};

@Injectable()
export class BrandCentreCoPilotToolsService {
  constructor(
    private readonly dna: BrandCentreDnaService,
    private readonly intelligence: BrandCentreIntelligenceService,
  ) {}

  async getBrandCentreReadContext(
    brandProfileId: string,
  ): Promise<BrandCentreReadContext> {
    const aggregate = await this.dna.getDnaAggregate(brandProfileId);
    const personas = aggregate.personas as Array<{
      personaName: string;
      demographicsJson?: Record<string, unknown>;
      psychographicsText?: string | null;
    }>;
    const offeringsPrimary = aggregate.offeringsPrimary as unknown[];
    const competitors = aggregate.competitors as unknown[];

    const toneParts = aggregate.narrative.toneOfVoice as string[] | undefined;
    const toneSummary =
      toneParts && toneParts.length > 0 ? toneParts.join(", ") : null;

    const audienceSummary =
      personas.length > 0 ? `${personas.length} persona(s) on file` : null;

    const narrativeDoNotSay = (aggregate.narrative as { doNotSayList?: string[] })
      .doNotSayList;

    const dnaContext = {
      brandName: aggregate.profile.brandName,
      scanStatus: aggregate.profile.scanStatus,
      tagline:
        (typeof aggregate.narrative.tagline === "string"
          ? aggregate.narrative.tagline
          : null) ?? aggregate.profile.brandName,
      toneSummary,
      audienceSummary,
      personaCount: personas.length,
      offeringCount: offeringsPrimary.length,
      competitorCount: competitors.length,
      verifiedFieldEstimate: this.estimateDnaCompleteness(aggregate),
      doNotSayList: narrativeDoNotSay ?? [],
      visualIdentity: {
        palette: aggregate.identity.palette,
        fonts: aggregate.identity.fonts,
        aesthetics: aggregate.identity.aesthetics,
      },
      coreDnaBlocks: this.buildCoreDnaBlockStatuses(aggregate),
    };

    try {
      const intel = await this.intelligence.getIntelligence(brandProfileId);
      return {
        brandProfileId,
        dna: dnaContext,
        personas: personas.map((persona) => this.mapPersonaRow(persona)),
        intelligence: {
          available: true,
          activeLeakCount: intel.leaks.length,
          baselineHealth: intel.baseline?.baselineHealth ?? null,
          shareOfVoice: intel.baseline?.shareOfVoice ?? null,
          topLeaks: intel.leaks.slice(0, 5).map((leak) => ({
            title: leak.insightTitle,
            bucket: leak.leakBucket,
            priority: leak.priorityRank,
          })),
          leaks: intel.leaks.map((leak) => ({
            title: leak.insightTitle,
            bucket: leak.leakBucket,
            priority: leak.priorityRank,
            plannerStatus: leak.plannerStatus,
          })),
        },
      };
    } catch (err) {
      return {
        brandProfileId,
        dna: dnaContext,
        personas: personas.map((persona) => this.mapPersonaRow(persona)),
        intelligence: {
          available: false,
          unavailableReason:
            err instanceof Error ? err.message : "Intelligence unavailable",
          activeLeakCount: 0,
          baselineHealth: null,
          shareOfVoice: null,
          topLeaks: [],
          leaks: [],
        },
      };
    }
  }

  private mapPersonaRow(persona: {
    personaName: string;
    demographicsJson?: Record<string, unknown>;
    psychographicsText?: string | null;
  }) {
    const demographics = persona.demographicsJson ?? {};
    const ageMin =
      typeof demographics.ageMin === "number" ? demographics.ageMin : null;
    const ageMax =
      typeof demographics.ageMax === "number" ? demographics.ageMax : null;
    const ageRange =
      ageMin != null && ageMax != null ? `${ageMin}–${ageMax}` : "—";
    const interests = Array.isArray(demographics.interests)
      ? demographics.interests.filter((item) => typeof item === "string").join(", ")
      : typeof demographics.interestFocus === "string"
        ? demographics.interestFocus
        : "—";

    return {
      name: persona.personaName,
      ageRange,
      interests: interests || "—",
      psychographics: persona.psychographicsText?.trim() || "—",
    };
  }

  buildStatFactSheet(context: BrandCentreReadContext): BrandCentreStatFactSheet {
    const shareOfVoice = this.readShareOfVoice(context.intelligence.shareOfVoice);
    return {
      brandName: context.dna.brandName,
      scanStatus: context.dna.scanStatus,
      coreDnaBlocks: context.dna.verifiedFieldEstimate,
      coreDnaBlockLabels: context.dna.coreDnaBlocks
        .filter((block) => block.complete)
        .map((block) => block.label),
      competitorCount: context.dna.competitorCount,
      personaCount: context.dna.personaCount,
      offeringCount: context.dna.offeringCount,
      activeLeakCount: context.intelligence.activeLeakCount,
      intelligenceAvailable: context.intelligence.available,
      brandSafetyScore: this.readBrandSafetyScore(
        context.intelligence.baselineHealth,
      ),
      shareOfVoicePercent: shareOfVoice?.ourBrandShare ?? null,
      topLeakTitles: context.intelligence.topLeaks.map((leak) => leak.title),
      visualIdentityPalette: context.dna.visualIdentity.palette,
      visualIdentityFonts: context.dna.visualIdentity.fonts,
      visualIdentityAesthetics: context.dna.visualIdentity.aesthetics,
    };
  }

  buildMetricGridFromContext(context: BrandCentreReadContext): MetricItem[] {
    const brandSafetyScore = this.readBrandSafetyScore(
      context.intelligence.baselineHealth,
    );

    const metrics: MetricItem[] = [
      {
        label: "Profile Scan Status",
        value: context.dna.scanStatus,
        statusColor:
          context.dna.scanStatus === ScanStatus.READY ? "GREEN" : "YELLOW",
      },
      {
        label: "Core DNA Blocks",
        value: context.dna.verifiedFieldEstimate,
        statusColor: "YELLOW",
      },
      {
        label: "Competitors Tracked",
        value: String(context.dna.competitorCount),
        statusColor: context.dna.competitorCount > 0 ? "GREEN" : "NEUTRAL",
      },
    ];

    if (brandSafetyScore !== null) {
      metrics.push({
        label: "Brand Safety Score",
        value: String(brandSafetyScore),
        statusColor:
          brandSafetyScore >= 80
            ? "GREEN"
            : brandSafetyScore >= 60
              ? "YELLOW"
              : "RED",
      });
    }

    if (context.intelligence.available) {
      metrics.push({
        label: "Active Leaks",
        value: String(context.intelligence.activeLeakCount),
        statusColor:
          context.intelligence.activeLeakCount === 0
            ? "GREEN"
            : context.intelligence.activeLeakCount <= 3
              ? "YELLOW"
              : "RED",
      });
    } else {
      metrics.push({
        label: "Intelligence & Gaps",
        value: "Pending deep scan",
        statusColor: "NEUTRAL",
      });
    }

    return metrics;
  }

  buildCompletenessNarrative(context: BrandCentreReadContext): string {
    const { dna, intelligence } = context;
    const gaps: string[] = [];

    if (dna.competitorCount === 0) {
      gaps.push("no competitors tracked in Brand DNA");
    }

    const blocks = dna.verifiedFieldEstimate.match(/^(\d+)\s*\/\s*(\d+)/);
    if (blocks && Number(blocks[1]) < Number(blocks[2])) {
      gaps.push(
        `Brand DNA completeness at ${dna.verifiedFieldEstimate} — some core blocks still need attention`,
      );
    } else {
      gaps.push(`Brand DNA core blocks are complete (${dna.verifiedFieldEstimate})`);
    }

    if (!intelligence.available) {
      gaps.push(
        "Intelligence & Gaps is pending — complete the Brand Centre deep scan to surface flagged items",
      );
    } else if (intelligence.activeLeakCount > 0) {
      gaps.push(
        `${intelligence.activeLeakCount} active intelligence leak${intelligence.activeLeakCount === 1 ? "" : "s"} flagged`,
      );
      if (intelligence.topLeaks.length > 0) {
        gaps.push(
          `Top flagged areas: ${intelligence.topLeaks.map((leak) => leak.title).join("; ")}`,
        );
      }
    } else {
      gaps.push("no active intelligence leaks flagged");
    }

    return `Incomplete or flagged items for ${dna.brandName}: ${gaps.join(". ")}.`;
  }

  buildOverviewNarrative(context: BrandCentreReadContext): string {
    const { dna, intelligence } = context;
    const parts: string[] = [];

    parts.push(
      `${dna.brandName}'s Brand Centre is ready for campaign planning.`,
    );

    const taglinePhrase = dna.tagline
      ? ` featuring the tagline '${dna.tagline}'`
      : "";
    const tonePhrase = dna.toneSummary
      ? ` and a ${dna.toneSummary} tone`
      : "";
    parts.push(
      `Your Brand DNA is fully defined with a '${dna.scanStatus}' scan status${taglinePhrase}${tonePhrase}.`,
    );

    parts.push(
      `You have ${dna.personaCount} audience persona${dna.personaCount === 1 ? "" : "s"} and ${dna.offeringCount} offerings on file, with ${dna.verifiedFieldEstimate} verified.`,
    );

    if (dna.doNotSayList.length > 0) {
      const sample = dna.doNotSayList
        .slice(0, 3)
        .map((word) => `'${word}'`)
        .join(", ");
      parts.push(
        `Your 'Do Not Say' list includes ${sample}${dna.doNotSayList.length > 3 ? ", and more" : ""}.`,
      );
    }

    if (!intelligence.available) {
      parts.push(
        intelligence.unavailableReason ??
          "Intelligence & Gaps data is not available yet — complete the deep scan to populate leak cards.",
      );
      return parts.join(" ");
    }

    if (intelligence.activeLeakCount === 0) {
      parts.push("On the intelligence front, there are no active leaks identified.");
    } else {
      parts.push(
        `On the intelligence front, there are ${intelligence.activeLeakCount} active leak${intelligence.activeLeakCount === 1 ? "" : "s"} identified.`,
      );
      if (intelligence.topLeaks.length > 0) {
        parts.push(
          `Key areas for attention include ${intelligence.topLeaks
            .map((leak) => leak.title)
            .join("; ")}.`,
        );
      }
    }

    const shareOfVoice = this.readShareOfVoice(intelligence.shareOfVoice);
    if (shareOfVoice?.ourBrandShare !== undefined) {
      parts.push(`Your current share of voice is ${shareOfVoice.ourBrandShare}%.`);
    }
    if (shareOfVoice?.competitorThemes.length) {
      parts.push(
        `Top competitor themes revolve around ${shareOfVoice.competitorThemes.join(", ")}.`,
      );
    }

    return parts.join(" ");
  }

  buildReadinessNarrative(context: BrandCentreReadContext): string {
    const leakSummary =
      context.intelligence.topLeaks.length > 0
        ? context.intelligence.topLeaks
            .map((leak) => `${leak.title} (${leak.priority})`)
            .join("; ")
        : context.intelligence.available
          ? "No active intelligence gaps on file."
          : "Intelligence data pending deep scan.";

    return `Launch readiness for ${context.dna.brandName}: DNA completeness ${context.dna.verifiedFieldEstimate}; offerings ${context.dna.offeringCount}; active leaks ${context.intelligence.activeLeakCount}; intelligence gaps — ${leakSummary}`;
  }

  buildDnaBlocksNarrative(context: BrandCentreReadContext): string {
    const blocks = context.dna.coreDnaBlocks;
    const complete = blocks.filter((block) => block.complete);
    const incomplete = blocks.filter((block) => !block.complete);

    const blockList = blocks
      .map(
        (block) =>
          `${block.label}${block.complete ? " (complete)" : " (incomplete)"}`,
      )
      .join("; ");

    let summary = `Core DNA blocks track the foundational sections of Brand DNA (Tab 1) — narrative, personas, offerings, budget, and profile identity. For ${context.dna.brandName}, ${context.dna.verifiedFieldEstimate} are verified. The blocks are: ${blockList}.`;

    if (incomplete.length > 0) {
      summary += ` Still needed: ${incomplete.map((block) => block.label).join(", ")}.`;
    } else {
      summary += " Visual identity (colours, fonts, aesthetics) is part of Brand DNA and is listed separately when you ask about visual identity.";
    }

    if (complete.length === 0) {
      summary = `No core DNA blocks are verified yet for ${context.dna.brandName}. Complete Brand Centre onboarding and deep scan to populate narrative, personas, offerings, and budget.`;
    }

    return summary;
  }

  buildLeaksNarrative(context: BrandCentreReadContext): string {
    const { dna, intelligence } = context;

    if (!intelligence.available) {
      return `${dna.brandName} does not have Intelligence & Gaps data yet. Complete the Brand Centre deep scan to surface active leaks.`;
    }

    if (intelligence.activeLeakCount === 0) {
      return `${dna.brandName} has no active intelligence leaks on file.`;
    }

    return `${dna.brandName} has ${intelligence.activeLeakCount} active leak${intelligence.activeLeakCount === 1 ? "" : "s"}. See the table below for bucket, priority, and planner status.`;
  }

  buildLeaksTable(context: BrandCentreReadContext): DataTableData {
    if (!context.intelligence.available || context.intelligence.leaks.length === 0) {
      return {
        headers: ["Status", "Detail"],
        rows: [
          {
            Status: "—",
            Detail:
              context.intelligence.unavailableReason ??
              "No active intelligence leaks on file.",
          },
        ],
      };
    }

    return {
      headers: ["Leak", "Bucket", "Priority", "Planner status"],
      rows: context.intelligence.leaks.map((leak) => ({
        Leak: leak.title,
        Bucket: leak.bucket,
        Priority: leak.priority,
        "Planner status": leak.plannerStatus,
      })),
    };
  }

  buildPersonasNarrative(context: BrandCentreReadContext): string {
    if (context.personas.length === 0) {
      return `${context.dna.brandName} has no audience personas on file yet. Complete Brand DNA or ask me to create one for your confirmation.`;
    }

    return `${context.dna.brandName} has ${context.personas.length} audience persona${context.personas.length === 1 ? "" : "s"}. See psychographics and demographics in the table below.`;
  }

  buildPersonasTable(context: BrandCentreReadContext): DataTableData {
    if (context.personas.length === 0) {
      return {
        headers: ["Status", "Detail"],
        rows: [{ Status: "—", Detail: "No personas on file." }],
      };
    }

    return {
      headers: ["Persona", "Age range", "Interests", "Psychographics"],
      rows: context.personas.map((persona) => ({
        Persona: persona.name,
        "Age range": persona.ageRange,
        Interests: persona.interests,
        Psychographics: persona.psychographics,
      })),
    };
  }

  buildCompetitorInsightsNarrative(context: BrandCentreReadContext): string {
    const { dna, intelligence } = context;
    const shareOfVoice = this.readShareOfVoice(intelligence.shareOfVoice);
    const parts: string[] = [
      `Competitor and market positioning insights for ${dna.brandName}.`,
    ];

    if (dna.competitorCount === 0) {
      parts.push("No competitors are tracked in Brand DNA yet.");
    } else {
      parts.push(`${dna.competitorCount} competitor(s) tracked in Brand DNA.`);
    }

    if (shareOfVoice?.ourBrandShare !== undefined) {
      parts.push(`Your current share of voice is ${shareOfVoice.ourBrandShare}%.`);
    }

    if (shareOfVoice?.competitorThemes.length) {
      parts.push(
        `Top competitor creative themes in the last 30 days: ${shareOfVoice.competitorThemes.join(", ")}.`,
      );
    } else if (!intelligence.available) {
      parts.push(
        intelligence.unavailableReason ??
          "Run the Brand Centre deep scan to populate competitor streak analysis.",
      );
    } else {
      parts.push("No competitor theme streaks are on file yet for this period.");
    }

    return parts.join(" ");
  }

  buildVisualIdentityNarrative(context: BrandCentreReadContext): string {
    const { brandName, visualIdentity } = context.dna;
    const parts: string[] = [];

    parts.push(
      `Visual identity is part of Brand DNA (Tab 1) — it covers colours, fonts, and aesthetic styles alongside narrative and positioning.`,
    );

    const aesthetics =
      visualIdentity.aesthetics.length > 0
        ? visualIdentity.aesthetics.join(", ")
        : "not set yet";
    const fonts =
      visualIdentity.fonts.length > 0
        ? visualIdentity.fonts.join(", ")
        : "not set yet";
    const palette =
      visualIdentity.palette.length > 0
        ? visualIdentity.palette.join(", ")
        : "not set yet";

    parts.push(
      `For ${brandName}: aesthetic styles — ${aesthetics}; primary fonts — ${fonts}; colour palette — ${palette}.`,
    );

    if (
      visualIdentity.aesthetics.length === 0 &&
      visualIdentity.fonts.length === 0 &&
      visualIdentity.palette.length === 0
    ) {
      parts.push(
        "Run or refresh the Brand Centre deep scan, or ask me to stage a visual identity update for your confirmation.",
      );
    } else {
      parts.push(
        "To change colours, fonts, or aesthetics, ask me to update visual DNA — I will stage only what you asked to change for your confirmation before saving.",
      );
    }

    return parts.join(" ");
  }

  private buildCoreDnaBlockStatuses(aggregate: {
    profile: { brandName: string };
    completeness: {
      hasNarrative: boolean;
      hasPersonas: boolean;
      hasPrimaryOfferings: boolean;
      hasBudget: boolean;
    };
  }): Array<{ label: string; complete: boolean }> {
    return [
      {
        label: "Brand narrative (tagline, description, tone)",
        complete: aggregate.completeness.hasNarrative,
      },
      {
        label: "Audience personas",
        complete: aggregate.completeness.hasPersonas,
      },
      {
        label: "Primary offerings",
        complete: aggregate.completeness.hasPrimaryOfferings,
      },
      {
        label: "Campaign budget configuration",
        complete: aggregate.completeness.hasBudget,
      },
      {
        label: "Brand profile identity",
        complete: Boolean(aggregate.profile.brandName),
      },
    ];
  }

  private readBrandSafetyScore(baselineHealth: unknown): number | null {
    if (
      typeof baselineHealth !== "object" ||
      baselineHealth === null ||
      !("brandSafetyScore" in baselineHealth)
    ) {
      return null;
    }
    const score = (baselineHealth as { brandSafetyScore: unknown })
      .brandSafetyScore;
    return typeof score === "number" ? Math.round(score) : null;
  }

  private readShareOfVoice(shareOfVoice: unknown): {
    ourBrandShare?: number;
    competitorThemes: string[];
  } | null {
    if (typeof shareOfVoice !== "object" || shareOfVoice === null) {
      return null;
    }
    const record = shareOfVoice as Record<string, unknown>;
    const ourBrandShare =
      typeof record.ourBrandShare === "number"
        ? Math.round(record.ourBrandShare)
        : undefined;
    const competitorThemes = Array.isArray(record.competitorThemesLast30Days)
      ? record.competitorThemesLast30Days.filter(
          (theme): theme is string => typeof theme === "string",
        )
      : [];
    return { ourBrandShare, competitorThemes };
  }

  private estimateDnaCompleteness(aggregate: {
    profile: { brandName: string };
    narrative: { tagline?: string | null };
    personas: unknown[];
    offeringsPrimary: unknown[];
    completeness: {
      hasNarrative: boolean;
      hasPersonas: boolean;
      hasPrimaryOfferings: boolean;
      hasBudget: boolean;
    };
  }): string {
    const blocks = [
      aggregate.completeness.hasNarrative,
      aggregate.completeness.hasPersonas,
      aggregate.completeness.hasPrimaryOfferings,
      aggregate.completeness.hasBudget,
      Boolean(aggregate.profile.brandName),
    ];
    const filled = blocks.filter(Boolean).length;
    return `${filled} / ${blocks.length} core blocks`;
  }

  performanceColorToStatus(
    color: PerformanceColor | null | undefined,
  ): MetricItem["statusColor"] {
    switch (color) {
      case PerformanceColor.GREEN:
        return "GREEN";
      case PerformanceColor.YELLOW:
        return "YELLOW";
      case PerformanceColor.RED:
        return "RED";
      default:
        return "NEUTRAL";
    }
  }
}

import { Injectable } from "@nestjs/common";

import type { CoPilotChatPayload } from "../schemas/copilot-payload.schema";
import {
  BrandCentreCoPilotToolsService,
  type BrandCentreReadContext,
  type BrandCentreStatFactSheet,
} from "../tools/brand-centre.tools";

type GroundedGeminiArgs = {
  userText: string;
  narrativeText: string;
  context: BrandCentreReadContext;
};

@Injectable()
export class CoPilotResponseGroundingService {
  constructor(private readonly brandCentreTools: BrandCentreCoPilotToolsService) {}

  buildCanonicalStatsPromptBlock(context: BrandCentreReadContext): string {
    const facts = this.brandCentreTools.buildStatFactSheet(context);
    return [
      "CANONICAL_STATS (use these exact values when citing numbers — do not invent or round differently):",
      JSON.stringify(facts, null, 2),
    ].join("\n");
  }

  groundBrandCentreGeminiResponse(
    args: GroundedGeminiArgs,
  ): Pick<CoPilotChatPayload, "formatType" | "narrativeText" | "metricGridData"> {
    const facts = this.brandCentreTools.buildStatFactSheet(args.context);
    const narrativeText = this.syncNarrativeToFacts(args.narrativeText, facts);
    const attachMetricGrid = this.shouldAttachMetricGrid(args.userText);

    if (attachMetricGrid) {
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText,
        metricGridData: this.brandCentreTools.buildMetricGridFromContext(
          args.context,
        ),
      };
    }

    return {
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText,
    };
  }

  shouldAttachMetricGrid(_userText: string): boolean {
    // Metric grids are attached only on deterministic read routes (overview,
    // greeting, completeness, readiness, escrow). Gemini follow-ups stay narrative-only.
    return false;
  }

  private syncNarrativeToFacts(
    narrative: string,
    facts: BrandCentreStatFactSheet,
  ): string {
    let text = narrative;
    const leakPhrase = this.activeLeakPhrase(facts.activeLeakCount);

    text = text.replace(
      /\b\d+\s*\/\s*\d+\s+core blocks?\s+verified\b/gi,
      `${facts.coreDnaBlocks} verified`,
    );
    text = text.replace(/\b\d+\s*\/\s*\d+\s+core blocks?\b/gi, facts.coreDnaBlocks);
    text = text.replace(
      /\b\d+\s+out of\s+\d+\s+core blocks?\b/gi,
      facts.coreDnaBlocks.replace("/", " out of "),
    );

    text = text.replace(/\b\d+\s+competitors?\s+tracked\b/gi, `${facts.competitorCount} competitors tracked`);
    text = text.replace(
      /\bcompetitors?\s+tracked[:\s]+\d+\b/gi,
      `competitors tracked: ${facts.competitorCount}`,
    );

    text = text.replace(
      /\b\d+\s+audience personas?\b/gi,
      `${facts.personaCount} audience persona${facts.personaCount === 1 ? "" : "s"}`,
    );
    text = text.replace(
      /\b\d+\s+offerings?\s+on file\b/gi,
      `${facts.offeringCount} offerings on file`,
    );

    text = text.replace(
      /\b\d+\s+active leaks?\b/gi,
      leakPhrase,
    );
    text = text.replace(
      /\b(?:no|zero|0)\s+active leaks?\b/gi,
      facts.activeLeakCount === 0 ? "no active leaks" : leakPhrase,
    );
    text = text.replace(
      /\bthere are no active leaks\b/gi,
      facts.activeLeakCount === 0
        ? "there are no active leaks"
        : `there are ${leakPhrase}`,
    );
    text = text.replace(
      /\bthere are \d+ active leaks?\b/gi,
      facts.activeLeakCount === 0
        ? "there are no active leaks"
        : `there are ${leakPhrase}`,
    );

    if (facts.brandSafetyScore !== null) {
      text = text.replace(
        /\bbrand safety score(?: is|:)?\s*\d+(?:\.\d+)?\b/gi,
        `brand safety score is ${facts.brandSafetyScore}`,
      );
    }

    if (facts.shareOfVoicePercent !== null) {
      text = text.replace(
        /\bshare of voice is \d+(?:\.\d+)?%/gi,
        `share of voice is ${facts.shareOfVoicePercent}%`,
      );
      text = text.replace(
        /\b\d+(?:\.\d+)?%\s*share of voice\b/gi,
        `${facts.shareOfVoicePercent}% share of voice`,
      );
    }

    text = text.replace(
      new RegExp(`'${this.escapeRegExp(facts.scanStatus)}'`, "gi"),
      `'${facts.scanStatus}'`,
    );

    return text;
  }

  private activeLeakPhrase(count: number): string {
    return `${count} active leak${count === 1 ? "" : "s"}`;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

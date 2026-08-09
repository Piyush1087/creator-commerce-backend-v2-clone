import { BadRequestException, Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";

import type {
  CoPilotAiModule,
  CoPilotModuleReadContext,
  CoPilotModuleReadResult,
} from "../../core/ai-module.contract";
import type { ReadQueryKind } from "../../core/read-kind.types";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "../../core/write-intent.types";
import type { ExecutionWidgetData } from "../../schemas/copilot-payload.schema";
import { CoPilotIntentService } from "../../services/co-pilot-intent.service";
import { BrandCentreCoPilotToolsService } from "../../tools/brand-centre.tools";
import {
  buildDnaIdentityWriteNarrative,
  type DnaIdentityUpdateAxis,
} from "../../utils/co-pilot-dna-identity.util";
import { isDnaIdentityReadQuery } from "../../utils/co-pilot-dna-identity.util";
import {
  buildNoMovableLeaksNarrative,
  matchLeakByTitleHint,
  resolveLeakFromThreadContext,
} from "../../utils/co-pilot-leak-planner.util";
import { buildCoPilotWelcomeReply } from "../../utils/co-pilot-conversational.util";
import {
  presentDetailRead,
  presentInventoryRead,
  wantsFullDetailWidget,
} from "../../utils/co-pilot-presentation.util";
import { PlannerCoPilotToolsService } from "../../tools/planner.tools";

const READ_KINDS: ReadQueryKind[] = [
  "DNA_COMPLIANCE",
  "BRAND_CENTRE_GREETING",
  "BRAND_CENTRE_OVERVIEW",
  "BRAND_CENTRE_COMPLETENESS",
  "BRAND_CENTRE_READINESS",
  "BRAND_CENTRE_DNA_BLOCKS",
  "BRAND_CENTRE_LEAKS",
  "BRAND_CENTRE_PERSONAS",
  "BRAND_CENTRE_COMPETITOR_INSIGHTS",
  "BRAND_CENTRE_VISUAL_IDENTITY",
];

const WRITE_INTENTS: WriteIntentKind[] = [
  "DNA_IDENTITY_UPDATE",
  "DNA_OFFERING_UPDATE",
  "DNA_PERSONA_CREATE",
  "INTELLIGENCE_MOVE_TO_PLANNER",
];

@Injectable()
export class BrandCentreAiModule implements CoPilotAiModule {
  readonly id = "brand-centre";
  readonly name = "Brand Centre";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;

  constructor(
    private readonly brandCentreTools: BrandCentreCoPilotToolsService,
    private readonly plannerTools: PlannerCoPilotToolsService,
    private readonly intents: CoPilotIntentService,
  ) {}

  detectRead(userText: string, _scope: CoPilotScopeContext): ReadQueryKind | null {
    const n = userText.toLowerCase();

    if (
      n.includes("do-not-say") ||
      n.includes("do not say") ||
      n.includes("compliance") ||
      n.includes("restricted words")
    ) {
      return "DNA_COMPLIANCE";
    }
    if (this.isVisualIdentityReadQuery(n) || isDnaIdentityReadQuery(userText)) {
      return "BRAND_CENTRE_VISUAL_IDENTITY";
    }
    if (this.isPersonasReadQuery(n)) return "BRAND_CENTRE_PERSONAS";
    if (this.isCompetitorInsightsReadQuery(n)) {
      return "BRAND_CENTRE_COMPETITOR_INSIGHTS";
    }
    if (this.isDnaBlocksReadQuery(n)) return "BRAND_CENTRE_DNA_BLOCKS";
    if (this.isLeaksReadQuery(n)) return "BRAND_CENTRE_LEAKS";
    if (
      n.includes("incomplete") ||
      n.includes("completeness") ||
      n.includes("flagged")
    ) {
      return "BRAND_CENTRE_COMPLETENESS";
    }
    if (
      n.includes("launch readiness") ||
      (n.includes("readiness") && !n.includes("campaign")) ||
      n.includes("before uce launch") ||
      (n.includes("what should we fix") && n.includes("uce"))
    ) {
      return "BRAND_CENTRE_READINESS";
    }
    if (
      n.includes("overview") ||
      (n.includes("brand centre") &&
        (n.includes("read-only") ||
          n.includes("give me") ||
          n.includes("snapshot") ||
          n.includes("together"))) ||
      (n.includes("dna and intelligence") &&
        (n.includes("overview") ||
          n.includes("read-only") ||
          n.includes("give me") ||
          n.includes("together") ||
          n.includes("before we plan")))
    ) {
      return "BRAND_CENTRE_OVERVIEW";
    }

    const trimmed = userText.trim();
    if (
      /^(hi|hello|hey|yo|howdy|sup|hiya)\b[!?.]*$/i.test(trimmed) ||
      /^good\s+(morning|afternoon|evening)\b[!?.]*$/i.test(trimmed) ||
      /^(test|testing)\s*[!?.]*$/i.test(trimmed) ||
      (trimmed.length <= 20 &&
        /^(hi|hello|hey)\b/i.test(trimmed) &&
        !n.includes("overview") &&
        !n.includes("campaign"))
    ) {
      return "BRAND_CENTRE_GREETING";
    }

    return null;
  }

  detectWrite(
    userText: string,
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null {
    return (
      this.intents.detectDnaPersonaCreate(userText) ??
      this.intents.detectDnaOfferingUpdate(userText) ??
      this.intents.detectDnaIdentityUpdate(userText) ??
      this.intents.detectIntelligenceMoveToPlanner(userText, history)
    );
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (!READ_KINDS.includes(kind)) return null;
    const context = await this.brandCentreTools.getBrandCentreReadContext(
      ctx.brandProfileId,
    );

    if (kind === "DNA_COMPLIANCE") {
      const words = context.dna.doNotSayList;
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          words.length > 0
            ? `Compliance do-not-say phrases for ${context.dna.brandName}: ${words.join("; ")}.`
            : `No do-not-say list on file yet for ${context.dna.brandName}. Complete Brand DNA scan to populate guardrails.`,
        toolsInvoked: ["getBrandCentreReadContext"],
      };
    }

    if (kind === "BRAND_CENTRE_GREETING") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: buildCoPilotWelcomeReply(context.dna.brandName),
        toolsInvoked: ["getBrandCentreReadContext"],
      };
    }

    if (
      kind === "BRAND_CENTRE_OVERVIEW" ||
      kind === "BRAND_CENTRE_COMPLETENESS"
    ) {
      const narrative =
        kind === "BRAND_CENTRE_COMPLETENESS"
          ? this.brandCentreTools.buildCompletenessNarrative(context)
          : this.brandCentreTools.buildOverviewNarrative(context);
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: narrative,
          metricGridData:
            this.brandCentreTools.buildMetricGridFromContext(context),
          preferMetrics:
            kind === "BRAND_CENTRE_OVERVIEW" ||
            wantsFullDetailWidget(ctx.userText),
          toolsInvoked: ["getBrandCentreReadContext"],
        }),
      };
    }

    if (kind === "BRAND_CENTRE_READINESS") {
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: this.brandCentreTools.buildReadinessNarrative(context),
          metricGridData:
            this.brandCentreTools.buildMetricGridFromContext(context),
          preferMetrics: wantsFullDetailWidget(ctx.userText),
          toolsInvoked: ["getBrandCentreReadContext"],
        }),
      };
    }

    if (kind === "BRAND_CENTRE_DNA_BLOCKS") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: this.brandCentreTools.buildDnaBlocksNarrative(context),
        toolsInvoked: ["getBrandCentreReadContext"],
      };
    }

    if (kind === "BRAND_CENTRE_LEAKS") {
      const leakCount = context.intelligence.available
        ? context.intelligence.leaks.length
        : 0;
      return {
        ...presentInventoryRead({
          userText: ctx.userText,
          narrativeText: this.brandCentreTools.buildLeaksNarrative(context),
          tableData: this.brandCentreTools.buildLeaksTable(context),
          rowCount: leakCount,
          toolsInvoked: ["getBrandCentreReadContext"],
        }),
      };
    }

    if (kind === "BRAND_CENTRE_PERSONAS") {
      return {
        ...presentInventoryRead({
          userText: ctx.userText,
          narrativeText: this.brandCentreTools.buildPersonasNarrative(context),
          tableData: this.brandCentreTools.buildPersonasTable(context),
          rowCount: context.personas.length,
          toolsInvoked: ["getBrandCentreReadContext"],
        }),
      };
    }

    if (kind === "BRAND_CENTRE_COMPETITOR_INSIGHTS") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          this.brandCentreTools.buildCompetitorInsightsNarrative(context),
        toolsInvoked: ["getBrandCentreReadContext"],
      };
    }

    if (kind === "BRAND_CENTRE_VISUAL_IDENTITY") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: this.brandCentreTools.buildVisualIdentityNarrative(context),
        toolsInvoked: ["getBrandCentreReadContext"],
      };
    }

    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    brandProfileId: string,
    context?: {
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      userText: string;
    },
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    if (intent.kind !== "INTELLIGENCE_MOVE_TO_PLANNER") {
      if (intent.kind === "DNA_IDENTITY_UPDATE") {
        const bc = await this.brandCentreTools.getBrandCentreReadContext(
          brandProfileId,
        );
        return {
          ...intent,
          stagedPayload: {
            ...intent.stagedPayload,
            current_palette: bc.dna.visualIdentity.palette,
            current_fonts: bc.dna.visualIdentity.fonts,
            current_aesthetics: bc.dna.visualIdentity.aesthetics,
          },
        };
      }
      return intent;
    }

    const stagedPayload = { ...intent.stagedPayload };
    const missingSlots = intent.missingSlots.map((s) => ({ ...s }));
    const leaks = await this.plannerTools.listMovableLeaks(brandProfileId);
    if (leaks.length === 0) {
      throw new BadRequestException(buildNoMovableLeaksNarrative());
    }

    const titleHint = String(
      stagedPayload.leak_title_hint ?? stagedPayload.leak_title ?? "",
    ).trim();
    let matched = titleHint ? matchLeakByTitleHint(titleHint, leaks) : undefined;
    if (!matched && context) {
      matched = resolveLeakFromThreadContext(
        context.history,
        leaks,
        context.userText,
      );
    }
    if (!matched && leaks.length === 1) matched = leaks[0];

    const leakSlot = missingSlots.find((s) => s.fieldName === "leak_id");
    if (leakSlot) {
      leakSlot.selectOptions = leaks.map(
        (leak) => `${leak.id}::${leak.insightTitle}`,
      );
    }
    if (matched) {
      stagedPayload.leak_id = matched.id;
      stagedPayload.leak_title = matched.insightTitle;
      delete stagedPayload.leak_title_hint;
    }

    return {
      kind: intent.kind,
      stagedPayload,
      missingSlots: missingSlots.filter(
        (s) => !(s.fieldName === "leak_id" && stagedPayload.leak_id),
      ),
    };
  }

  buildExecutionWidget(args: {
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey: string;
  }): ExecutionWidgetData | null {
    if (!WRITE_INTENTS.includes(args.intentKind)) return null;
    return this.intents.buildExecutionWidget({
      intentKind: args.intentKind as
        | "DNA_IDENTITY_UPDATE"
        | "DNA_OFFERING_UPDATE"
        | "DNA_PERSONA_CREATE"
        | "INTELLIGENCE_MOVE_TO_PLANNER"
        | "CAMPAIGN_LAUNCH"
        | "CAMPAIGN_EDIT_DRAFT"
        | "PLANNER_LAUNCH_DRAFT",
      stagedPayload: args.stagedPayload,
      idempotencyKey: args.idempotencyKey,
    });
  }

  writeSlotNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    switch (kind) {
      case "DNA_IDENTITY_UPDATE": {
        const axes = (stagedPayload?.update_axes ?? []) as DnaIdentityUpdateAxis[];
        if (axes.length > 0) {
          return `${buildDnaIdentityWriteNarrative(axes)} Fill in the staged fields below.`;
        }
        return "I can update Brand DNA visual identity after you confirm. Fill in the staged fields below.";
      }
      case "DNA_OFFERING_UPDATE":
        return "I can update a product short description after you confirm. Nothing is saved until you approve.";
      case "DNA_PERSONA_CREATE":
        return "I can create a new audience persona after you confirm the details below.";
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return "I can send an Intelligence & Gaps leak to Campaign Planner after you confirm. A planner card will be built in the background — you'll see live progress after you confirm.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    switch (kind) {
      case "DNA_IDENTITY_UPDATE": {
        const axes = (stagedPayload?.update_axes ?? []) as DnaIdentityUpdateAxis[];
        if (axes.length > 0) return buildDnaIdentityWriteNarrative(axes);
        return "Review the Brand DNA identity changes below. Nothing is saved until you confirm.";
      }
      case "DNA_OFFERING_UPDATE":
        return "Review the product description update below. Nothing is saved until you confirm.";
      case "DNA_PERSONA_CREATE":
        return "Review the new persona below. Nothing is saved until you confirm.";
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return "Review the leak to send to Campaign Planner. After you confirm, I'll show live job progress while the planner card is built.";
      default:
        return null;
    }
  }

  private isPersonasReadQuery(n: string): boolean {
    return (
      (n.includes("persona") &&
        (n.includes("breakdown") ||
          n.includes("psychographic") ||
          n.includes("audience") ||
          n.includes("show me") ||
          n.includes("list"))) ||
      n.includes("target demographic")
    );
  }

  private isCompetitorInsightsReadQuery(n: string): boolean {
    return (
      (n.includes("competitor") &&
        (n.includes("streak") ||
          n.includes("rival") ||
          n.includes("winning creative") ||
          n.includes("market positioning") ||
          n.includes("share of voice"))) ||
      n.includes("creative streak") ||
      n.includes("winning creative")
    );
  }

  private isLeaksReadQuery(n: string): boolean {
    if (
      n.includes("overview") ||
      n.includes("brand centre") ||
      n.includes("dna and intelligence")
    ) {
      return false;
    }
    return n.includes("leak") || n.includes("intelligence gap");
  }

  private isDnaBlocksReadQuery(n: string): boolean {
    if (
      n.includes("overview") ||
      n.includes("completeness") ||
      n.includes("readiness")
    ) {
      return false;
    }
    return (
      (n.includes("dna") &&
        (n.includes("block") || n.includes("section") || n.includes("detail"))) ||
      n.includes("brand dna details")
    );
  }

  private isVisualIdentityReadQuery(n: string): boolean {
    return (
      n.includes("visual identity") ||
      n.includes("brand colours") ||
      n.includes("brand colors") ||
      (n.includes("font") && n.includes("brand")) ||
      n.includes("aesthetic style")
    );
  }
}

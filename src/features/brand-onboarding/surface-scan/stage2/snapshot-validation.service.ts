import { Injectable, Logger } from "@nestjs/common";
import { BrandIntelligenceStage, type Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { PrismaService } from "../../../../prisma/prisma.service";
import { BrandDnaEngineService } from "./brand-dna-engine.service";
import {
  BrandDnaSnapshotSchema,
  type BrandDnaSnapshot,
} from "./brand-dna.schema";
import { BrandDnaProfileMergerService } from "./brand-dna-profile-merger.service";

/**
 * Phase 7 — validate Prompt A output, corrective retries (max 2), soft-fill
 * missing evidence stubs, then archive or NEEDS_REVIEW.
 */
@Injectable()
export class SnapshotValidationService {
  private readonly logger = new Logger(SnapshotValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandDnaEngine: BrandDnaEngineService,
    private readonly profileMerger: BrandDnaProfileMergerService,
  ) {}

  async validateAndArchive(
    scanId: string,
    rawJson: unknown,
    currentRetryCount = 0,
  ): Promise<BrandDnaSnapshot> {
    const startedAt = Date.now();
    this.logger.log(
      `validate.start scanId=${scanId} round=${currentRetryCount}`,
    );

    const candidate = unwrapBrandDna(rawJson);
    const parsed = BrandDnaSnapshotSchema.safeParse(candidate);

    if (parsed.success) {
      return this.archive(scanId, parsed.data, startedAt);
    }

    const formatted = formatZodError(parsed.error);
    this.logger.warn(
      `validate.zod_fail scanId=${scanId} round=${currentRetryCount} ms=${Date.now() - startedAt} issues=${formatted.slice(0, 500)}`,
    );

    if (currentRetryCount < 2) {
      this.logger.log(
        `validate.retry scanId=${scanId} nextRound=${currentRetryCount + 1}`,
      );
      const correction =
        "Your previous response failed structural parsing contracts because data parameters were missing clear page citations or required fields. " +
        "You must provide a valid page_url and excerpt context match for every single attribute property. " +
        `Zod validation errors:\n${formatted}`;
      const retryRaw = await this.brandDnaEngine.extractBrandDna(scanId, {
        correctionHint: correction,
      });
      return this.validateAndArchive(scanId, retryRaw, currentRetryCount + 1);
    }

    // Soft-fill: inject SYSTEM evidence stubs for empty evidence arrays where
    // a value already exists, then re-parse once before NEEDS_REVIEW.
    const softFilled = softFillMissingEvidence(candidate);
    const softParsed = BrandDnaSnapshotSchema.safeParse(softFilled);
    if (softParsed.success) {
      this.logger.log(
        `validate.soft_fill_ok scanId=${scanId} ms=${Date.now() - startedAt}`,
      );
      return this.archive(scanId, softParsed.data, startedAt);
    }

    const softFormatted = formatZodError(softParsed.error);
    await this.prisma.brandIntelligenceScan.update({
      where: { id: scanId },
      data: {
        currentStage: BrandIntelligenceStage.STAGE_2_NEEDS_REVIEW,
        errorLogs: `Universal Wrapper Validation Failure: ${softFormatted}`,
      },
    });
    this.logger.error(
      `validate.needs_review scanId=${scanId} rounds=${currentRetryCount + 1} softFill=fail ms=${Date.now() - startedAt}`,
    );
    throw new Error(
      `Brand DNA validation failed after retries: ${softFormatted.slice(0, 300)}`,
    );
  }

  private async archive(
    scanId: string,
    snapshot: BrandDnaSnapshot,
    startedAt: number,
  ): Promise<BrandDnaSnapshot> {
    await this.prisma.brandIntelligenceScan.update({
      where: { id: scanId },
      data: {
        brandDnaVerifiedSnapshot:
          snapshot as unknown as Prisma.InputJsonValue,
        currentStage: BrandIntelligenceStage.STAGE_2_BRAND_DNA_ARCHIVED,
        errorLogs: null,
      },
    });
    this.logger.log(
      `validate.archived scanId=${scanId} personas=${snapshot.audience_personas.length} niche=${snapshot.industry_niche.value.slice(0, 60)} ms=${Date.now() - startedAt}`,
    );
    await this.profileMerger.mergeFromVerifiedSnapshot(scanId, snapshot);
    return snapshot;
  }
}

/**
 * Walks wrapper-shaped objects and adds a SYSTEM evidence stub when
 * `evidence` is missing/empty but `value` is present. Does not invent values.
 */
export function softFillMissingEvidence(candidate: unknown): unknown {
  if (Array.isArray(candidate)) {
    return candidate.map((item) => softFillMissingEvidence(item));
  }
  if (!candidate || typeof candidate !== "object") {
    return candidate;
  }

  const obj = candidate as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    next[key] = softFillMissingEvidence(value);
  }

  if (
    "value" in next &&
    hasNonEmptyValue(next.value) &&
    ("evidence" in next || "confidence" in next || "source" in next)
  ) {
    const evidence = next.evidence;
    const empty =
      !Array.isArray(evidence) ||
      evidence.length === 0 ||
      evidence.every((e) => !isUsableEvidence(e));
    if (empty) {
      next.evidence = [
        {
          page_url: "system://soft-fill",
          page_type: "system_stub",
          excerpt:
            "SYSTEM soft-fill: model omitted citation; value retained for archive.",
        },
      ];
      if (next.source !== "USER") {
        next.source = "SYSTEM";
      }
      if (typeof next.edited !== "boolean") {
        next.edited = false;
      }
      if (typeof next.confidence !== "number") {
        next.confidence = 50;
      }
    }
  }

  return next;
}

function hasNonEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function isUsableEvidence(item: unknown): boolean {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const e = item as Record<string, unknown>;
  return (
    typeof e.page_url === "string" &&
    e.page_url.trim().length > 0 &&
    typeof e.page_type === "string" &&
    e.page_type.trim().length > 0 &&
    typeof e.excerpt === "string" &&
    e.excerpt.trim().length > 0
  );
}

function unwrapBrandDna(rawJson: unknown): unknown {
  if (
    rawJson &&
    typeof rawJson === "object" &&
    !Array.isArray(rawJson) &&
    "brand_dna" in rawJson
  ) {
    return (rawJson as { brand_dna: unknown }).brand_dna;
  }
  return rawJson;
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

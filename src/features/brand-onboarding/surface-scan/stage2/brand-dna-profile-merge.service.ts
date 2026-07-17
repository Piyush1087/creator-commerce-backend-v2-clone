import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { BrandDnaSnapshot } from "./brand-dna.schema";

/**
 * Merges an archived Brand DNA snapshot into BrandProfile flat/JSON fields,
 * skipping keys already marked in isUserEdited.
 */
@Injectable()
export class BrandDnaProfileMergeService {
  private readonly logger = new Logger(BrandDnaProfileMergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async mergeArchivedSnapshot(
    scanId: string,
    snapshot: BrandDnaSnapshot,
  ): Promise<void> {
    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { id: scanId },
      select: { brandProfileId: true },
    });
    if (!scan?.brandProfileId) {
      this.logger.warn(
        `brand-dna.merge_skip scanId=${scanId} reason=no_brand_profile`,
      );
      return;
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: scan.brandProfileId },
      select: {
        id: true,
        isUserEdited: true,
        visualIdentity: true,
        targetAudience: true,
      },
    });
    if (!profile) {
      return;
    }

    const edited =
      profile.isUserEdited &&
      typeof profile.isUserEdited === "object" &&
      !Array.isArray(profile.isUserEdited)
        ? (profile.isUserEdited as Record<string, unknown>)
        : {};

    const data: Prisma.BrandProfileUpdateInput = {};

    if (!edited.description) {
      data.description = snapshot.brand_narrative.value;
    }
    if (!edited.industryNiche) {
      data.industryNiche = snapshot.industry_niche.value;
    }

    if (!edited.visualIdentity) {
      const prior =
        profile.visualIdentity &&
        typeof profile.visualIdentity === "object" &&
        !Array.isArray(profile.visualIdentity)
          ? (profile.visualIdentity as Record<string, unknown>)
          : {};
      const toneValues = snapshot.tone_of_voice.value.map((label) => ({
        label,
        description: label,
      }));
      data.visualIdentity = {
        ...prior,
        toneOfVoice: toneValues,
        aesthetic: snapshot.visual_aesthetic.value,
      } as Prisma.InputJsonValue;
    }

    if (!edited.targetAudience) {
      const first = snapshot.audience_personas[0];
      if (first) {
        const ageRange = parseAgeRange(first.age_range.value);
        const geography = first.geography.value.trim();
        const affluence = parseAffluence(first.affluence_score.value);
        data.targetAudience = {
          personaName: first.name.value,
          countries: geography ? [geography] : [],
          ageRange,
          affluence,
          traits: first.traits.value,
        } as Prisma.InputJsonValue;
      }
    }

    if (Object.keys(data).length === 0) {
      this.logger.log(
        `brand-dna.merge_noop brandProfileId=${profile.id} (all fields user-edited)`,
      );
      return;
    }

    await this.prisma.brandProfile.update({
      where: { id: profile.id },
      data,
    });
    this.logger.log(
      `brand-dna.merge_ok brandProfileId=${profile.id} fields=${Object.keys(data).join(",")}`,
    );
  }
}

function parseAgeRange(raw: string): [number, number] {
  const match = raw.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})/i);
  if (match) {
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return [min, max];
    }
  }
  return [25, 40];
}

function parseAffluence(raw: string): number {
  const num = Number(String(raw).replace(/[^\d.]/g, ""));
  if (Number.isFinite(num) && num >= 0 && num <= 5) {
    return Math.round(num);
  }
  // Common patterns like "mid" / "high"
  const lower = raw.toLowerCase();
  if (lower.includes("high") || lower.includes("premium")) return 4;
  if (lower.includes("mid") || lower.includes("moderate")) return 3;
  if (lower.includes("mass") || lower.includes("value")) return 2;
  return 3;
}

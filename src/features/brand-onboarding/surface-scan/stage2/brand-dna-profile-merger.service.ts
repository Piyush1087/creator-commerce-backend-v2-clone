import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { RuntimeContextPackage } from "../stage1b/runtime-context.types";
import type { BrandDnaSnapshot } from "./brand-dna.schema";

/**
 * Merges archived Brand DNA into BrandProfile flat/JSON fields so the
 * existing Brand DNA page can render Stage 2 data. Respects isUserEdited.
 *
 * All 8 Prompt A fields:
 * - description ← brand_narrative
 * - industryNiche ← industry_niche
 * - visualIdentity ← tone/aesthetic/positioning/valueProp/differentiators/narrative
 *   + Stage 1B website_assets colors/fonts when profile has none yet
 * - targetAudience ← audience_personas[0]
 */
@Injectable()
export class BrandDnaProfileMergerService {
  private readonly logger = new Logger(BrandDnaProfileMergerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async mergeFromVerifiedSnapshot(
    scanId: string,
    snapshot: BrandDnaSnapshot,
  ): Promise<void> {
    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { id: scanId },
      select: { brandProfileId: true, runtimeContext: true },
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

    const edited = asRecord(profile.isUserEdited) ?? {};
    const visual = asRecord(profile.visualIdentity) ?? {};
    const websiteAssets = parseRuntimeWebsiteAssets(scan?.runtimeContext);
    const data: Prisma.BrandProfileUpdateInput = {};

    if (!edited.description) {
      data.description = snapshot.brand_narrative.value;
    }
    if (!edited.industryNiche) {
      data.industryNiche = snapshot.industry_niche.value;
    }

    if (!edited.visualIdentity) {
      const nextVisual: Record<string, unknown> = { ...visual };

      if (!edited.toneOfVoice) {
        nextVisual.toneOfVoice = snapshot.tone_of_voice.value.map((label) => ({
          label,
          description: "",
        }));
      }
      if (!edited.aesthetic) {
        nextVisual.aesthetic = snapshot.visual_aesthetic.value;
      }
      if (!edited.positioning) {
        nextVisual.positioning = snapshot.brand_positioning.value;
      }
      if (!edited.valueProp) {
        nextVisual.valueProp = snapshot.core_value_proposition.value;
      }
      if (!edited.differentiators) {
        nextVisual.differentiators = snapshot.key_differentiators.value;
      }
      if (!edited.narrative) {
        nextVisual.narrative = snapshot.brand_narrative.value;
      }

      const existingColors = Array.isArray(visual.colors)
        ? (visual.colors as unknown[]).filter((c) => typeof c === "string")
        : [];
      if (
        !edited.colors &&
        existingColors.length === 0 &&
        websiteAssets.colors.length > 0
      ) {
        nextVisual.colors = websiteAssets.colors;
      }

      const existingFonts = asRecord(visual.fonts);
      const hasFonts =
        Boolean(existingFonts?.heading) || Boolean(existingFonts?.body);
      if (!edited.fonts && !hasFonts && websiteAssets.fonts.length > 0) {
        nextVisual.fonts = {
          heading: websiteAssets.fonts[0],
          body: websiteAssets.fonts[1] ?? websiteAssets.fonts[0],
        };
      }

      data.visualIdentity = nextVisual as Prisma.InputJsonValue;
    }

    if (!edited.targetAudience && snapshot.audience_personas.length > 0) {
      const first = snapshot.audience_personas[0];
      const ageRange = parseAgeRange(first.age_range.value);
      const affluence = parseAffluence(first.affluence_score.value);
      data.targetAudience = {
        personaName: first.name.value,
        countries: [first.geography.value].filter(Boolean),
        ageRange,
        affluence,
        traits: first.traits.value,
        gender: first.gender.value,
        personas: snapshot.audience_personas.map((p) => ({
          name: p.name.value,
          ageRange: p.age_range.value,
          gender: p.gender.value,
          geography: p.geography.value,
          affluence: p.affluence_score.value,
          traits: p.traits.value,
        })),
      } as Prisma.InputJsonValue;
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
      `brand-dna.merged brandProfileId=${profile.id} fields=${Object.keys(data).join(",")}`,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Pull scraped palette/type from Stage 1B runtime context for Brand DNA UI. */
function parseRuntimeWebsiteAssets(
  runtimeContext: unknown,
): { colors: string[]; fonts: string[] } {
  const pkg = runtimeContext as RuntimeContextPackage | null;
  const assets = pkg?.website_assets;
  if (!assets || typeof assets !== "object") {
    return { colors: [], fonts: [] };
  }

  const colors = Array.isArray(assets.colors)
    ? profileHexColors(
        assets.colors.filter((c): c is string => typeof c === "string"),
      )
    : [];
  const fonts = Array.isArray(assets.fonts)
    ? uniqueNonEmptyStrings(
        assets.fonts.filter((f): f is string => typeof f === "string"),
        8,
      )
    : [];

  return { colors, fonts };
}

function profileHexColors(colors: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of colors) {
    const v = raw.trim();
    let hex: string | null = null;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      hex = v.toLowerCase();
    } else if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      hex =
        `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
    }
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 8) break;
  }
  return out;
}

function uniqueNonEmptyStrings(values: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function parseAgeRange(raw: string): [number, number] {
  const match = raw.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (match) {
    return [Number(match[1]), Number(match[2])];
  }
  const single = raw.match(/(\d+)/);
  if (single) {
    const n = Number(single[1]);
    return [n, Math.min(n + 10, 65)];
  }
  return [25, 44];
}

function parseAffluence(raw: string): number {
  if (!raw || String(raw).trim().length === 0) {
    return 3;
  }

  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  // Legacy + malformed scans sometimes produce `0` — treat as "not present".
  if (Number.isFinite(n) && n >= 1 && n <= 5) {
    return Math.round(n);
  }
  if (Number.isFinite(n) && n === 0) {
    return 3;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("high") || lower.includes("affluent")) return 4;
  if (lower.includes("mid") || lower.includes("moderate")) return 3;
  if (lower.includes("mass") || lower.includes("budget")) return 2;
  return 3;
}

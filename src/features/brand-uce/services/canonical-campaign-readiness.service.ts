import { BadRequestException, Injectable } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  type CanonicalObjective,
  resolveCanonicalCampaignReadiness,
} from "./canonical-campaign-readiness.resolver";

const CANONICAL_OBJECTIVES = new Set<CanonicalObjective>([
  "PULSE",
  "PROOF",
  "PRODUCTION",
  "PUSH",
]);

function savedObjective(definition: unknown): CanonicalObjective | null {
  if (
    !definition ||
    typeof definition !== "object" ||
    Array.isArray(definition)
  ) {
    return null;
  }

  const draft = (definition as { draft?: unknown }).draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;

  const strategy = (draft as { strategy?: unknown }).strategy;
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) {
    return null;
  }

  const objective = (strategy as { core_objective?: unknown }).core_objective;
  return typeof objective === "string" &&
    CANONICAL_OBJECTIVES.has(objective as CanonicalObjective)
    ? (objective as CanonicalObjective)
    : null;
}

@Injectable()
export class CanonicalCampaignReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadiness(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { id: true, status: true },
    });
    if (!campaign) throw new BadRequestException("Campaign draft not found.");
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Campaign is no longer a DRAFT.");
    }

    const [rows, brand] = await Promise.all([
      this.prisma.$queryRaw<Array<{ canonical_definition: unknown }>>`
        SELECT "canonical_definition"
        FROM "uce_campaigns"
        WHERE "id" = ${campaignId}
        LIMIT 1
      `,
      this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { countryCode: true, industry: true },
      }),
    ]);
    if (!brand) throw new BadRequestException("Brand profile not found");

    const objective = savedObjective(rows[0]?.canonical_definition);
    const readiness = resolveCanonicalCampaignReadiness(
      objective,
      brand.industry,
      brand.countryCode,
    );

    return { campaignId: campaign.id, ...readiness };
  }
}

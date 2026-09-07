import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { CampaignContinuationSeed } from "../creator-entry/campaign-continuation-context.port";

export function normalizeCampaignAttribution(
  value: unknown,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const input = value as Record<string, unknown>;
  for (const [key, size] of Object.entries({
    utm_source: 100,
    utm_medium: 100,
    utm_campaign: 100,
    utm_content: 200,
    utm_term: 200,
  })) {
    const item = input[key];
    if (typeof item !== "string") continue;
    result[key] = item
      .normalize("NFKC")
      .trim()
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .slice(0, size);
  }
  return result;
}

@Injectable()
export class CampaignIngressService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(
    campaignId: string,
    context: CampaignContinuationSeed,
    raw: unknown,
    actor: CreatorWorkspaceActorContext | null,
    now: Date,
  ): Promise<string | undefined> {
    try {
      const attribution = normalizeCampaignAttribution(raw);
      const referenceDigest = createHash("sha256")
        .update(randomBytes(32))
        .digest("hex");
      const touch = await this.prisma.campaignIngressTouch.create({
        data: {
          kind: "QUALIFIED_INGRESS",
          referenceDigest,
          campaignId,
          entrySurface: context.entrySurface,
          entryAuthorityKind: context.entryAuthority.kind,
          campaignShareId:
            context.entryAuthority.kind === "SHARE"
              ? context.entryAuthority.campaignShareId
              : null,
          campaignInvitationId:
            context.entryAuthority.kind === "INVITATION"
              ? context.entryAuthority.campaignInvitationId
              : null,
          boundCreatorProfileId: actor?.subjectCreatorProfileId ?? null,
          boundCreatorWorkspaceId: actor?.workspaceId ?? null,
          boundAt: actor ? now : null,
          occurredAt: now,
          utmSource: attribution.utm_source,
          utmMedium: attribution.utm_medium,
          utmCampaign: attribution.utm_campaign,
          utmContent: attribution.utm_content,
          utmTerm: attribution.utm_term,
        },
        select: { id: true },
      });
      return touch.id;
    } catch {
      // Correlation is best effort; never log raw ingress or block a secure continuation.
      return undefined;
    }
  }
}

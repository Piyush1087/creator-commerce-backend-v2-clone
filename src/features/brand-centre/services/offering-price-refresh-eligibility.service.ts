import { Injectable } from "@nestjs/common";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  DataExtractionAcquisitionQuality,
  DataExtractionCaptureStatus,
  OfferingLifecycle,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { asBrandId } from "../../data-extraction/evidence/domain/evidence-identities";
import { exactOfferingResourceIdentity } from "../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";

export interface EligibleOfferingPriceRefresh {
  readonly brandProfileId: string;
  readonly offeringId: string;
  readonly offeringUrl: string;
  readonly ownedWebsiteRoot: string;
  readonly resourceRef: string;
  readonly lastSuccessfulAt: Date | null;
}

@Injectable()
export class OfferingPriceRefreshEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async select(
    intervalHours: number,
    batchSize: number,
    now = new Date(),
  ): Promise<readonly EligibleOfferingPriceRefresh[]> {
    const offerings = await this.prisma.offering.findMany({
      where: { canonicalLifecycle: OfferingLifecycle.ACTIVE },
      include: {
        brandProfile: { select: { domain: true } },
        priceState: { include: { currentRevision: true } },
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: Math.min(batchSize * 8, 800),
    });
    const cutoff = new Date(now.getTime() - intervalHours * 60 * 60 * 1000);
    const eligible: EligibleOfferingPriceRefresh[] = [];
    for (const offering of offerings) {
      if (eligible.length >= batchSize) break;
      const current = offering.priceState?.currentRevision;
      if (
        current &&
        (current.authority === CanonicalOfferingAuthority.BRAND_CONFIRMED ||
          current.origin === CanonicalOfferingOrigin.BRAND_EDIT ||
          current.origin === CanonicalOfferingOrigin.BRAND_UPLOAD)
      ) {
        continue;
      }
      const identity = exactOfferingResourceIdentity(
        asBrandId(offering.brandProfileId),
        offering.url,
        offering.id,
      );
      const resource = await this.prisma.dataExtractionResource.findUnique({
        where: { resourceRef: identity.resourceRef },
        select: { resourceRef: true, pageRole: true },
      });
      if (!resource || resource.pageRole !== "OFFERING_DETAIL") continue;
      const latest =
        await this.prisma.dataExtractionCapabilityExecution.findFirst({
          where: {
            brandId: offering.brandProfileId,
            capabilityId: "owned_website.offering_commercial_evidence",
            completedAt: { not: null },
            resourceScope: { some: { resourceRef: resource.resourceRef } },
            captures: {
              some: {
                resourceRef: resource.resourceRef,
                status: DataExtractionCaptureStatus.COMPLETED,
                acquisitionQuality: {
                  in: [
                    DataExtractionAcquisitionQuality.COMPLETE,
                    DataExtractionAcquisitionQuality.PARTIAL,
                    DataExtractionAcquisitionQuality.DEGRADED,
                  ],
                },
              },
            },
          },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        });
      if (latest?.completedAt && latest.completedAt > cutoff) continue;
      eligible.push({
        brandProfileId: offering.brandProfileId,
        offeringId: offering.id,
        offeringUrl: offering.url,
        ownedWebsiteRoot: ownedWebsiteRoot(offering.brandProfile.domain),
        resourceRef: resource.resourceRef,
        lastSuccessfulAt: latest?.completedAt ?? null,
      });
    }
    return eligible;
  }
}

function ownedWebsiteRoot(domain: string): string {
  const candidate = /^https?:\/\//iu.test(domain)
    ? domain
    : `https://${domain}`;
  return new URL(candidate).origin;
}

import { Injectable } from "@nestjs/common";

import { BrandUceAccessService } from "./brand-uce-access.service";

/** Campaign Page consumes Reporting; it does not make legacy snapshots authoritative. */
@Injectable()
export class BrandUceReportingService {
  constructor(private readonly access: BrandUceAccessService) {}

  async getDashboard(brandProfileId: string, campaignId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    return {
      campaign_id: campaign.id,
      availability: "UNAVAILABLE" as const,
      message: "Reporting is not available for this Campaign yet.",
      metrics: null,
      freshness: null,
      finality: null,
    };
  }

  async forceRefreshSync(brandProfileId: string, campaignId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    return {
      campaign_id: campaign.id,
      availability: "UNAVAILABLE" as const,
      message: "Reporting is not available for this Campaign yet.",
    };
  }
}

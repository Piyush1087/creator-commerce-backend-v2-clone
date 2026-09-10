import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoneException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";

import { BrandUcePipelineService } from "../brand-uce/services/brand-uce-pipeline.service";
import { UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED } from "../brand-uce/utils/uce-campaign-collaboration-write.retired";
import { CreatorUceCampaignsService } from "../creator-uce/services/creator-uce-campaigns.service";
import { CreatorCampaignsCommandService } from "../creator-marketplace/services/creator-campaigns-command.service";
import { CreatorInvitationService } from "../creator-marketplace/services/creator-invitation.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreatorCampaignsPanicService } from "../creator-marketplace/services/creator-campaigns-panic.service";

const root = process.cwd();
const RETIRED = "OUT_OF_MVP_COMPETING_TRANSITION_RETIRED";

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const creator = { id: "user-1", email: "c@example.com", role: UserRole.CREATOR };

describe("OUT competing canonical transitions retired", () => {
  it("fail-closes Co-Pilot HITL Collaboration mutations in source", () => {
    const source = read(
      "src/features/co-pilot/services/co-pilot-hitl.service.ts",
    );
    expect(source).toContain(RETIRED);
    expect(source).toContain(
      "Co-Pilot cannot mutate Collaboration; use canonical Collaboration APIs",
    );
  });

  it("fail-closes leftover Brand Collab HTTP that C-04 already owns", () => {
    const source = read(
      "src/features/collaboration/collaboration.controller.ts",
    );
    expect(source).toContain(RETIRED);
    expect(source).toContain("retiredLegacyCollabTransition");
    expect(source).toContain("fulfillment/provide");
    expect(source).toContain("production/submit-deliverable");
  });

  it("fail-closes marketplace command and invitation writes before Prisma", async () => {
    const commands = new CreatorCampaignsCommandService(
      {} as PrismaService,
      {} as CreatorCampaignsPanicService,
    );
    const invitations = new CreatorInvitationService({} as PrismaService);

    await expect(
      commands.claimBrandInvitation(creator, {
        collaborationId: "00000000-0000-0000-0000-000000000001",
        creatorAction: "ACCEPT",
      }),
    ).rejects.toBeInstanceOf(GoneException);

    await expect(
      commands.confirmLogisticsReceipt(creator, {
        collaborationId: "00000000-0000-0000-0000-000000000001",
        isPackageDamaged: false,
        receivedConfirmation: true,
      }),
    ).rejects.toBeInstanceOf(GoneException);

    await expect(
      commands.submitContentDraft(creator, {
        collaborationId: "00000000-0000-0000-0000-000000000001",
        draftAssetUrl: "https://example.com/draft.mp4",
      }),
    ).rejects.toBeInstanceOf(GoneException);

    await expect(
      invitations.claimInvitation(creator, "invite-token"),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it("fail-closes Brand UCE pipeline and leftover creator-uce writes of UceCampaignCollaboration", async () => {
    const pipeline = new BrandUcePipelineService(
      {} as PrismaService,
      {} as never,
      {} as never,
      {} as never,
    );
    const creatorUce = new CreatorUceCampaignsService(
      {} as PrismaService,
      {} as never,
      {} as never,
    );

    await expect(
      pipeline.createProspect(
        "brand-1",
        "campaign-1",
        {
          instagram_handle: "creator",
          brief_id: "00000000-0000-0000-0000-000000000001",
        } as never,
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(GoneException);

    await expect(
      pipeline.approveApplicant(
        "brand-1",
        "campaign-1",
        "00000000-0000-0000-0000-000000000001",
        {} as never,
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(GoneException);

    await expect(
      creatorUce.applyToCampaign(creator, "campaign-1", {} as never),
    ).rejects.toBeInstanceOf(GoneException);

    const pipelineSource = read(
      "src/features/brand-uce/services/brand-uce-pipeline.service.ts",
    );
    const approveSource = read(
      "src/features/brand-uce/services/campaign-application.service.ts",
    );
    const helperSource = read(
      "src/features/brand-uce/utils/uce-campaign-collaboration-write.retired.ts",
    );
    expect(pipelineSource).toContain("retiredUceCampaignCollaborationWrite");
    expect(helperSource).toContain(UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED);
    expect(approveSource).not.toContain("uceCampaignCollaboration.update");
    expect(approveSource).not.toContain("uceCampaignCollaboration.create");
  });
});

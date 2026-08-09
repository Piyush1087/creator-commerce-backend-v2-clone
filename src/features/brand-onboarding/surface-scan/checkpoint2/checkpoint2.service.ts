import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandIntelligenceStage,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  BrandDnaSnapshotSchema,
  type BrandDnaSnapshot,
} from "../stage2/brand-dna.schema";
import type { ConfirmCheckpoint2Body } from "./confirm-checkpoint2.schema";

export type Checkpoint2Status = "ready" | "building" | "failed";

export type Checkpoint2Response = {
  leadId: string;
  brandProfileId: string | null;
  currentStage: BrandIntelligenceStage | null;
  brandDna: BrandDnaSnapshot | null;
  offerings: unknown[];
  competitors: unknown[];
  checkpoint2Confirmation: unknown | null;
  status: Checkpoint2Status;
};

/**
 * Checkpoint 2 — Surface Intelligence review (Brand DNA + offerings/competitors).
 * Offerings/competitors stay empty until Prompt B/C populate them.
 */
@Injectable()
export class Checkpoint2Service {
  private readonly logger = new Logger(Checkpoint2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async getByLeadId(leadId: string): Promise<Checkpoint2Response> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) {
      throw new NotFoundException("Discovery lead not found");
    }

    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: leadId },
    });

    if (!scan) {
      return {
        leadId,
        brandProfileId: null,
        currentStage: null,
        brandDna: null,
        offerings: [],
        competitors: [],
        checkpoint2Confirmation: null,
        status: "building",
      };
    }

    let brandDna: BrandDnaSnapshot | null = null;
    if (scan.brandDnaVerifiedSnapshot) {
      const parsed = BrandDnaSnapshotSchema.safeParse(
        scan.brandDnaVerifiedSnapshot,
      );
      if (parsed.success) {
        brandDna = parsed.data;
      } else {
        this.logger.warn(
          `checkpoint2.invalid_verified_snapshot leadId=${leadId}`,
        );
      }
    }

    return {
      leadId,
      brandProfileId: scan.brandProfileId,
      currentStage: scan.currentStage,
      brandDna,
      offerings: [],
      competitors: [],
      checkpoint2Confirmation: scan.checkpoint2Confirmation,
      status: this.resolveStatus(scan.currentStage, Boolean(brandDna)),
    };
  }

  async confirm(
    leadId: string,
    body: ConfirmCheckpoint2Body,
  ): Promise<{
    success: true;
    currentStage: BrandIntelligenceStage;
    checkpoint2Confirmation: unknown;
  }> {
    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: leadId },
    });
    if (!scan) {
      throw new NotFoundException(
        "Brand intelligence scan not found for this lead.",
      );
    }

    const dnaArchived =
      scan.currentStage === BrandIntelligenceStage.STAGE_2_BRAND_DNA_ARCHIVED ||
      scan.currentStage === BrandIntelligenceStage.CHECKPOINT_2_CONFIRMED ||
      Boolean(scan.brandDnaVerifiedSnapshot);

    const confirmation: Record<string, unknown> = {
      confirmed: true as const,
      brandDna:
        body.brandDna !== undefined
          ? body.brandDna
          : (scan.brandDnaVerifiedSnapshot ?? null),
      offerings: body.offerings ?? [],
      competitors: body.competitors ?? [],
      confirmedAt: new Date().toISOString(),
    };

    const nextStage = dnaArchived
      ? BrandIntelligenceStage.CHECKPOINT_2_CONFIRMED
      : scan.currentStage;

    const updated = await this.prisma.brandIntelligenceScan.update({
      where: { id: scan.id },
      data: {
        checkpoint2Confirmation:
          confirmation as unknown as Prisma.InputJsonValue,
        ...(dnaArchived
          ? { currentStage: BrandIntelligenceStage.CHECKPOINT_2_CONFIRMED }
          : {}),
      },
    });

    this.logger.log(
      `checkpoint2.confirm leadId=${leadId} scanId=${scan.id} dnaArchived=${dnaArchived} stage=${updated.currentStage}`,
    );

    return {
      success: true,
      currentStage: nextStage,
      checkpoint2Confirmation: confirmation,
    };
  }

  private resolveStatus(
    stage: BrandIntelligenceStage,
    hasVerifiedDna: boolean,
  ): Checkpoint2Status {
    if (
      stage === BrandIntelligenceStage.STAGE_1B_FAILED ||
      stage === BrandIntelligenceStage.STAGE_2_BRAND_DNA_FAILED ||
      stage === BrandIntelligenceStage.STAGE_2_NEEDS_REVIEW
    ) {
      return "failed";
    }
    if (
      stage === BrandIntelligenceStage.STAGE_2_BRAND_DNA_ARCHIVED ||
      stage === BrandIntelligenceStage.CHECKPOINT_2_CONFIRMED ||
      hasVerifiedDna
    ) {
      return "ready";
    }
    return "building";
  }
}

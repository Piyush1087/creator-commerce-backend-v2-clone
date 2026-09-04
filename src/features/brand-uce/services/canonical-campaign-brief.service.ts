import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  UceBriefStatus,
  UceCampaignAssetStatus,
  UceCampaignStatus,
  UceDeliverableFormat,
} from "@prisma/client";
import type { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreateCanonicalCampaignBriefDto,
  UpdateCanonicalCampaignBriefDto,
} from "../dto/canonical-campaign-brief.dto";
import {
  createCanonicalBriefDraftSchema,
  isCanonicalDeliverable,
  storedCanonicalBriefPublishSchema,
  updateCanonicalBriefDraftSchema,
  updatePublishedCanonicalBriefSchema,
  validateCanonicalDeliverableGraph,
  type CanonicalBriefDeliverableInput,
} from "../schemas/canonical-campaign-brief.schema";
import { BrandUceAccessService } from "./brand-uce-access.service";
import { CampaignLifecycleLockService } from "./campaign-lifecycle-lock.service";

const TERMINAL = new Set<UceCampaignStatus>([
  UceCampaignStatus.COMPLETED,
  UceCampaignStatus.ARCHIVED,
]);

const briefInclude = Prisma.validator<Prisma.CanonicalCampaignBriefInclude>()({
  campaignAsset: { select: { status: true } },
  deliverables: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  },
});

type CanonicalBriefRow = Prisma.CanonicalCampaignBriefGetPayload<{
  include: typeof briefInclude;
}>;

type MaterializedDeliverable =
  | {
      id: string;
      kind: "CANONICAL";
      value: Extract<CanonicalBriefDeliverableInput, { display_order: number }>;
    }
  | {
      id: string;
      kind: "LEGACY_COMPATIBILITY";
      value: Exclude<CanonicalBriefDeliverableInput, { display_order: number }>;
    };

@Injectable()
export class CanonicalCampaignBriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly campaignLock: CampaignLifecycleLockService,
  ) {}

  async list(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const rows = await this.prisma.canonicalCampaignBrief.findMany({
      where: { campaignAsset: { campaignId } },
      include: briefInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapCanonicalBrief);
  }

  async create(
    brandProfileId: string,
    campaignId: string,
    dto: CreateCanonicalCampaignBriefDto,
  ) {
    const input = parseOrBadRequest(
      createCanonicalBriefDraftSchema.safeParse(dto),
      "Canonical Brief Draft validation failed",
    );
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    await this.assertActiveAsset(campaignId, input.campaign_asset_id);

    const deliverables = materializeDeliverables(input.deliverables ?? []);
    validateMaterializedGraph(deliverables);
    const briefId = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
      await this.assertActiveAsset(campaignId, input.campaign_asset_id, tx);
      await tx.canonicalCampaignBrief.create({
        data: {
          id: briefId,
          campaignAssetId: input.campaign_asset_id,
          status: UceBriefStatus.DRAFT,
          creationSource: input.creation_source,
          briefName: input.brief_name ?? input.title ?? null,
          creativeIntent: input.creative_intent ?? null,
          creatorBrief: input.creator_brief ?? null,
          briefType: input.brief_type ?? null,
          platform: input.platform ?? null,
          briefLevelGuidance: optionalJson(input.brief_level_guidance),
          referenceContent: optionalJson(input.reference_content),
          usageRights: optionalJson(input.usage_rights),
          creatorRequirements: input.creator_requirements ?? null,
          legacyCreativeRequirements: input.creative_requirements ?? null,
        },
        select: { id: true },
      });
      await replaceDeliverablesByIdentity(tx, briefId, [], deliverables);
      return tx.canonicalCampaignBrief.findUniqueOrThrow({
        where: { id: briefId },
        include: briefInclude,
      });
    });
    return mapCanonicalBrief(row);
  }

  async update(
    brandProfileId: string,
    campaignId: string,
    briefId: string,
    dto: UpdateCanonicalCampaignBriefDto,
  ) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    const existing = await this.findOwnedBrief(campaignId, briefId);

    if (existing.status !== UceBriefStatus.DRAFT) {
      const presentational = parseOrBadRequest(
        updatePublishedCanonicalBriefSchema.safeParse(dto),
        "Published Brief update validation failed",
      );
      const row = await this.prisma.$transaction(async (tx) => {
        await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
        const locked = await this.findOwnedBrief(campaignId, briefId, tx);
        if (locked.status === UceBriefStatus.DRAFT) {
          throw new ConflictException(
            "The Brief lifecycle changed while the update was waiting.",
          );
        }
        return tx.canonicalCampaignBrief.update({
          where: { id: briefId },
          data: {
            briefName: presentational.brief_name,
            creativeIntent: presentational.creative_intent,
            creatorBrief: presentational.creator_brief,
            creatorRequirements: presentational.creator_requirements,
          },
          include: briefInclude,
        });
      });
      return mapCanonicalBrief(row);
    }

    const input = parseOrBadRequest(
      updateCanonicalBriefDraftSchema.safeParse(dto),
      "Canonical Brief Draft validation failed",
    );
    const deliverables = input.deliverables
      ? materializeDeliverables(input.deliverables)
      : null;
    if (deliverables) validateMaterializedGraph(deliverables);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
      const locked = await this.findOwnedBrief(campaignId, briefId, tx);
      if (locked.status !== UceBriefStatus.DRAFT) {
        throw new ConflictException(
          "The Brief lifecycle changed while the update was waiting.",
        );
      }
      if (deliverables) {
        await replaceDeliverablesByIdentity(
          tx,
          briefId,
          locked.deliverables.map((item) => item.id),
          deliverables,
        );
      }
      return tx.canonicalCampaignBrief.update({
        where: { id: briefId },
        data: {
          briefName: input.brief_name ?? input.title,
          creativeIntent: input.creative_intent,
          creatorBrief: input.creator_brief,
          briefType: input.brief_type,
          platform: input.platform,
          briefLevelGuidance: optionalJson(input.brief_level_guidance),
          referenceContent: optionalJson(input.reference_content),
          usageRights: optionalJson(input.usage_rights),
          creatorRequirements: input.creator_requirements,
          legacyCreativeRequirements: input.creative_requirements,
        },
        include: briefInclude,
      });
    });
    return mapCanonicalBrief(row);
  }

  async publish(brandProfileId: string, campaignId: string, briefId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    const existing = await this.findOwnedBrief(campaignId, briefId);
    if (existing.status !== UceBriefStatus.DRAFT) {
      throw new ConflictException("Only a DRAFT Brief can be published.");
    }
    await this.assertActiveAsset(campaignId, existing.campaignAssetId);
    await this.assertInstagramEnabled(campaignId);
    assertPublishable(existing);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
      const locked = await this.findOwnedBrief(campaignId, briefId, tx);
      if (locked.status !== UceBriefStatus.DRAFT) {
        throw new ConflictException("Only a DRAFT Brief can be published.");
      }
      await this.assertActiveAsset(campaignId, locked.campaignAssetId, tx);
      await this.assertInstagramEnabled(campaignId, tx);
      assertPublishable(locked);
      return tx.canonicalCampaignBrief.update({
        where: { id: briefId },
        data: {
          status: UceBriefStatus.PUBLISHED,
          publishedAt: locked.publishedAt ?? new Date(),
          pausedAt: null,
        },
        include: briefInclude,
      });
    });
    return mapCanonicalBrief(row);
  }

  async pause(brandProfileId: string, campaignId: string, briefId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    const existing = await this.findOwnedBrief(campaignId, briefId);
    if (existing.status !== UceBriefStatus.PUBLISHED) {
      throw new ConflictException("Only a PUBLISHED Brief can be paused.");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
      const locked = await this.findOwnedBrief(campaignId, briefId, tx);
      if (locked.status !== UceBriefStatus.PUBLISHED) {
        throw new ConflictException("Only a PUBLISHED Brief can be paused.");
      }
      return tx.canonicalCampaignBrief.update({
        where: { id: briefId },
        data: { status: UceBriefStatus.PAUSED, pausedAt: new Date() },
        include: briefInclude,
      });
    });
    return mapCanonicalBrief(row);
  }

  async resume(brandProfileId: string, campaignId: string, briefId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    const existing = await this.findOwnedBrief(campaignId, briefId);
    if (existing.status !== UceBriefStatus.PAUSED) {
      throw new ConflictException("Only a PAUSED Brief can be resumed.");
    }
    await this.assertActiveAsset(campaignId, existing.campaignAssetId);
    await this.assertInstagramEnabled(campaignId);
    assertPublishable(existing);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAndAssertWritable(tx, brandProfileId, campaignId);
      const locked = await this.findOwnedBrief(campaignId, briefId, tx);
      if (locked.status !== UceBriefStatus.PAUSED) {
        throw new ConflictException("Only a PAUSED Brief can be resumed.");
      }
      await this.assertActiveAsset(campaignId, locked.campaignAssetId, tx);
      await this.assertInstagramEnabled(campaignId, tx);
      assertPublishable(locked);
      return tx.canonicalCampaignBrief.update({
        where: { id: briefId },
        data: { status: UceBriefStatus.PUBLISHED, pausedAt: null },
        include: briefInclude,
      });
    });
    return mapCanonicalBrief(row);
  }

  private async findOwnedBrief(
    campaignId: string,
    briefId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const row = await client.canonicalCampaignBrief.findFirst({
      where: { id: briefId, campaignAsset: { campaignId } },
      include: briefInclude,
    });
    if (!row) throw new NotFoundException("Brief not found");
    return row;
  }

  private async assertActiveAsset(
    campaignId: string,
    assetId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const asset = await client.uceCampaignAsset.findFirst({
      where: {
        id: assetId,
        campaignId,
        status: UceCampaignAssetStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException(
        "Select an active Campaign Asset from this Campaign before creating or publishing a Brief.",
      );
    }
  }

  private async assertInstagramEnabled(
    campaignId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const strategy = await client.uceCampaignStrategy.findUnique({
      where: { campaignId },
      select: { platforms: true },
    });
    if (!strategy?.platforms.includes("INSTAGRAM")) {
      throw new ConflictException(
        "The Campaign must canonically enable INSTAGRAM before publishing this Brief.",
      );
    }
  }

  private assertWritable(status: UceCampaignStatus) {
    if (TERMINAL.has(status)) {
      throw new ConflictException("This Campaign is read-only.");
    }
  }

  private async lockAndAssertWritable(
    tx: Prisma.TransactionClient,
    brandProfileId: string,
    campaignId: string,
  ) {
    await this.campaignLock.lockCampaign(tx, campaignId);
    const campaign = await tx.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { status: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    this.assertWritable(campaign.status);
  }
}

function parseOrBadRequest<T>(
  result: z.SafeParseReturnType<unknown, T>,
  message: string,
): T {
  if (!result.success) {
    throw new BadRequestException({ message, issues: result.error.issues });
  }
  return result.data;
}

function optionalJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function materializeDeliverables(
  inputs: CanonicalBriefDeliverableInput[],
): MaterializedDeliverable[] {
  return inputs.map((value) => ({
    id: value.deliverable_id ?? randomUUID(),
    kind: isCanonicalDeliverable(value)
      ? ("CANONICAL" as const)
      : ("LEGACY_COMPATIBILITY" as const),
    value,
  })) as MaterializedDeliverable[];
}

function validateMaterializedGraph(deliverables: MaterializedDeliverable[]) {
  const canonical = deliverables
    .filter(
      (item): item is Extract<MaterializedDeliverable, { kind: "CANONICAL" }> =>
        item.kind === "CANONICAL",
    )
    .map((item) => ({ ...item.value, deliverable_id: item.id }));
  try {
    validateCanonicalDeliverableGraph(canonical);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "INVALID_DELIVERABLE_GRAPH",
    );
  }
}

function deliverableCreateData(item: MaterializedDeliverable) {
  if (item.kind === "CANONICAL") {
    return {
      id: item.id,
      format: item.value.format,
      displayOrder: item.value.display_order,
      configuration: optionalJson(item.value.configuration),
      creativeGuidance: optionalJson(item.value.creative_guidance),
      amplifyTargetDeliverableId:
        item.value.amplify_target_deliverable_id ?? null,
    };
  }
  return {
    id: item.id,
    legacyFormat: item.value.format,
    legacyQuantity: item.value.quantity,
    legacyCreativeRequirements: item.value.creative_requirements,
    legacyPublishingRequired: item.value.publishing_required,
  };
}

async function replaceDeliverablesByIdentity(
  tx: Prisma.TransactionClient,
  briefId: string,
  existingIds: string[],
  deliverables: MaterializedDeliverable[],
) {
  const nextIds = new Set(deliverables.map((item) => item.id));
  const removedIds = existingIds.filter((id) => !nextIds.has(id));
  if (removedIds.length) {
    await tx.canonicalBriefDeliverable.updateMany({
      where: { briefId, id: { in: removedIds } },
      data: { amplifyTargetDeliverableId: null },
    });
    await tx.canonicalBriefDeliverable.deleteMany({
      where: { briefId, id: { in: removedIds } },
    });
  }

  const existing = new Set(existingIds);
  for (const item of deliverables) {
    const data = deliverableCreateData(item);
    const { id: deliverableId, ...withoutId } = data;
    const withoutTarget = {
      ...withoutId,
      amplifyTargetDeliverableId: null,
    };
    if (existing.has(item.id)) {
      await tx.canonicalBriefDeliverable.update({
        where: { id: item.id },
        data:
          item.kind === "CANONICAL"
            ? {
                ...withoutTarget,
                legacyFormat: null,
                legacyQuantity: null,
                legacyCreativeRequirements: null,
                legacyPublishingRequired: null,
              }
            : {
                ...withoutTarget,
                format: null,
                displayOrder: null,
                configuration: Prisma.DbNull,
                creativeGuidance: Prisma.DbNull,
              },
      });
    } else {
      await tx.canonicalBriefDeliverable.create({
        data: { ...withoutTarget, id: deliverableId, briefId },
      });
    }
  }

  for (const item of deliverables) {
    if (item.kind === "CANONICAL" && item.value.amplify_target_deliverable_id) {
      await tx.canonicalBriefDeliverable.update({
        where: { id: item.id },
        data: {
          amplifyTargetDeliverableId: item.value.amplify_target_deliverable_id,
        },
      });
    }
  }
}

function publishValidation(row: CanonicalBriefRow) {
  const result = storedCanonicalBriefPublishSchema.safeParse({
    briefName: row.briefName,
    creativeIntent: row.creativeIntent,
    creatorBrief: row.creatorBrief,
    briefType: row.briefType,
    platform: row.platform,
    briefLevelGuidance: row.briefLevelGuidance,
    referenceContent: row.referenceContent,
    usageRights: row.usageRights,
    creatorRequirements: row.creatorRequirements,
    deliverables: row.deliverables.map((item) => ({
      id: item.id,
      format: item.format,
      displayOrder: item.displayOrder,
      configuration: item.configuration,
      creativeGuidance: item.creativeGuidance,
      amplifyTargetDeliverableId: item.amplifyTargetDeliverableId,
    })),
  });
  const missingRequirements = result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  return { result, missingRequirements };
}

function assertPublishable(row: CanonicalBriefRow) {
  const validation = publishValidation(row);
  if (!validation.result.success) {
    throw new BadRequestException({
      message: "Canonical Brief publish validation failed",
      missing_requirements: validation.missingRequirements,
      issues: validation.result.error.issues,
    });
  }
  try {
    validateCanonicalDeliverableGraph(
      validation.result.data.deliverables.map((item) => ({
        deliverable_id: item.id,
        format: item.format,
        display_order: item.displayOrder,
        configuration: item.configuration,
        creative_guidance: item.creativeGuidance,
        amplify_target_deliverable_id: item.amplifyTargetDeliverableId,
      })),
    );
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "INVALID_DELIVERABLE_GRAPH",
    );
  }
}

export function mapCanonicalBrief(row: CanonicalBriefRow) {
  const validation = publishValidation(row);
  const assetActive =
    row.campaignAsset.status === UceCampaignAssetStatus.ACTIVE;
  const ready =
    row.status === UceBriefStatus.PUBLISHED &&
    assetActive &&
    validation.result.success;
  const deliverables = row.deliverables.map((item) => ({
    deliverable_id: item.id,
    format: item.format ?? item.legacyFormat,
    canonical_format: item.format,
    display_order: item.displayOrder,
    configuration: item.configuration,
    creative_guidance: item.creativeGuidance,
    amplify_target_deliverable_id: item.amplifyTargetDeliverableId,
    quantity: item.legacyQuantity,
    creative_requirements: item.legacyCreativeRequirements,
    publishing_required: item.legacyPublishingRequired,
    authority: item.format
      ? ("C03_CANONICAL" as const)
      : ("LEGACY_COMPATIBILITY" as const),
  }));

  return {
    brief_id: row.id,
    campaign_asset_id: row.campaignAssetId,
    status: row.status,
    creation_source: row.creationSource,
    brief_name: row.briefName,
    creative_intent: row.creativeIntent,
    creator_brief: row.creatorBrief,
    brief_type: row.briefType,
    platform: row.platform,
    brief_level_guidance: row.briefLevelGuidance,
    reference_content: row.referenceContent,
    usage_rights: row.usageRights,
    creator_requirements: row.creatorRequirements,
    published_at: row.publishedAt?.toISOString() ?? null,
    paused_at: row.pausedAt?.toISOString() ?? null,
    title: row.briefName,
    creative_requirements: row.legacyCreativeRequirements,
    is_active: row.legacyIsActive,
    deliverables,
    readiness: {
      ready,
      missing_requirements: [
        ...(assetActive ? [] : ["campaign_asset"]),
        ...(row.status === UceBriefStatus.PUBLISHED ? [] : ["status"]),
        ...validation.missingRequirements,
      ],
    },
    created_at: row.createdAt.toISOString(),
  };
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type CreatorMediaKit } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { CreatorBrandService } from "../creator-brand/creator-brand.service";
import { AudienceV1ConsumerService } from "../creator-audience-v1/creator-audience-v1.consumer.service";
import { CreatorContentService } from "../creator-content/creator-content.service";
import { RateCardService } from "../creator-commercial-setup/rate-card/rate-card.service";
import { WorkPreferencesService } from "../creator-commercial-setup/work-preferences/work-preferences.service";
import { PortfolioService } from "../creator-portfolio/portfolio.service";
import { CreatorBusinessEmailProjectionService } from "../creator-settings/services/creator-business-email-projection.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import {
  assertCreatorWorkspaceAction,
  lockCreatorTeam,
} from "../creator-settings/team/creator-team.policy";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  CREATOR_MEDIA_KIT_CONTRACT_VERSION,
  CREATOR_MEDIA_KIT_PUBLIC_CONTRACT_VERSION,
  CREATOR_MEDIA_KIT_VERIFIED_CONTRACT_VERSION,
  CreatorMediaKitMutationSchema,
  MediaKitIdentitySchema,
  MediaKitPublicShellSchema,
  MediaKitPublicVisualSchema,
  type CreatorMediaKitMutation,
} from "./contracts/creator-media-kit.contract";

const CTA = [
  {
    action: "WORK_WITH_CREATOR",
    label: "Work with Creator",
    subtext: "Start a collaboration",
  },
  {
    action: "REVEAL_EMAIL_ID",
    label: "Reveal Email ID",
    subtext: "Agencies and email enquiries",
  },
] as const;

type KitActor = CreatorWorkspaceActorContext;

@Injectable()
export class CreatorMediaKitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly brand: CreatorBrandService,
    private readonly audience: AudienceV1ConsumerService,
    private readonly content: CreatorContentService,
    private readonly portfolio: PortfolioService,
    private readonly preferences: WorkPreferencesService,
    private readonly rateCard: RateCardService,
    private readonly businessEmail: CreatorBusinessEmailProjectionService,
    private readonly brandWorkspace: BrandWorkspaceAuthorizationService,
  ) {}

  async readCreator(
    user: AuthUser,
    preview: "PUBLIC" | "VERIFIED" = "VERIFIED",
  ) {
    const actor = await this.actors.resolveReadOnly(user);
    assertCreatorWorkspaceAction(actor.allowedActions, "MEDIA_KIT_READ");
    const kit = await this.ensureDraft(actor);
    const composition = await this.composeForCreator(user, actor, kit);
    return {
      contractVersion: CREATOR_MEDIA_KIT_CONTRACT_VERSION,
      actorRole: actor.actorRole,
      allowedActions: actor.allowedActions.filter((action) =>
        action.startsWith("MEDIA_KIT_"),
      ),
      configuration: this.configuration(kit),
      preview:
        preview === "PUBLIC"
          ? this.publicShellFromComposition(kit, composition.identity)
          : composition,
    };
  }

  async mutate(user: AuthUser, input: unknown) {
    const command = CreatorMediaKitMutationSchema.parse(input);
    const initialActor = await this.actors.resolveReadOnly(user);
    assertCreatorWorkspaceAction(
      initialActor.allowedActions,
      command.intent === "UPDATE_CONFIGURATION"
        ? "MEDIA_KIT_MANAGE"
        : "MEDIA_KIT_PUBLISH",
    );
    await this.ensureDraft(initialActor);

    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, initialActor.workspaceId);
        const actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
        if (
          actor.workspaceId !== initialActor.workspaceId ||
          actor.subjectCreatorProfileId !== initialActor.subjectCreatorProfileId
        )
          throw new ConflictException({
            code: "MEDIA_KIT_SUBJECT_CHANGED",
          });
        assertCreatorWorkspaceAction(
          actor.allowedActions,
          command.intent === "UPDATE_CONFIGURATION"
            ? "MEDIA_KIT_MANAGE"
            : "MEDIA_KIT_PUBLISH",
        );
        await tx.$queryRaw`SELECT id FROM creator_media_kits WHERE workspace_id = ${actor.workspaceId} FOR UPDATE`;
        const kit = await tx.creatorMediaKit.findUniqueOrThrow({
          where: { workspaceId: actor.workspaceId },
        });
        const commandHash = this.commandHash(actor, command);
        const replay = await tx.creatorMediaKitRevision.findUnique({
          where: {
            mediaKitId_idempotencyKey: {
              mediaKitId: kit.id,
              idempotencyKey: command.idempotencyKey,
            },
          },
        });
        if (replay) {
          if (replay.commandHash !== commandHash)
            throw new ConflictException({
              code: "MEDIA_KIT_IDEMPOTENCY_CONFLICT",
            });
          return {
            contractVersion: CREATOR_MEDIA_KIT_CONTRACT_VERSION,
            configuration: this.configuration(kit),
            reused: true,
          };
        }
        if (kit.currentRevision !== command.expectedRevision)
          throw new ConflictException({
            code: "MEDIA_KIT_REVISION_CONFLICT",
            currentRevision: kit.currentRevision,
          });

        if (command.intent === "UPDATE_CONFIGURATION")
          await this.assertPortfolioSelection(tx, actor, command);
        if (command.intent === "PUBLISH")
          await this.assertPublishablePortfolioSelection(tx, actor, kit);

        const revision = kit.currentRevision + 1;
        const now = new Date();
        const data =
          command.intent === "UPDATE_CONFIGURATION"
            ? {
                showAudience: command.visibility.audience,
                showContent: command.visibility.content,
                showPortfolio: command.visibility.portfolio,
                showRateCard: command.visibility.rateCard,
                publicVisuals:
                  command.publicVisuals as unknown as Prisma.InputJsonArray,
                featuredPortfolioItemIds: command.featuredPortfolioItemIds,
                currentRevision: revision,
              }
            : command.intent === "PUBLISH"
              ? {
                  lifecycle: "LIVE" as const,
                  publishedAt: now,
                  publishedByUserId: actor.actorUserId,
                  unpublishedAt: null,
                  unpublishedByUserId: null,
                  currentRevision: revision,
                }
              : {
                  lifecycle: "DRAFT" as const,
                  unpublishedAt: now,
                  unpublishedByUserId: actor.actorUserId,
                  currentRevision: revision,
                };
        const updated = await tx.creatorMediaKit.update({
          where: { id: kit.id },
          data,
        });
        await tx.creatorMediaKitRevision.create({
          data: {
            mediaKitId: kit.id,
            revision,
            previousRevision: revision - 1,
            snapshot: this.configuration(
              updated,
            ) as unknown as Prisma.InputJsonObject,
            actorUserId: actor.actorUserId,
            actorMembershipId: actor.actorMembershipId,
            actorRole: actor.actorRole,
            intent: command.intent,
            idempotencyKey: command.idempotencyKey,
            commandHash,
          },
        });
        return {
          contractVersion: CREATOR_MEDIA_KIT_CONTRACT_VERSION,
          configuration: this.configuration(updated),
          reused: false,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15_000,
      },
    );
  }

  async readPublic(publicId: string) {
    const kit = await this.liveKit(publicId);
    const identity = await this.readIdentity(kit.ownerProfileId);
    void this.recordEventBestEffort(kit, "KIT_VIEW");
    return this.publicShellFromComposition(kit, identity);
  }

  async readVerified(user: AuthUser, publicId: string) {
    const brandContext =
      await this.brandWorkspace.resolveBrandContextReadOnly(user);
    const verified = await this.prisma.brandProfile.findUnique({
      where: { id: brandContext.brandProfileId },
      select: { id: true, isVerified: true, organizationId: true },
    });
    if (
      !verified?.isVerified ||
      !verified.organizationId ||
      verified.organizationId !== user.organizationId
    )
      throw new ForbiddenException("Verified Brand access required");
    const kit = await this.liveKit(publicId);
    const projection = await this.composeDirect(kit, verified.id);
    void this.recordEventBestEffort(kit, "KIT_VIEW", verified.id);
    return {
      ...projection,
      contractVersion: CREATOR_MEDIA_KIT_VERIFIED_CONTRACT_VERSION,
    };
  }

  async revealEmail(publicId: string) {
    const kit = await this.liveKit(publicId);
    const result = await this.businessEmail.readForCanonicalCreator(
      kit.ownerProfileId,
    );
    void this.recordEventBestEffort(kit, "REVEAL_EMAIL_ID_CLICK");
    return result;
  }

  async recordPublicEvent(publicId: string, eventType: string) {
    const kit = await this.liveKit(publicId);
    if (
      ![
        "KIT_VIEW",
        "PUBLIC_THUMBNAIL_SOURCE_OPENED",
        "WORK_WITH_CREATOR_CLICK",
        "REVEAL_EMAIL_ID_CLICK",
      ].includes(eventType)
    )
      throw new ForbiddenException("Public event is not admitted");
    await this.recordEventBestEffort(kit, eventType);
    return {
      accepted: true,
      terminal: eventType === "WORK_WITH_CREATOR_CLICK",
    };
  }

  async recordCreatorPdf(user: AuthUser) {
    const actor = await this.actors.resolveReadOnly(user);
    assertCreatorWorkspaceAction(
      actor.allowedActions,
      "MEDIA_KIT_PDF_DOWNLOAD",
    );
    const kit = await this.ensureDraft(actor);
    const projection = await this.composeForCreator(user, actor, kit);
    await this.recordEventBestEffort(kit, "MEDIA_KIT_PDF_DOWNLOAD");
    return {
      contractVersion: "creator-media-kit-pdf-v3.1",
      generatedOn: new Date().toISOString(),
      publicId: kit.publicId,
      projection,
    };
  }

  async recordVerifiedPdf(user: AuthUser, publicId: string) {
    const projection = await this.readVerified(user, publicId);
    const { contractVersion: _verifiedContractVersion, ...snapshot } =
      projection;
    const kit = await this.liveKit(publicId);
    await this.recordEventBestEffort(
      kit,
      "MEDIA_KIT_PDF_DOWNLOAD",
      projection.viewer.brandId,
    );
    return {
      contractVersion: "creator-media-kit-pdf-v3.1",
      generatedOn: new Date().toISOString(),
      publicId,
      projection: snapshot,
    };
  }

  async readLegacyLiveForCreatorProfile(creatorProfileId: string) {
    const kit = await this.prisma.creatorMediaKit.findUnique({
      where: { ownerProfileId: creatorProfileId },
    });
    if (!kit || kit.lifecycle !== "LIVE")
      throw new NotFoundException("Creator media kit not found");
    return this.readPublic(kit.publicId);
  }

  private async ensureDraft(actor: KitActor) {
    return this.prisma.creatorMediaKit.upsert({
      where: { workspaceId: actor.workspaceId },
      create: {
        workspaceId: actor.workspaceId,
        ownerProfileId: actor.subjectCreatorProfileId,
        publicId: randomBytes(16).toString("hex"),
        lifecycle: "DRAFT",
      },
      update: {},
    });
  }

  private async liveKit(publicId: string) {
    if (!/^[a-z0-9]{24,64}$/u.test(publicId))
      throw new NotFoundException("Creator media kit not found");
    const kit = await this.prisma.creatorMediaKit.findUnique({
      where: { publicId },
    });
    if (!kit || kit.lifecycle !== "LIVE")
      throw new NotFoundException("Creator media kit not found");
    return kit;
  }

  private configuration(kit: CreatorMediaKit) {
    return {
      lifecycle: kit.lifecycle,
      publicId: kit.publicId,
      publicPath: `/media-kit/${kit.publicId}`,
      revision: kit.currentRevision,
      visibility: {
        audience: kit.showAudience,
        content: kit.showContent,
        portfolio: kit.showPortfolio,
        rateCard: kit.showRateCard,
      },
      publicVisuals: this.visuals(kit),
      featuredPortfolioItemIds: kit.featuredPortfolioItemIds,
      publishedAt: kit.publishedAt?.toISOString() ?? null,
      unpublishedAt: kit.unpublishedAt?.toISOString() ?? null,
    };
  }

  private visuals(kit: CreatorMediaKit) {
    const result = MediaKitPublicVisualSchema.array()
      .max(3)
      .safeParse(kit.publicVisuals);
    return result.success ? result.data : [];
  }

  private commandHash(actor: KitActor, command: CreatorMediaKitMutation) {
    return createHash("sha256")
      .update(
        JSON.stringify([
          CREATOR_MEDIA_KIT_CONTRACT_VERSION,
          actor.actorUserId,
          actor.actorMembershipId,
          command,
        ]),
      )
      .digest("hex");
  }

  private async assertPortfolioSelection(
    tx: Prisma.TransactionClient,
    actor: KitActor,
    command: Extract<
      CreatorMediaKitMutation,
      { intent: "UPDATE_CONFIGURATION" }
    >,
  ) {
    const ids = command.featuredPortfolioItemIds;
    const aggregate = await tx.creatorPortfolio.findUnique({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, ownerProfileId: true },
    });
    const eligible = aggregate
      ? await tx.creatorPortfolioItem.findMany({
          where: { portfolioId: aggregate.id, state: "INCLUDED" },
          select: { id: true },
        })
      : [];
    if (
      aggregate?.ownerProfileId !== undefined &&
      aggregate.ownerProfileId !== actor.subjectCreatorProfileId
    )
      throw new ConflictException({
        code: "MEDIA_KIT_PORTFOLIO_SUBJECT_MISMATCH",
      });
    const eligibleIds = new Set(eligible.map((item) => item.id));
    if (ids.some((id) => !eligibleIds.has(id)))
      throw new ConflictException({
        code: "MEDIA_KIT_PORTFOLIO_ITEM_INELIGIBLE",
      });
  }

  private async assertPublishablePortfolioSelection(
    tx: Prisma.TransactionClient,
    actor: KitActor,
    kit: CreatorMediaKit,
  ) {
    if (!kit.showPortfolio || kit.featuredPortfolioItemIds.length === 0) return;
    const aggregate = await tx.creatorPortfolio.findUnique({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, ownerProfileId: true },
    });
    if (
      !aggregate ||
      aggregate.ownerProfileId !== actor.subjectCreatorProfileId
    )
      throw new ConflictException({
        code: "MEDIA_KIT_PORTFOLIO_SUBJECT_MISMATCH",
      });
    const eligibleIds = new Set(
      (
        await tx.creatorPortfolioItem.findMany({
          where: { portfolioId: aggregate.id, state: "INCLUDED" },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    if (kit.featuredPortfolioItemIds.some((id) => !eligibleIds.has(id)))
      throw new ConflictException({
        code: "MEDIA_KIT_PORTFOLIO_ITEM_INELIGIBLE",
      });
    if (eligibleIds.size >= 4 && kit.featuredPortfolioItemIds.length < 4)
      throw new ConflictException({
        code: "MEDIA_KIT_PORTFOLIO_SELECTION_REQUIRES_FOUR_TO_SIX",
      });
  }

  private async readIdentity(ownerProfileId: string) {
    const profile = await this.prisma.creatorProfile.findUniqueOrThrow({
      where: { id: ownerProfileId },
      select: {
        displayName: true,
        avatarUrl: true,
        instagramHandle: true,
        user: { select: { name: true } },
        creatorBrandProfiles: {
          orderBy: { currentRevision: "desc" },
          take: 1,
          select: { snapshot: true },
        },
      },
    });
    const brand = record(profile.creatorBrandProfiles[0]?.snapshot);
    return MediaKitIdentitySchema.parse({
      name: profile.displayName ?? profile.user.name,
      avatarUrl: safeUrl(profile.avatarUrl),
      instagramHandle: profile.instagramHandle,
      headline: textOrNull(brand.headline, 160),
      bio: textOrNull(brand.commercialBio, 1000),
      niches: textArray(brand.primaryNicheIds, 6),
      visualStyle: textArray(brand.visualStyleDescriptors, 6),
    });
  }

  private publicShellFromComposition(
    kit: CreatorMediaKit,
    identity: Awaited<ReturnType<CreatorMediaKitService["readIdentity"]>>,
  ) {
    if (kit.lifecycle !== "LIVE")
      return {
        state: "DRAFT" as const,
        publicId: kit.publicId,
        identity,
        visuals: this.visuals(kit),
        callsToAction: CTA,
      };
    return MediaKitPublicShellSchema.parse({
      contractVersion: CREATOR_MEDIA_KIT_PUBLIC_CONTRACT_VERSION,
      publicId: kit.publicId,
      lifecycle: "LIVE",
      identity,
      visuals: this.visuals(kit),
      callsToAction: CTA,
    });
  }

  private async composeForCreator(
    user: AuthUser,
    actor: KitActor,
    kit: CreatorMediaKit,
  ) {
    const [
      identity,
      brand,
      audience,
      content,
      portfolio,
      preferences,
      rateCard,
    ] = await Promise.all([
      this.readIdentity(actor.subjectCreatorProfileId),
      safeRead(() => this.brand.read(user)),
      safeRead(() => this.audience.read(user)),
      safeRead(() => this.content.read(user)),
      safeRead(() => this.portfolio.read(user, {})),
      safeRead(() => this.preferences.read(user)),
      safeRead(() => this.rateCard.read(user)),
    ]);
    return {
      state: kit.lifecycle,
      identity,
      sections: {
        audience: kit.showAudience ? minimizeAudience(audience) : null,
        content: kit.showContent ? minimizeContent(content) : null,
        portfolio: kit.showPortfolio
          ? minimizePortfolio(portfolio, kit.featuredPortfolioItemIds)
          : null,
        rateCard: kit.showRateCard ? minimizeRateCard(rateCard) : null,
        availability: minimizeAvailability(preferences),
      },
      callsToAction: CTA,
      viewer: { kind: "CREATOR", role: actor.actorRole },
    };
  }

  private async composeDirect(kit: CreatorMediaKit, verifiedBrandId: string) {
    const owner = await this.prisma.creatorProfile.findUniqueOrThrow({
      where: { id: kit.ownerProfileId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });
    const ownerAuth: AuthUser = owner.user;
    const [identity, audience, content, portfolio, preferences, rateCard] =
      await Promise.all([
        this.readIdentity(kit.ownerProfileId),
        safeRead(() => this.audience.read(ownerAuth)),
        safeRead(() => this.content.read(ownerAuth)),
        this.prisma.creatorPortfolio.findUnique({
          where: { workspaceId: kit.workspaceId },
          include: { items: { where: { state: "INCLUDED" } } },
        }),
        this.prisma.creatorWorkPreferences.findUnique({
          where: { workspaceId: kit.workspaceId },
        }),
        this.prisma.creatorRateCard.findUnique({
          where: { workspaceId: kit.workspaceId },
        }),
      ]);
    return {
      state: "LIVE",
      publicId: kit.publicId,
      identity,
      sections: {
        audience: kit.showAudience ? minimizeAudience(audience) : null,
        content: kit.showContent ? minimizeContent(content) : null,
        portfolio: kit.showPortfolio
          ? {
              state: portfolio ? "AVAILABLE" : "UNAVAILABLE",
              items:
                portfolio?.items
                  .filter((item) =>
                    kit.featuredPortfolioItemIds.includes(item.id),
                  )
                  .sort(
                    (left, right) =>
                      kit.featuredPortfolioItemIds.indexOf(left.id) -
                      kit.featuredPortfolioItemIds.indexOf(right.id),
                  )
                  .map((item) => ({
                    id: item.id,
                    title: item.title,
                    sourceDestination: item.destination,
                    kind: item.kind,
                  })) ?? [],
            }
          : null,
        rateCard:
          kit.showRateCard && rateCard
            ? directRateCard(rateCard)
            : kit.showRateCard
              ? { state: "UNAVAILABLE", currency: null, lines: [] }
              : null,
        availability: preferences
          ? {
              state: "AVAILABLE",
              basedIn: preferences.baseCountry,
              availability: preferences.availability,
              pausedUntil: preferences.pausedUntil?.toISOString() ?? null,
            }
          : { state: "UNAVAILABLE", basedIn: null, availability: null },
      },
      callsToAction: CTA,
      viewer: {
        kind: "VERIFIED_BRAND",
        brandId: verifiedBrandId,
      },
    };
  }

  private async recordEventBestEffort(
    kit: CreatorMediaKit,
    eventType: string,
    recognizedBrandId?: string,
  ) {
    try {
      await this.prisma.creatorMediaKitEvent.create({
        data: {
          mediaKitId: kit.id,
          eventType: eventType as never,
          kitRevision: kit.currentRevision,
          recognizedBrandId,
        },
      });
    } catch {
      // Instrumentation is deliberately non-blocking.
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized.slice(0, max) : null;
}

function textArray(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value
        .flatMap((item) =>
          typeof item === "string" && item.trim() ? [item.trim()] : [],
        )
        .slice(0, max)
    : [];
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  const parsed =
    MediaKitPublicVisualSchema.shape.staticAssetUrl.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function safeRead<T>(read: () => Promise<T>) {
  try {
    return { state: "AVAILABLE" as const, value: await read() };
  } catch {
    return { state: "UNAVAILABLE" as const, value: null };
  }
}

function minimizeAudience(source: Awaited<ReturnType<typeof safeRead>>) {
  if (source.state !== "AVAILABLE")
    return { state: "UNAVAILABLE", facts: [], observedAsOf: null };
  const value = record(source.value);
  const overview = record(value.overview);
  const facts = Array.isArray(overview.facts)
    ? overview.facts.slice(0, 8).map((item) => {
        const fact = record(item);
        return {
          cohort: fact.cohort ?? null,
          dimension: fact.dimension ?? null,
          bucket: fact.bucket ?? null,
          count: fact.count ?? null,
          percentage: fact.percentage ?? null,
        };
      })
    : [];
  return {
    state: value.status ?? "UNAVAILABLE",
    facts,
    observedAsOf: record(value.freshness).capturedAt ?? null,
  };
}

function minimizeContent(source: Awaited<ReturnType<typeof safeRead>>) {
  if (source.state !== "AVAILABLE")
    return {
      state: "UNAVAILABLE",
      themes: [],
      performance: [],
      observedAsOf: null,
    };
  const value = record(source.value);
  const create = record(value.whatYouCreate);
  const performance = record(value.performance);
  return {
    state: value.status ?? "UNAVAILABLE",
    themes: Array.isArray(create.themes)
      ? create.themes.slice(0, 12).map((item) => {
          const theme = record(item);
          return {
            value: theme.value ?? null,
            postCount: theme.postCount ?? null,
          };
        })
      : [],
    performance: Array.isArray(performance.claims)
      ? performance.claims.slice(0, 6).map((item) => {
          const claim = record(item);
          return {
            cohort: claim.cohort ?? null,
            metric: claim.metric ?? null,
            direction: claim.direction ?? null,
            cohortSample: claim.cohortSample ?? null,
            complementSample: claim.complementSample ?? null,
          };
        })
      : [],
    representatives: Array.isArray(value.representatives)
      ? value.representatives.slice(0, 6).flatMap((item) => {
          const representative = record(item);
          return typeof representative.providerMediaId === "string" &&
            typeof representative.permalink === "string"
            ? [
                {
                  visualId: representative.providerMediaId,
                  sourceDestination: representative.permalink,
                  reason:
                    typeof representative.reason === "string"
                      ? representative.reason
                      : null,
                },
              ]
            : [];
        })
      : [],
    observedAsOf: record(value.freshness).capturedAt ?? null,
  };
}

function minimizePortfolio(
  source: Awaited<ReturnType<typeof safeRead>>,
  selectedIds: string[],
) {
  if (source.state !== "AVAILABLE")
    return { state: "UNAVAILABLE", items: [], eligibleItems: [] };
  const value = record(source.value);
  const items = Array.isArray(value.items) ? value.items : [];
  const selected = items
    .map(record)
    .filter((item) => selectedIds.includes(String(item.id)))
    .sort(
      (left, right) =>
        selectedIds.indexOf(String(left.id)) -
        selectedIds.indexOf(String(right.id)),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      sourceDestination: item.destination,
    }));
  return {
    state: "AVAILABLE",
    items: selected,
    eligibleItems: items.map(record).map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      sourceDestination: item.destination,
    })),
  };
}

function minimizeAvailability(source: Awaited<ReturnType<typeof safeRead>>) {
  if (source.state !== "AVAILABLE")
    return { state: "UNAVAILABLE", basedIn: null, availability: null };
  const value = record(source.value);
  const values = record(value.values);
  return {
    state: value.state === "CONFIGURED" ? "AVAILABLE" : "UNAVAILABLE",
    basedIn: values.baseCountry ?? null,
    availability: values.availability ?? null,
    pausedUntil: values.pausedUntil ?? null,
  };
}

function minimizeRateCard(source: Awaited<ReturnType<typeof safeRead>>) {
  if (source.state !== "AVAILABLE")
    return { state: "UNAVAILABLE", currency: null, lines: [] };
  const value = record(source.value);
  const values = record(value.values);
  const country = record(value.country);
  return {
    state: value.state ?? "UNAVAILABLE",
    currency: country.canonicalRateCardCurrency ?? null,
    startingFrom: true,
    lines: [
      "REEL_VIDEO",
      "STORY",
      "BANNER_CAROUSEL",
      "PHOTOSHOOT",
      "linkInBio",
      "paidAmplification",
    ].flatMap((key) => {
      const line = record(values[key]);
      return line.enabled === true && typeof line.amountMinor === "number"
        ? [{ key, amountMinor: line.amountMinor }]
        : [];
    }),
    standardConditions: true,
  };
}

function directRateCard(value: {
  currency: string;
  reelEnabled: boolean;
  reelAmountMinor: bigint | null;
  storyEnabled: boolean;
  storyAmountMinor: bigint | null;
  carouselEnabled: boolean;
  carouselAmountMinor: bigint | null;
  photoshootEnabled: boolean;
  photoshootAmountMinor: bigint | null;
  linkInBioEnabled: boolean;
  linkInBioAmountMinor: bigint | null;
  partnershipAdsEnabled: boolean;
  partnershipAdsAmountMinor: bigint | null;
}) {
  const rows = [
    ["REEL_VIDEO", value.reelEnabled, value.reelAmountMinor],
    ["STORY", value.storyEnabled, value.storyAmountMinor],
    ["BANNER_CAROUSEL", value.carouselEnabled, value.carouselAmountMinor],
    ["PHOTOSHOOT", value.photoshootEnabled, value.photoshootAmountMinor],
    ["linkInBio", value.linkInBioEnabled, value.linkInBioAmountMinor],
    [
      "paidAmplification",
      value.partnershipAdsEnabled,
      value.partnershipAdsAmountMinor,
    ],
  ] as const;
  return {
    state: "CURRENT",
    currency: value.currency,
    startingFrom: true,
    lines: rows.flatMap(([key, enabled, amount]) =>
      enabled && amount !== null
        ? [{ key, amountMinor: amount.toString() }]
        : [],
    ),
    standardConditions: true,
  };
}

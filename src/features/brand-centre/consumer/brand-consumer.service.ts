import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandVisualStateService } from "../../brand-canonical-state/brand-visual-state.service";
import { BrandLocationService } from "../../brand-canonical-state/brand-location.service";
import {
  CANONICAL_BRAND_STATE_READER,
  CANONICAL_BRAND_STATE_SEMANTICS,
  type CanonicalBrandStateReader,
} from "../../brand-intelligence/input/canonical-state/canonical-brand-state.port";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import {
  anchorField,
  applicationField,
  authorityPresentation,
  BRAND_CONSUMER_OBJECTS,
  intelligenceField,
} from "./brand-consumer.mapper";
import type { ConsumerRuntimeActivity } from "./brand-consumer.types";

@Injectable()
export class BrandConsumerService {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly prisma: PrismaService,
    @Inject(CANONICAL_BRAND_STATE_READER)
    private readonly canonical: CanonicalBrandStateReader,
    private readonly visuals: BrandVisualStateService,
    private readonly locations: BrandLocationService,
    private readonly intelligence: IntelligenceCurrentProjectionService,
  ) {}

  async read(user: AuthUser) {
    // Brand selection is exclusively derived from the authenticated organization.
    const brandId = await this.auth.resolveBrandProfileId(user);
    const [anchors, visual, locations, objects, execution, scan] =
      await Promise.all([
        this.canonical.read({
          brandId,
          requiredSemantics: CANONICAL_BRAND_STATE_SEMANTICS.filter(
            (key) => key !== "brand_logo",
          ),
        }),
        this.visuals.read(brandId),
        this.locations.read(brandId),
        Promise.all(
          BRAND_CONSUMER_OBJECTS.map((objectSemanticId) =>
            this.intelligence.readObject({ brandId, objectSemanticId }),
          ),
        ),
        this.prisma.intelligenceExecution.findFirst({
          where: { brandId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { status: true },
        }),
        this.prisma.brandCentreJob.findFirst({
          where: { brandProfileId: brandId, type: "DEEP_SCAN" },
          orderBy: [{ queuedAt: "desc" }, { id: "desc" }],
          select: { status: true },
        }),
      ]);
    const fields = Object.fromEntries(
      anchors.entries.map((entry) => [entry.semantic, anchorField(entry)]),
    );
    const projected = Object.fromEntries(
      objects.map((object) => [
        object.objectSemanticId,
        intelligenceField(object),
      ]),
    );
    const hasCurrent = objects.some(
      (object) => object.objectState !== "NO_CURRENT",
    );
    const active =
      execution?.status === "PENDING" ||
      execution?.status === "RUNNING" ||
      scan?.status === "QUEUED" ||
      scan?.status === "RUNNING";
    const runtimeActivity: ConsumerRuntimeActivity = active
      ? hasCurrent
        ? "REFRESHING"
        : "LEARNING"
      : execution?.status === "FAILED" || scan?.status === "FAILED"
        ? "TEMPORARILY_UNAVAILABLE"
        : "NONE";
    const itemMeta = (item: {
      id: string;
      authority: string;
      revision: number;
      lifecycle: string;
    }) => ({
      id: item.id,
      authority: authorityPresentation(item.authority),
      revision: item.revision,
      lifecycle: item.lifecycle,
    });
    const assetRef = (item: NonNullable<typeof visual>["assets"][number]) => ({
      ...itemMeta(item),
      url: item.url,
      label: item.label,
      role: item.role,
    });
    const fontRef = (
      item: NonNullable<typeof visual>["typography"][number],
    ) => ({
      ...itemMeta(item),
      family: item.family,
      label: item.label,
      usage: item.usage,
    });
    const fonts = visual?.typography ?? [];
    // Ambiguous font roles remain represented in typography, never choose an arbitrary winner.
    const fontFor = (usage: string) => {
      const found = fonts.filter((item) => item.usage === usage);
      return found.length === 1 ? found[0] : null;
    };
    const heading = fontFor("HEADING");
    const body = fontFor("BODY");
    const website = fields.website_url;
    let websiteValue: { url: string; displayDomain: string } | null = null;
    if (website.current.kind === "VALUE") {
      try {
        const url = new URL(
          /^https?:\/\//iu.test(website.current.value)
            ? website.current.value
            : `https://${website.current.value}`,
        );
        if (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        )
          websiteValue = { url: url.toString(), displayDomain: url.hostname };
      } catch {
        /* Invalid canonical anchor remains missing; do not fall back to scan state. */
      }
    }
    const audience = projected.audience_personas;
    return {
      brandId,
      workspaceReadiness:
        fields.brand_name.current.kind === "VALUE" && websiteValue !== null
          ? ("READY" as const)
          : hasCurrent
            ? ("PARTIAL" as const)
            : ("NOT_READY" as const),
      runtimeActivity,
      identity: {
        brandName: fields.brand_name,
        website: {
          ...website,
          current: websiteValue
            ? { kind: "VALUE" as const, value: websiteValue }
            : { kind: "NO_CURRENT" as const },
          readiness: websiteValue ? ("READY" as const) : ("NOT_READY" as const),
          resultReadiness: websiteValue
            ? ("READY" as const)
            : ("NOT_READY" as const),
        },
        industry: fields.industry,
        category: fields.sub_industry,
        primaryGeography: fields.country,
        currency: fields.reporting_currency,
        socialHandles: (["instagram", "youtube", "tiktok"] as const).flatMap(
          (platform) => {
            const field = fields[`${platform}_handle`];
            return field.current.kind === "VALUE"
              ? [
                  {
                    semanticId: field.semanticId,
                    platform,
                    handle: field.current.value,
                    field,
                  },
                ]
              : [];
          },
        ),
      },
      details: {
        industry: fields.industry,
        category: fields.sub_industry,
        primaryGeography: fields.country,
        currency: fields.reporting_currency,
      },
      visualIdentity: {
        canonical: {
          primaryLogo: applicationField(
            "primary_logo",
            visual?.primaryLogo ? assetRef(visual.primaryLogo) : null,
            visual?.primaryLogo?.authority ?? null,
          ),
          secondaryMarks: applicationField(
            "alternate_marks",
            visual
              ? visual.assets
                  .filter((item) => item.role === "ALTERNATE_MARK")
                  .map(assetRef)
              : null,
            "APPLICATION_CANONICAL",
          ),
          palette: applicationField(
            "approved_palette",
            visual
              ? visual.colors.map((item) => ({
                  ...itemMeta(item),
                  value: item.value,
                  label: item.label,
                  usage: item.usage,
                }))
              : null,
            "APPLICATION_CANONICAL",
          ),
          headingFont: applicationField(
            "heading_font",
            heading ? fontRef(heading) : null,
            heading?.authority ?? null,
          ),
          bodyFont: applicationField(
            "body_font",
            body ? fontRef(body) : null,
            body?.authority ?? null,
          ),
          typography: applicationField(
            "approved_typography",
            visual ? fonts.map(fontRef) : null,
            "APPLICATION_CANONICAL",
          ),
          referenceImages: applicationField(
            "reference_images",
            visual
              ? visual.assets
                  .filter((item) => item.role === "REFERENCE_IMAGE")
                  .map(assetRef)
              : null,
            "APPLICATION_CANONICAL",
          ),
        },
        style: projected.visual_style_profile,
      },
      brandIdentity: {
        description: projected.brand_description,
        positioning: projected.positioning,
        valueProposition: projected.value_proposition,
        values: projected.brand_values,
        personality: projected.brand_personality,
        differentiation: projected.differentiation_and_proof,
        communication: projected.communication_profile,
      },
      audience: {
        state: audience,
        personas:
          audience.current.kind === "VALUE" &&
          Array.isArray(audience.current.value)
            ? audience.current.value
            : [],
      },
      locations: locations.map((location) => ({
        locationId: location.id,
        lifecycle: location.lifecycle,
        authority: authorityPresentation(location.authority),
        observationFreshness: location.observationFreshness,
        reconciliationState: location.reconciliationState,
        lastObservedAt: location.lastObservedAt?.toISOString() ?? null,
        name: location.name,
        address: location.address,
        city: location.city,
        zip: location.zip,
        latitude: location.lat,
        longitude: location.lng,
        contactDetails: location.contactDetails,
        editability: "POLICY_PENDING" as const,
      })),
      serviceability: { state: projected.serviceability_profile },
    };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { IntelligenceSubjectType } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import { CanonicalOfferingStateService } from "../services/canonical-offering-state.service";
import { ProcessorRuntimeProjectionService } from "./processor-runtime-projection.service";
import {
  emptyProductObject,
  emptyProductRuntime,
  mapCanonicalOffering,
  mapProductObject,
  mapProductRuntime,
} from "./product-consumer.mapper";
import {
  ProductConsumerResponseSchema,
  type ProductIntelligenceObject,
} from "./product-consumer.schema";
import {
  PRODUCT_CONSUMER_OBJECTS,
  PRODUCT_PROCESSOR_IDS,
  PRODUCT_PROCESSOR_OBJECT_OWNERSHIP,
  type ProductObjectSemanticId,
} from "./product-consumer.types";

@Injectable()
export class ProductConsumerService {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly prisma: PrismaService,
    private readonly canonicalOfferings: CanonicalOfferingStateService,
    private readonly intelligence: IntelligenceCurrentProjectionService,
    private readonly processorRuntime: ProcessorRuntimeProjectionService,
  ) {}

  async read(user: AuthUser, offeringId: string) {
    const brandId = await this.auth.resolveBrandProfileId(user);
    return this.readResolvedProduct(brandId, offeringId);
  }

  async readForWorkspace(user: AuthUser, offeringId: string) {
    const brandId = await this.auth.resolveBrandProfileIdForWorkspace(user);
    return this.readResolvedProduct(brandId, offeringId);
  }

  private async readResolvedProduct(brandId: string, offeringId: string) {
    const offering = await this.canonicalOfferings.read(brandId, offeringId);
    if (!offering) throw new NotFoundException("Offering not found");

    // The general subject resolver is intentionally not used here: it may
    // materialize a missing subject, while this GET surface is read-only.
    const subject = await this.prisma.intelligenceSubject.findUnique({
      where: {
        brandId_subjectType_subjectRef: {
          brandId,
          subjectType: IntelligenceSubjectType.OFFERING,
          subjectRef: offering.id,
        },
      },
      select: { id: true, offeringId: true },
    });
    if (subject && subject.offeringId !== offering.id) {
      throw new Error("Offering Intelligence subject identity is inconsistent");
    }

    const objectsById = subject
      ? new Map(
          await Promise.all(
            PRODUCT_CONSUMER_OBJECTS.map(
              async (objectSemanticId) =>
                [
                  objectSemanticId,
                  mapProductObject(
                    await this.intelligence.readObject({
                      brandId,
                      subject: { type: "OFFERING", ref: offering.id },
                      objectSemanticId,
                    }),
                  ),
                ] as const,
            ),
          ),
        )
      : new Map<ProductObjectSemanticId, ProductIntelligenceObject>(
          PRODUCT_CONSUMER_OBJECTS.map((objectSemanticId) => [
            objectSemanticId,
            emptyProductObject(objectSemanticId),
          ]),
        );

    const runtime = Object.fromEntries(
      await Promise.all(
        PRODUCT_PROCESSOR_IDS.map(async (processorId) => {
          const object = objectsById.get(
            PRODUCT_PROCESSOR_OBJECT_OWNERSHIP[processorId],
          )!;
          return [
            processorId,
            subject
              ? mapProductRuntime(
                  processorId,
                  object,
                  await this.processorRuntime.readExact(
                    brandId,
                    subject.id,
                    processorId,
                    object.current.kind !== "NO_CURRENT",
                  ),
                )
              : emptyProductRuntime(processorId, object),
          ] as const;
        }),
      ),
    );

    return ProductConsumerResponseSchema.parse({
      offering: mapCanonicalOffering(offering),
      intelligence: {
        factualProfile: objectsById.get("offering_factual_profile"),
        creatorCommunicationProfile: objectsById.get(
          "offering_creator_communication_profile",
        ),
        actionabilityProfile: objectsById.get("offering_actionability_profile"),
      },
      processorRuntime: runtime,
    });
  }
}

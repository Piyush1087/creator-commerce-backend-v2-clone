import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { ProductConsumerService } from "../../brand-centre/consumer/product-consumer.service";
import type { ProductConsumerResponse } from "../../brand-centre/consumer/product-consumer.schema";
import { PRODUCT_CONSUMER_OBJECTS } from "../../brand-centre/consumer/product-consumer.types";
import {
  ENGINE_REGISTRATION_VERSION,
  INTELLIGENCE_CONSUMER_CONTRACT_VERSION,
  INTELLIGENCE_DOMAIN_PAYLOAD_VERSION,
  type EngineConsumerRegistration,
  type IntelligenceConsumerResult,
  type IntelligenceConsumerSubject,
} from "../intelligence-consumer.contract";
import {
  normalizeRuntimeActivity,
  toIntelligenceConsumerObjectMeta,
} from "../intelligence-consumer.mapper";
import { assertIntelligenceConsumerResult } from "../intelligence-consumer.schema";

@Injectable()
export class ProductIntelligenceConsumerAdapter implements EngineConsumerRegistration<ProductConsumerResponse> {
  readonly registrationVersion = ENGINE_REGISTRATION_VERSION;
  readonly engineId = "product_intelligence" as const;
  readonly supportedSubjectTypes = ["OFFERING"] as const;
  readonly objectIds = PRODUCT_CONSUMER_OBJECTS;
  readonly domainPayloadVersion = INTELLIGENCE_DOMAIN_PAYLOAD_VERSION;

  constructor(private readonly productConsumer: ProductConsumerService) {}

  async read(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ): Promise<IntelligenceConsumerResult<ProductConsumerResponse>> {
    const payload = await this.readAuthorizedPayload(actor, subject);
    const objects = [
      toIntelligenceConsumerObjectMeta(
        "offering_factual_profile",
        payload.intelligence.factualProfile,
        "domainPayload.intelligence.factualProfile.current.value",
        normalizeRuntimeActivity(
          payload.processorRuntime.offering_factual_synthesis.activity,
        ),
      ),
      toIntelligenceConsumerObjectMeta(
        "offering_creator_communication_profile",
        payload.intelligence.creatorCommunicationProfile,
        "domainPayload.intelligence.creatorCommunicationProfile.current.value",
        normalizeRuntimeActivity(
          payload.processorRuntime.offering_creator_communication.activity,
        ),
      ),
      toIntelligenceConsumerObjectMeta(
        "offering_actionability_profile",
        payload.intelligence.actionabilityProfile,
        "domainPayload.intelligence.actionabilityProfile.current.value",
        normalizeRuntimeActivity(
          payload.processorRuntime.offering_actionability_synthesis.activity,
        ),
      ),
    ];
    const result: IntelligenceConsumerResult<ProductConsumerResponse> = {
      contractVersion: INTELLIGENCE_CONSUMER_CONTRACT_VERSION,
      engineId: this.engineId,
      subject,
      objects,
      capabilityAvailability: { status: "AVAILABLE" },
      domainPayloadVersion: this.domainPayloadVersion,
      domainPayload: payload,
    };
    assertIntelligenceConsumerResult(result);
    return result;
  }

  async resolveAvailability(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ) {
    await this.readAuthorizedPayload(actor, subject);
    return { status: "AVAILABLE" as const };
  }

  private async readAuthorizedPayload(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ): Promise<ProductConsumerResponse> {
    if (subject.type !== "OFFERING") {
      throw new BadRequestException(
        "product_intelligence supports only OFFERING subjects",
      );
    }
    const payload = await this.productConsumer.read(actor, subject.id);
    if (payload.offering.id !== subject.id) {
      throw new ConflictException(
        "Product consumer returned an inconsistent Offering identity",
      );
    }
    return payload;
  }
}

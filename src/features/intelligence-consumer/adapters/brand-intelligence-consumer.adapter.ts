import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { BrandConsumerService } from "../../brand-centre/consumer/brand-consumer.service";
import { BRAND_CONSUMER_OBJECTS } from "../../brand-centre/consumer/brand-consumer.mapper";
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

export type BrandIntelligenceDomainPayload = Awaited<
  ReturnType<BrandConsumerService["read"]>
>;

@Injectable()
export class BrandIntelligenceConsumerAdapter implements EngineConsumerRegistration<BrandIntelligenceDomainPayload> {
  readonly registrationVersion = ENGINE_REGISTRATION_VERSION;
  readonly engineId = "brand_intelligence" as const;
  readonly supportedSubjectTypes = ["BRAND"] as const;
  readonly objectIds = BRAND_CONSUMER_OBJECTS;
  readonly domainPayloadVersion = INTELLIGENCE_DOMAIN_PAYLOAD_VERSION;

  constructor(private readonly brandConsumer: BrandConsumerService) {}

  async read(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ): Promise<IntelligenceConsumerResult<BrandIntelligenceDomainPayload>> {
    const payload = await this.readAuthorizedPayload(actor, subject);
    const runtime = payload.processorRuntime;
    const result: IntelligenceConsumerResult<BrandIntelligenceDomainPayload> = {
      contractVersion: INTELLIGENCE_CONSUMER_CONTRACT_VERSION,
      engineId: this.engineId,
      subject,
      objects: [
        toIntelligenceConsumerObjectMeta(
          "brand_description",
          payload.brandIdentity.description,
          "domainPayload.brandIdentity.description.current.value",
          normalizeRuntimeActivity(runtime.brand_meaning.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "positioning",
          payload.brandIdentity.positioning,
          "domainPayload.brandIdentity.positioning.current.value",
          normalizeRuntimeActivity(runtime.brand_meaning.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "value_proposition",
          payload.brandIdentity.valueProposition,
          "domainPayload.brandIdentity.valueProposition.current.value",
          normalizeRuntimeActivity(runtime.brand_meaning.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "brand_values",
          payload.brandIdentity.values,
          "domainPayload.brandIdentity.values.current.value",
          normalizeRuntimeActivity(runtime.brand_character.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "brand_personality",
          payload.brandIdentity.personality,
          "domainPayload.brandIdentity.personality.current.value",
          normalizeRuntimeActivity(runtime.brand_character.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "differentiation_and_proof",
          payload.brandIdentity.differentiation,
          "domainPayload.brandIdentity.differentiation.current.value",
          normalizeRuntimeActivity(runtime.brand_differentiation.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "communication_profile",
          payload.brandIdentity.communication,
          "domainPayload.brandIdentity.communication.current.value",
          normalizeRuntimeActivity(runtime.brand_communication.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "audience_personas",
          payload.audience.state,
          "domainPayload.audience.state.current.value",
          normalizeRuntimeActivity(runtime.audience_persona_synthesis.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "visual_style_profile",
          payload.visualIdentity.style,
          "domainPayload.visualIdentity.style.current.value",
          normalizeRuntimeActivity(runtime.visual_style_synthesis.activity),
        ),
        toIntelligenceConsumerObjectMeta(
          "serviceability_profile",
          payload.serviceability.state,
          "domainPayload.serviceability.state.current.value",
          normalizeRuntimeActivity(runtime.serviceability_synthesis.activity),
        ),
      ],
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
  ): Promise<BrandIntelligenceDomainPayload> {
    if (subject.type !== "BRAND") {
      throw new BadRequestException(
        "brand_intelligence supports only BRAND subjects",
      );
    }
    const payload = await this.brandConsumer.readForWorkspace(actor);
    if (payload.brandId !== subject.id) {
      throw new ForbiddenException(
        "Requested Brand subject is not available to authenticated actor",
      );
    }
    return payload;
  }
}

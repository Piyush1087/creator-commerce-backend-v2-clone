import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/types/auth-user";
import type {
  EngineConsumerRegistration,
  IntelligenceConsumerSubject,
} from "./intelligence-consumer.contract";
import { INTELLIGENCE_ENGINE_REGISTRATIONS } from "./intelligence-consumer.tokens";

@Injectable()
export class IntelligenceConsumerRegistry {
  private readonly byEngineId: ReadonlyMap<string, EngineConsumerRegistration>;

  constructor(
    @Inject(INTELLIGENCE_ENGINE_REGISTRATIONS)
    registrations: readonly EngineConsumerRegistration[],
  ) {
    const byEngineId = new Map<string, EngineConsumerRegistration>();
    for (const registration of registrations) {
      if (byEngineId.has(registration.engineId)) {
        throw new Error(
          `Duplicate Intelligence engine registration: ${registration.engineId}`,
        );
      }
      byEngineId.set(registration.engineId, registration);
    }
    this.byEngineId = byEngineId;
  }

  get(engineId: string): EngineConsumerRegistration {
    const registration = this.byEngineId.get(engineId);
    if (!registration) {
      throw new NotFoundException(`Unknown Intelligence engine: ${engineId}`);
    }
    return registration;
  }

  list(): readonly EngineConsumerRegistration[] {
    return [...this.byEngineId.values()];
  }

  async read(
    actor: AuthUser,
    engineId: string,
    subject: IntelligenceConsumerSubject,
  ) {
    const registration = this.get(engineId);
    this.assertSubjectSupport(registration, subject);
    return registration.read(actor, subject);
  }

  async resolveAvailability(
    actor: AuthUser,
    engineId: string,
    subject: IntelligenceConsumerSubject,
  ) {
    const registration = this.get(engineId);
    this.assertSubjectSupport(registration, subject);
    return registration.resolveAvailability(actor, subject);
  }

  private assertSubjectSupport(
    registration: EngineConsumerRegistration,
    subject: IntelligenceConsumerSubject,
  ): void {
    if (!registration.supportedSubjectTypes.includes(subject.type)) {
      throw new BadRequestException(
        `${registration.engineId} does not support ${subject.type} subjects`,
      );
    }
  }
}

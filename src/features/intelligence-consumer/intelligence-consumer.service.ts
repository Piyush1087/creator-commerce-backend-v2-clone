import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../auth/types/auth-user";
import type { IntelligenceConsumerSubject } from "./intelligence-consumer.contract";
import { IntelligenceConsumerRegistry } from "./intelligence-consumer.registry";

@Injectable()
export class IntelligenceConsumerService {
  constructor(private readonly registry: IntelligenceConsumerRegistry) {}

  listRegistrations() {
    return this.registry.list();
  }

  read(
    actor: AuthUser,
    engineId: string,
    subject: IntelligenceConsumerSubject,
  ) {
    return this.registry.read(actor, engineId, subject);
  }

  resolveAvailability(
    actor: AuthUser,
    engineId: string,
    subject: IntelligenceConsumerSubject,
  ) {
    return this.registry.resolveAvailability(actor, engineId, subject);
  }
}

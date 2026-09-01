import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";
import { CoPilotPersistenceModule } from "../co-pilot/co-pilot-persistence.module";
import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "./capabilities/chat-capability.registry";
import { CHAT_CAPABILITY_DESCRIPTORS } from "./capabilities/chat-capability.tokens";
import { ChatContextService } from "./context/chat-context.service";
import { ChatConversationService } from "./conversation/chat-conversation.service";
import { ChatModelGateway } from "./model/chat-model.gateway";
import { ChatResponseValidationService } from "./response/chat-response-validation.service";
import { ChatTelemetryService } from "./telemetry/chat-telemetry.service";

@Module({
  imports: [BrandCentreModule, CoPilotPersistenceModule],
  providers: [
    {
      provide: CHAT_CAPABILITY_DESCRIPTORS,
      useValue: CHAT_CAPABILITY_CATALOG,
    },
    ChatCapabilityRegistry,
    ChatContextService,
    ChatConversationService,
    ChatModelGateway,
    ChatResponseValidationService,
    ChatTelemetryService,
    GeminiJsonClient,
  ],
  exports: [
    ChatCapabilityRegistry,
    ChatContextService,
    ChatConversationService,
    ChatModelGateway,
    ChatResponseValidationService,
    ChatTelemetryService,
  ],
})
export class ChatModule {}

import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";
import { BrandUceModule } from "../brand-uce/brand-uce.module";
import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandWorkspaceReadinessModule } from "../brand-workspace-readiness/brand-workspace-readiness.module";
import { CollaborationConsumerModule } from "../collaboration/collaboration-consumer.module";
import { CoPilotPersistenceModule } from "../co-pilot/co-pilot-persistence.module";
import { IntelligenceConsumerModule } from "../intelligence-consumer/intelligence-consumer.module";
import { CHAT_CAPABILITY_HANDLERS } from "./capabilities/chat-capability-handler.tokens";
import type { ChatCapabilityHandler } from "./capabilities/chat-capability-handler.contract";
import { ChatCapabilityHandlerRegistry } from "./capabilities/chat-capability-handler.registry";
import { ChatCapabilityExecutor } from "./capabilities/chat-capability.executor";
import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "./capabilities/chat-capability.registry";
import { CHAT_CAPABILITY_DESCRIPTORS } from "./capabilities/chat-capability.tokens";
import { ChatNavigationRegistry } from "./capabilities/chat-navigation.registry";
import { AppNavigateHandler } from "./capabilities/handlers/app-navigate.handler";
import { BrandCurrentReadHandler } from "./capabilities/handlers/brand-current-read.handler";
import { BrandIntelligenceCurrentReadHandler } from "./capabilities/handlers/brand-intelligence-current-read.handler";
import { CampaignListHandler } from "./capabilities/handlers/campaign-list.handler";
import { CampaignReadHandler } from "./capabilities/handlers/campaign-read.handler";
import { CollaborationListHandler } from "./capabilities/handlers/collaboration-list.handler";
import { CollaborationReadHandler } from "./capabilities/handlers/collaboration-read.handler";
import { OfferingListHandler } from "./capabilities/handlers/offering-list.handler";
import { OfferingReadHandler } from "./capabilities/handlers/offering-read.handler";
import { ProductIntelligenceCurrentReadHandler } from "./capabilities/handlers/product-intelligence-current-read.handler";
import { ProviderReadinessReadHandler } from "./capabilities/handlers/provider-readiness-read.handler";
import { WorkspaceReadinessReadHandler } from "./capabilities/handlers/workspace-readiness-read.handler";
import { WorkspaceContextReadHandler } from "./capabilities/handlers/workspace-context-read.handler";
import { ChatController } from "./chat.controller";
import { ChatContextService } from "./context/chat-context.service";
import { ChatConversationService } from "./conversation/chat-conversation.service";
import { ChatModelGateway } from "./model/chat-model.gateway";
import { ChatTurnOrchestratorService } from "./orchestration/chat-turn-orchestrator.service";
import { ChatResponseValidationService } from "./response/chat-response-validation.service";
import { ChatTelemetryService } from "./telemetry/chat-telemetry.service";

@Module({
  imports: [
    BrandCentreModule,
    BrandSettingsConsumerModule,
    BrandUceModule,
    BrandWorkspaceReadinessModule,
    CollaborationConsumerModule,
    CoPilotPersistenceModule,
    IntelligenceConsumerModule,
  ],
  controllers: [ChatController],
  providers: [
    {
      provide: CHAT_CAPABILITY_DESCRIPTORS,
      useValue: CHAT_CAPABILITY_CATALOG,
    },
    ChatCapabilityRegistry,
    ChatNavigationRegistry,
    WorkspaceContextReadHandler,
    BrandCurrentReadHandler,
    OfferingListHandler,
    OfferingReadHandler,
    BrandIntelligenceCurrentReadHandler,
    ProductIntelligenceCurrentReadHandler,
    CampaignListHandler,
    CampaignReadHandler,
    CollaborationListHandler,
    CollaborationReadHandler,
    WorkspaceReadinessReadHandler,
    ProviderReadinessReadHandler,
    AppNavigateHandler,
    {
      provide: CHAT_CAPABILITY_HANDLERS,
      inject: [
        WorkspaceContextReadHandler,
        BrandCurrentReadHandler,
        OfferingListHandler,
        OfferingReadHandler,
        BrandIntelligenceCurrentReadHandler,
        ProductIntelligenceCurrentReadHandler,
        CampaignListHandler,
        CampaignReadHandler,
        CollaborationListHandler,
        CollaborationReadHandler,
        WorkspaceReadinessReadHandler,
        ProviderReadinessReadHandler,
        AppNavigateHandler,
      ],
      useFactory: (
        ...handlers: ChatCapabilityHandler[]
      ): readonly ChatCapabilityHandler[] => handlers,
    },
    ChatCapabilityHandlerRegistry,
    ChatCapabilityExecutor,
    ChatContextService,
    ChatConversationService,
    ChatModelGateway,
    ChatResponseValidationService,
    ChatTelemetryService,
    ChatTurnOrchestratorService,
    GeminiJsonClient,
  ],
  exports: [
    ChatCapabilityRegistry,
    ChatCapabilityExecutor,
    ChatContextService,
    ChatConversationService,
    ChatModelGateway,
    ChatResponseValidationService,
    ChatTelemetryService,
    ChatTurnOrchestratorService,
  ],
})
export class ChatModule {}

import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandIntelligenceConsumerAdapter } from "./adapters/brand-intelligence-consumer.adapter";
import { ProductIntelligenceConsumerAdapter } from "./adapters/product-intelligence-consumer.adapter";
import type { EngineConsumerRegistration } from "./intelligence-consumer.contract";
import { IntelligenceConsumerRegistry } from "./intelligence-consumer.registry";
import { IntelligenceConsumerService } from "./intelligence-consumer.service";
import { INTELLIGENCE_ENGINE_REGISTRATIONS } from "./intelligence-consumer.tokens";

@Module({
  imports: [BrandCentreModule],
  providers: [
    BrandIntelligenceConsumerAdapter,
    ProductIntelligenceConsumerAdapter,
    {
      provide: INTELLIGENCE_ENGINE_REGISTRATIONS,
      inject: [
        BrandIntelligenceConsumerAdapter,
        ProductIntelligenceConsumerAdapter,
      ],
      useFactory: (
        brand: BrandIntelligenceConsumerAdapter,
        product: ProductIntelligenceConsumerAdapter,
      ): readonly EngineConsumerRegistration[] => [brand, product],
    },
    IntelligenceConsumerRegistry,
    IntelligenceConsumerService,
  ],
  exports: [IntelligenceConsumerRegistry, IntelligenceConsumerService],
})
export class IntelligenceConsumerModule {}

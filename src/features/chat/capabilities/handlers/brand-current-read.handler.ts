import { Injectable } from "@nestjs/common";

import { BrandCurrentReadService } from "../../../brand-centre/consumer/brand-current-read.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class BrandCurrentReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "brand.current.read";

  constructor(private readonly brand: BrandCurrentReadService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    const data = await this.brand.read(
      context.chatContext.workspace.brandProfileId,
    );
    const brandRef = { type: "BRAND" as const, id: data.brandId };
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data,
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: [brandRef],
          resultRefs: [data.canonicalSnapshotRef],
        },
      ],
      authorizedEntityRefs: [brandRef],
    };
  }
}

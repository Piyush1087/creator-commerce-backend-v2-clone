import { Injectable } from "@nestjs/common";

@Injectable()
export class CollaborationPaymentCapabilityService {
  manualEnabledForNewObligations(): boolean {
    return process.env.COLLABORATION_MANUAL_PAYMENT_ENABLED === "true";
  }
}

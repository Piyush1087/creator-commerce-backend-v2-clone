import type { GatekeeperSiteAssessment } from "./gatekeeper-v1.types";

export const GATEKEEPER_ASSESSMENT_PROVIDER = Symbol(
  "GATEKEEPER_ASSESSMENT_PROVIDER",
);

export interface GatekeeperAssessmentProvider {
  primary(args: {
    normalizedUrl: string;
    normalizedDomain: string;
  }): Promise<unknown>;
  parallel(args: {
    normalizedUrl: string;
    normalizedDomain: string;
    priorAssessment: GatekeeperSiteAssessment;
  }): Promise<unknown>;
  openAiFallback(args: {
    normalizedUrl: string;
    normalizedDomain: string;
    priorAssessment: GatekeeperSiteAssessment | null;
  }): Promise<unknown>;
}

/**
 * Placeholder binding until Data Extraction supplies the provider-backed
 * capability implementation. It fails closed rather than fabricating a result.
 */
export class UnconfiguredGatekeeperAssessmentProvider
  implements GatekeeperAssessmentProvider
{
  async primary(): Promise<never> {
    throw new Error("gatekeeper_primary_web_assessment is not bound");
  }
  async parallel(): Promise<never> {
    throw new Error("company_public_web_research is not bound");
  }
  async openAiFallback(): Promise<never> {
    throw new Error("Gatekeeper OpenAI fallback is not bound");
  }
}

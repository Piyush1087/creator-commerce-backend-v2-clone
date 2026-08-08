import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { resolveBrandIntelligenceMetadataRoot } from "./metadata-root";
import { createIdentityRuntime } from "./runtime/integration/identity-runtime";
import { IdentityValidatorAdapter } from "./runtime/integration/validator.adapter";
import { IdentityEvidenceRuntime } from "./runtime/evidence/identity-evidence.runtime";
import { IdentityRepositoryLoader } from "./runtime/loaders/identity-repository.loader";
import { SafeYamlLoader } from "./runtime/loaders/yaml_loader";
import { ModelRegistryResolver } from "./runtime/models/model-registry.resolver";
import { NoopPersistenceAdapter } from "./runtime/persistence/noop-persistence.adapter";
import { buildPrompt } from "./runtime/prompt-builder/prompt-builder";
import { GeminiIntelligenceProvider } from "./runtime/providers/gemini/gemini-intelligence.provider";
import { NoopTelemetryAdapter } from "./runtime/telemetry/noop-telemetry.adapter";

@Injectable()
export class BrandIntelligenceService {
  private readonly runtime;

  constructor(
    private readonly config: ConfigService,
    private readonly evidence: IdentityEvidenceRuntime,
    private readonly provider: GeminiIntelligenceProvider,
    private readonly persistence: NoopPersistenceAdapter,
    private readonly telemetry: NoopTelemetryAdapter,
  ) {
    const metadataRoot = resolveBrandIntelligenceMetadataRoot();
    const yaml = new SafeYamlLoader(metadataRoot);
    const repo = new IdentityRepositoryLoader(yaml);
    const environment = this.resolveEnvironment();
    const modelOverride =
      this.config.get<string>("GEMINI_MODEL")?.trim() || undefined;
    const models = new ModelRegistryResolver(yaml, environment, modelOverride);
    const validator = new IdentityValidatorAdapter(yaml);

    this.runtime = createIdentityRuntime({
      profiles: {
        load: (id) => repo.loadExecutionProfile(id),
      },
      definitions: {
        loadProcessor: (id, scope) => repo.loadProcessor(id, scope),
        loadGlobalArtifacts: () => repo.loadGlobalArtifacts(),
        loadProcessorArtifacts: (id, scope) =>
          repo.loadProcessorArtifacts(id, scope),
        loadObjects: (outputs) => repo.loadObjects(outputs),
      },
      evidence: this.evidence,
      models: {
        resolve: (id, scope) => models.resolve(id, scope),
      },
      prompts: {
        build: (input) => buildPrompt(input as Parameters<typeof buildPrompt>[0]),
      },
      provider: this.provider,
      validator,
      persistence: this.persistence,
      telemetry: this.telemetry,
    });
  }

  async runIdentityTest(args: { websiteUrl: string; entityId?: string }) {
    const websiteUrl = new URL(args.websiteUrl).toString();
    const entityId = args.entityId?.trim() || `identity-test:${randomUUID()}`;

    const result = await this.runtime.executeIdentityTest({
      entityType: "brand",
      entityId,
      websiteUrl,
      persistResults: false,
    });

    return {
      mode: "DRY_RUN" as const,
      persisted: false,
      executionProfileId: "identity_test",
      entityType: "brand",
      entityId,
      websiteUrl,
      executionId: result.executionId,
      state: result.state,
      tasks: result.tasks,
      validatedOutputs: result.validatedOutputs,
    };
  }

  private resolveEnvironment(): "development" | "test" | "production" {
    const env = (this.config.get<string>("NODE_ENV") ?? "development").toLowerCase();
    if (env === "production") return "production";
    if (env === "test") return "test";
    return "development";
  }
}

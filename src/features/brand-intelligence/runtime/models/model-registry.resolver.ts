import { RuntimeConfigError, SafeYamlLoader } from "../loaders/yaml_loader";

type Environment = "development" | "test" | "production";

export type ResolvedModelRuntime = {
  model_profile: string;
  model_alias: string;
  provider: string;
  provider_adapter: string;
  model_id: string;
  access_mode: "normalized_evidence" | "website_direct";
  credential_ref: string;
  runtime: {
    temperature: number;
    structured_output: boolean;
    timeout_ms: number;
    max_attempts: number;
    [key: string]: unknown;
  };
};

export class ModelRegistryResolver {
  constructor(
    private readonly yaml: SafeYamlLoader,
    private readonly environment: Environment,
    private readonly modelIdOverride?: string,
  ) {}

  async resolve(
    processorId: string,
    scope?: string,
  ): Promise<ResolvedModelRuntime> {
    const registry = (await this.yaml.load("models.yaml")) as {
      processor_model_bindings?: Record<
        string,
        Record<string, { model_profile: string; access_mode?: string }>
      >;
      model_profiles?: Record<
        string,
        { model_alias: string; runtime?: Record<string, unknown> }
      >;
      model_aliases?: Record<
        string,
        { provider: string; model_id?: string }
      >;
      providers?: Record<
        string,
        {
          adapter: string;
          credential_ref: string;
          enabled_environments?: string[];
        }
      >;
      runtime_defaults?: Record<string, unknown>;
    };

    const bindings = registry.processor_model_bindings?.[processorId];
    const binding = scope ? bindings?.[scope] : bindings?.default;
    if (!binding) {
      throw new RuntimeConfigError(
        "MODEL_PROFILE_NOT_CONFIGURED",
        `No model binding for ${processorId}${scope ? `.${scope}` : ""}`,
      );
    }

    const profileId = binding.model_profile;
    const profile = registry.model_profiles?.[profileId];
    if (!profile) {
      throw new RuntimeConfigError(
        "MODEL_PROFILE_NOT_CONFIGURED",
        `Unknown model profile '${profileId}'`,
      );
    }

    const aliasId = profile.model_alias;
    const alias = registry.model_aliases?.[aliasId];
    if (!alias) {
      throw new RuntimeConfigError(
        "MODEL_ALIAS_NOT_FOUND",
        `Unknown model alias '${aliasId}'`,
      );
    }

    const configuredModelId =
      this.modelIdOverride?.trim() || alias.model_id;
    if (!configuredModelId) {
      throw new RuntimeConfigError(
        "MODEL_ID_NOT_CONFIGURED",
        `No provider model ID for '${aliasId}'`,
      );
    }

    const provider = registry.providers?.[alias.provider];
    if (!provider) {
      throw new RuntimeConfigError(
        "MODEL_PROVIDER_NOT_CONFIGURED",
        `Unknown provider '${alias.provider}'`,
      );
    }
    if (!(provider.enabled_environments ?? []).includes(this.environment)) {
      throw new RuntimeConfigError(
        "MODEL_PROVIDER_ENVIRONMENT_DISABLED",
        `Provider '${alias.provider}' disabled in ${this.environment}`,
      );
    }

    const effectiveRuntime = {
      temperature: 0,
      structured_output: true,
      timeout_ms: 30_000,
      max_attempts: 2,
      ...registry.runtime_defaults,
      ...profile.runtime,
    } as ResolvedModelRuntime["runtime"];

    return Object.freeze({
      model_profile: profileId,
      model_alias: aliasId,
      provider: alias.provider,
      provider_adapter: provider.adapter,
      model_id: configuredModelId,
      access_mode:
        (binding.access_mode as ResolvedModelRuntime["access_mode"]) ??
        "normalized_evidence",
      credential_ref: provider.credential_ref,
      runtime: effectiveRuntime,
    });
  }
}

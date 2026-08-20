import {
  RuntimeConfigError,
  SafeYamlLoader,
} from "../loaders/safe-yaml.loader";

type Environment = "development" | "test" | "production";

export class ModelRegistryResolver {
  constructor(
    private readonly yaml: SafeYamlLoader,
    private readonly environment: Environment,
  ) {}

  async resolve(processorId: string) {
    const registry =
      await this.yaml.load<Record<string, unknown>>("models.yaml");
    const bindings = registry.processor_model_bindings as
      | Record<
          string,
          { default?: { model_profile?: string; access_mode?: string } }
        >
      | undefined;
    const binding = bindings?.[processorId]?.default;
    if (!binding?.model_profile) {
      throw new RuntimeConfigError(
        "MODEL_PROFILE_NOT_CONFIGURED",
        `No model binding for ${processorId}`,
      );
    }
    const profiles = registry.model_profiles as
      | Record<
          string,
          { model_alias?: string; runtime?: Record<string, unknown> }
        >
      | undefined;
    const profile = profiles?.[binding.model_profile];
    if (!profile?.model_alias) {
      throw new RuntimeConfigError(
        "MODEL_PROFILE_NOT_CONFIGURED",
        `Unknown model profile '${binding.model_profile}'`,
      );
    }
    const aliases = registry.model_aliases as
      | Record<string, { provider?: string; model_id?: string }>
      | undefined;
    const alias = aliases?.[profile.model_alias];
    if (!alias?.provider) {
      throw new RuntimeConfigError(
        "MODEL_ALIAS_NOT_FOUND",
        `Unknown model alias '${profile.model_alias}'`,
      );
    }
    if (!alias.model_id) {
      throw new RuntimeConfigError(
        "MODEL_ID_NOT_CONFIGURED",
        `No provider model ID for '${profile.model_alias}'`,
      );
    }
    const providers = registry.providers as
      | Record<
          string,
          { adapter?: string; enabled_environments?: Environment[] }
        >
      | undefined;
    const provider = providers?.[alias.provider];
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

    return Object.freeze({
      model_profile: binding.model_profile,
      model_alias: profile.model_alias,
      provider: alias.provider,
      provider_adapter: provider.adapter,
      model_id: alias.model_id,
      access_mode: binding.access_mode ?? "normalized_evidence",
      runtime: profile.runtime ?? {},
    });
  }
}

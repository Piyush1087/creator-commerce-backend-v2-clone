import { SafeYamlLoader, RuntimeConfigError } from "../loaders/yaml_loader";

type Environment = "development"|"test"|"production";
export type ModelOverride = { model_profile?: string; timeout_ms?: number };

export class ModelRegistryResolver {
  constructor(private readonly yaml: SafeYamlLoader, private readonly environment: Environment) {}

  async resolve(processorId: string, scope?: string, override?: ModelOverride) {
    const registry:any = await this.yaml.load("intelligence/runtime/models.yaml");
    const bindings = registry.processor_model_bindings?.[processorId];
    const binding = scope ? bindings?.[scope] : bindings?.default;
    if (!binding && !override?.model_profile) throw new RuntimeConfigError("MODEL_PROFILE_NOT_CONFIGURED", `No model binding for ${processorId}${scope ? `.${scope}` : ""}`);

    if (override && this.environment === "production") throw new RuntimeConfigError("MODEL_OVERRIDE_FORBIDDEN", "Runtime model overrides are disabled in production");
    const profileId = override?.model_profile ?? binding.model_profile;
    const profile = registry.model_profiles?.[profileId];
    if (!profile) throw new RuntimeConfigError("MODEL_PROFILE_NOT_CONFIGURED", `Unknown model profile '${profileId}'`);
    const aliasId = profile.model_alias;
    const alias = registry.model_aliases?.[aliasId];
    if (!alias) throw new RuntimeConfigError("MODEL_ALIAS_NOT_FOUND", `Unknown model alias '${aliasId}'`);
    if (!alias.model_id) throw new RuntimeConfigError("MODEL_ID_NOT_CONFIGURED", `No provider model ID for '${aliasId}'`);
    const provider = registry.providers?.[alias.provider];
    if (!provider) throw new RuntimeConfigError("MODEL_PROVIDER_NOT_CONFIGURED", `Unknown provider '${alias.provider}'`);
    if (!(provider.enabled_environments ?? []).includes(this.environment)) throw new RuntimeConfigError("MODEL_PROVIDER_ENVIRONMENT_DISABLED", `Provider '${alias.provider}' disabled in ${this.environment}`);

    const effectiveRuntime = { ...registry.runtime_defaults, ...profile.runtime };
    if (override?.timeout_ms !== undefined) effectiveRuntime.timeout_ms = override.timeout_ms;
    return Object.freeze({
      model_profile: profileId,
      model_alias: aliasId,
      provider: alias.provider,
      provider_adapter: provider.adapter,
      model_id: alias.model_id,
      access_mode: binding?.access_mode ?? "normalized_evidence",
      credential_ref: provider.credential_ref,
      runtime: effectiveRuntime,
    });
  }
}

import { Inject, Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";

import {
  CO_PILOT_AI_MODULES,
  type CoPilotAiModule,
  type CoPilotModuleReadContext,
  type CoPilotModuleReadResult,
} from "./ai-module.contract";
import type { ReadQueryKind } from "./read-kind.types";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "./write-intent.types";

@Injectable()
export class CoPilotModuleRegistry {
  constructor(
    @Inject(CO_PILOT_AI_MODULES)
    private readonly modules: CoPilotAiModule[],
  ) {}

  list(): readonly CoPilotAiModule[] {
    return this.modules;
  }

  promptExtensions(): string[] {
    return this.modules
      .map((m) => m.promptExtension?.trim())
      .filter((ext): ext is string => !!ext && ext.length > 0);
  }

  resolveRead(
    userText: string,
    scopeContext: CoPilotScopeContext,
  ): { module: CoPilotAiModule; kind: ReadQueryKind } | null {
    for (const mod of this.modules) {
      const kind = mod.detectRead(userText, scopeContext);
      if (kind && kind !== "NONE" && kind !== "BRAND_CENTRE_DEFAULT") {
        return { module: mod, kind };
      }
    }
    return null;
  }

  resolveWrite(
    userText: string,
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): Exclude<DetectedWriteIntent, { kind: "NONE" }> | null {
    for (const mod of this.modules) {
      const intent = mod.detectWrite(userText, history);
      if (intent && intent.kind !== "NONE") {
        return intent;
      }
    }
    return null;
  }

  findModuleForWriteIntent(kind: WriteIntentKind): CoPilotAiModule | null {
    return (
      this.modules.find((mod) => mod.supportedWriteIntents.includes(kind)) ??
      null
    );
  }

  findModuleForReadKind(kind: ReadQueryKind): CoPilotAiModule | null {
    return (
      this.modules.find((mod) => mod.supportedReadKinds.includes(kind)) ?? null
    );
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    const owner = this.findModuleForReadKind(kind);
    if (owner) {
      return owner.executeRead(kind, ctx);
    }
    for (const mod of this.modules) {
      const result = await mod.executeRead(kind, ctx);
      if (result) {
        return result;
      }
    }
    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    brandProfileId: string,
    context?: {
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      userText: string;
      authUser?: unknown;
      threadId?: string;
    },
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    const owner = this.findModuleForWriteIntent(intent.kind);
    if (owner?.enrichWriteIntent) {
      return owner.enrichWriteIntent(intent, brandProfileId, context);
    }
    return intent;
  }
}

import { Injectable } from "@nestjs/common";

import { COPILOT_SYSTEM_PROMPT } from "../integrations/copilot-system-prompt";
import { CoPilotModuleRegistry } from "./module-registry";

@Injectable()
export class CoPilotPromptComposer {
  constructor(private readonly registry: CoPilotModuleRegistry) {}

  composeSystemPrompt(): string {
    const extensions = this.registry.promptExtensions();
    if (extensions.length === 0) {
      return COPILOT_SYSTEM_PROMPT;
    }
    return [COPILOT_SYSTEM_PROMPT, "", ...extensions].join("\n");
  }
}

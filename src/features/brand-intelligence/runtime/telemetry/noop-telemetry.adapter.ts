import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type {
  CompilerRequest,
  ExecutionTask,
  TaskResult,
} from "../compiler/compiler";
import type { TelemetryPort } from "../integration/types";

/**
 * Generates execution/task IDs only. Does not log prompts, evidence, or payloads.
 */
@Injectable()
export class NoopTelemetryAdapter implements TelemetryPort {
  async executionStarted(_args: {
    profileId: string;
    request: CompilerRequest;
  }): Promise<string> {
    return randomUUID();
  }

  async taskStarted(
    _executionId: string,
    _task: ExecutionTask,
  ): Promise<string> {
    return randomUUID();
  }

  async taskFinished(
    _processorExecutionId: string,
    _result: TaskResult,
  ): Promise<void> {
    // intentionally silent
  }

  async executionFinished(
    _executionId: string,
    _result: unknown,
  ): Promise<void> {
    // intentionally silent
  }
}

export type TaskState =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED_PRECHECK"
  | "FAILED_PROVIDER"
  | "FAILED_VALIDATION"
  | "FAILED_PERSISTENCE"
  | "SKIPPED_DEPENDENCY";
export type ExecutionState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED";
export type ExecutionTask = {
  id: string;
  processorId: string;
  kind: "AI" | "DETERMINISTIC";
  activeOutputs: string[];
  dependsOn?: string[];
  required?: boolean;
};
export type ExecutionProfile = {
  id: string;
  tasks: ExecutionTask[];
  persistResultsDefault: boolean;
};
export type CompilerRequest = {
  entityType: string;
  entityId: string;
  websiteUrl: string;
  persistResults?: boolean;
};
export type TaskResult = {
  taskId: string;
  state: TaskState;
  values?: Record<string, unknown>;
  error?: { code: string; message: string };
  metadata?: Record<string, unknown>;
};
export type CompilerTaskContext = {
  executionId: string;
  task: ExecutionTask;
  request: CompilerRequest;
  canonicalDependencies: Record<string, unknown>;
  persistResults: boolean;
};
export interface CompilerRuntime {
  runAiTask(args: CompilerTaskContext): Promise<TaskResult>;
  runDeterministicTask(args: CompilerTaskContext): Promise<TaskResult>;
}
export type CompilerResult = {
  executionId: string;
  profileId: string;
  state: ExecutionState;
  tasks: TaskResult[];
  validatedOutputs: Record<string, unknown>;
};

/** Shared Identity-era DAG compiler. Gatekeeper uses a narrow profile adapter
 * because application-policy and conditional fallback stages are not DAG tasks. */
export async function executeProfile(
  executionId: string,
  profile: ExecutionProfile,
  request: CompilerRequest,
  runtime: CompilerRuntime,
): Promise<CompilerResult> {
  const pending = new Map(profile.tasks.map((task) => [task.id, task]));
  const results = new Map<string, TaskResult>();
  const canonical: Record<string, unknown> = {};
  const persistResults =
    request.persistResults ?? profile.persistResultsDefault;

  while (pending.size) {
    for (const [id, task] of [...pending]) {
      const failed = (task.dependsOn ?? []).find((dependency) => {
        const state = results.get(dependency)?.state;
        return state && state !== "SUCCEEDED";
      });
      if (failed && results.has(failed)) {
        results.set(id, {
          taskId: id,
          state: "SKIPPED_DEPENDENCY",
          error: {
            code: "REQUIRED_DEPENDENCY_FAILED",
            message: `Dependency '${failed}' did not succeed`,
          },
        });
        pending.delete(id);
      }
    }

    const ready = [...pending.values()].filter((task) =>
      (task.dependsOn ?? []).every(
        (dependency) => results.get(dependency)?.state === "SUCCEEDED",
      ),
    );
    if (!ready.length) {
      for (const [id] of pending) {
        results.set(id, {
          taskId: id,
          state: "FAILED_PRECHECK",
          error: {
            code: "EXECUTION_DAG_UNRESOLVED",
            message: "Task graph contains an unresolved or cyclic dependency",
          },
        });
      }
      pending.clear();
      break;
    }

    const batch = await Promise.all(
      ready.map(async (task) => {
        try {
          const args = {
            executionId,
            task,
            request,
            canonicalDependencies: { ...canonical },
            persistResults,
          };
          return task.kind === "AI"
            ? await runtime.runAiTask(args)
            : await runtime.runDeterministicTask(args);
        } catch (error) {
          return {
            taskId: task.id,
            state: "FAILED_PRECHECK" as const,
            error: {
              code: "UNHANDLED_TASK_ERROR",
              message:
                error instanceof Error ? error.message : "Unknown task error",
            },
          };
        }
      }),
    );
    for (const result of batch) {
      results.set(result.taskId, result);
      pending.delete(result.taskId);
      if (result.state === "SUCCEEDED" && result.values) {
        Object.assign(canonical, result.values);
      }
    }
  }

  const ordered = profile.tasks
    .map((task) => results.get(task.id))
    .filter((result): result is TaskResult => Boolean(result));
  const requiredFailures = profile.tasks.some(
    (task) =>
      task.required !== false && results.get(task.id)?.state !== "SUCCEEDED",
  );
  const anySuccess = ordered.some((result) => result.state === "SUCCEEDED");
  const allSuccess =
    ordered.length === profile.tasks.length &&
    ordered.every((result) => result.state === "SUCCEEDED");
  const state: ExecutionState = allSuccess
    ? "SUCCEEDED"
    : requiredFailures
      ? "FAILED"
      : anySuccess
        ? "PARTIAL"
        : "FAILED";

  return {
    executionId,
    profileId: profile.id,
    state,
    tasks: ordered,
    validatedOutputs: canonical,
  };
}

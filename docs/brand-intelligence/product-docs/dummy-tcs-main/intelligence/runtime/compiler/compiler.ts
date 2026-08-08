export type TaskState = "PENDING"|"READY"|"RUNNING"|"SUCCEEDED"|"FAILED_PRECHECK"|"FAILED_PROVIDER"|"FAILED_VALIDATION"|"FAILED_PERSISTENCE"|"SKIPPED_DEPENDENCY";
export type ExecutionState = "PENDING"|"RUNNING"|"SUCCEEDED"|"PARTIAL"|"FAILED";
export type ExecutionTask = { id:string; processorId:string; processorScope?:string; kind:"AI"|"DETERMINISTIC"; activeOutputs:string[]; dependsOn?:string[]; canonicalDependencies?:string[]; required?:boolean; };
export type ExecutionProfile = { id:string; tasks:ExecutionTask[]; persistResultsDefault:boolean; };
export type CompilerRequest = { entityType:string; entityId:string; websiteUrl:string; persistResults?:boolean; };
export type TaskResult = { taskId:string; state:TaskState; values?:Record<string,unknown>; error?:{code:string;message:string}; metadata?:Record<string,unknown>; };
export type CompilerTaskContext = { executionId:string; task:ExecutionTask; request:CompilerRequest; canonicalDependencies:Record<string,unknown>; persistResults:boolean; };
export interface CompilerRuntime { runAiTask(args:CompilerTaskContext):Promise<TaskResult>; runDeterministicTask(args:CompilerTaskContext):Promise<TaskResult>; }
export type CompilerResult = { executionId:string; profileId:string; state:ExecutionState; tasks:TaskResult[]; validatedOutputs:Record<string,unknown>; };

export async function executeProfile(executionId:string, profile:ExecutionProfile, request:CompilerRequest, runtime:CompilerRuntime):Promise<CompilerResult>{
 const pending=new Map(profile.tasks.map(t=>[t.id,t])); const results=new Map<string,TaskResult>(); const canonical:Record<string,unknown>={}; const persistResults=request.persistResults??profile.persistResultsDefault;
 while(pending.size){
  for(const [id,task] of [...pending]){ const failed=(task.dependsOn??[]).find(dep=>{const s=results.get(dep)?.state;return s&&s!=="SUCCEEDED";}); if(failed&&results.has(failed)){results.set(id,{taskId:id,state:"SKIPPED_DEPENDENCY",error:{code:"REQUIRED_DEPENDENCY_FAILED",message:`Dependency '${failed}' did not succeed`}});pending.delete(id);} }
  const ready=[...pending.values()].filter(task=>(task.dependsOn??[]).every(dep=>results.get(dep)?.state==="SUCCEEDED"));
  if(!ready.length){for(const [id] of pending)results.set(id,{taskId:id,state:"FAILED_PRECHECK",error:{code:"EXECUTION_DAG_UNRESOLVED",message:"Task graph contains an unresolved or cyclic dependency"}});pending.clear();break;}
  const batch=await Promise.all(ready.map(async task=>{try{const args={executionId,task,request,canonicalDependencies:{...canonical},persistResults};return task.kind==="AI"?await runtime.runAiTask(args):await runtime.runDeterministicTask(args);}catch(error){return{taskId:task.id,state:"FAILED_PRECHECK" as const,error:{code:"UNHANDLED_TASK_ERROR",message:error instanceof Error?error.message:"Unknown task error"}};}}));
  for(const result of batch){results.set(result.taskId,result);pending.delete(result.taskId);if(result.state==="SUCCEEDED"&&result.values)Object.assign(canonical,result.values);}
 }
 const ordered=profile.tasks.map(t=>results.get(t.id)!).filter(Boolean); const requiredFailures=profile.tasks.some(t=>t.required!==false&&results.get(t.id)?.state!=="SUCCEEDED"); const anySuccess=ordered.some(r=>r.state==="SUCCEEDED"); const allSuccess=ordered.length===profile.tasks.length&&ordered.every(r=>r.state==="SUCCEEDED"); const state:ExecutionState=allSuccess?"SUCCEEDED":requiredFailures?"FAILED":anySuccess?"PARTIAL":"FAILED";
 return{executionId,profileId:profile.id,state,tasks:ordered,validatedOutputs:canonical};
}

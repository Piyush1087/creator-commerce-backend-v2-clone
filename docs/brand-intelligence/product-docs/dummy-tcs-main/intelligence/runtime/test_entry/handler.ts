import type { IdentityRuntimeDependencies } from "../integration/types";
import { createIntelligenceService } from "../integration/service";

export type IdentityTestRequest = { websiteUrl:string; entityId?:string };
export type DevAuthContext = { isAuthenticated:boolean; isDeveloper:boolean; userId?:string };

/** Framework-neutral handler. Mount only behind a development/test authenticated route. */
export function createIdentityTestHandler(deps:IdentityRuntimeDependencies) {
  const service=createIntelligenceService(deps);
  return async function identityTest(body:IdentityTestRequest,auth:DevAuthContext) {
    if(process.env.NODE_ENV==="production") return {status:404,body:{error:"NOT_FOUND"}};
    if(!auth.isAuthenticated||!auth.isDeveloper) return {status:403,body:{error:"FORBIDDEN"}};
    if(!body?.websiteUrl) return {status:400,body:{error:"WEBSITE_URL_REQUIRED"}};

    // identity_test does not require an existing BrandProfile. A temporary test entity ID is safe
    // because canonical persistence is hard-disabled at this entry point.
    const entityId=body.entityId?.trim()||`identity-test:${crypto.randomUUID()}`;
    try {
      const result=await service.execute({executionProfileId:"identity_test",entityType:"brand",entityId,websiteUrl:body.websiteUrl,persistResults:false});
      return {status:200,body:{mode:"DRY_RUN",persisted:false,...result}};
    } catch(error) {
      return {status:500,body:{error:"IDENTITY_TEST_FAILED",message:error instanceof Error?error.message:"Unknown error"}};
    }
  };
}

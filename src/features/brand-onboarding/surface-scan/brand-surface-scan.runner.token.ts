export const BRAND_SURFACE_SCAN_RUNNER = Symbol("BRAND_SURFACE_SCAN_RUNNER");

export type SurfaceScanRunResult = {
  brandProfileId: string;
  domain: string;
  mode: "http" | "cached";
  counts: {
    offerings: number;
    competitors: number;
    locations: number;
  };
};

/**
 * Swappable orchestration boundary: today this is a synchronous Nest call, later it can be
 * swapped for an out-of-process MCP tool or a worker job without changing HTTP routes.
 */
export interface BrandSurfaceScanRunner {
  run(args: { leadId: string; force?: boolean }): Promise<SurfaceScanRunResult>;
}

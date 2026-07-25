import { Injectable } from "@nestjs/common";

export type SurfaceScanProgressPhase =
  | "signals"
  | "products"
  | "audience"
  | "competitors"
  | "persisting"
  | "complete"
  | "error";

export type SurfaceScanProgressSnapshot = {
  leadId: string;
  phase: SurfaceScanProgressPhase;
  completedPhases: SurfaceScanProgressPhase[];
  message?: string;
  error?: string;
  updatedAt: string;
};

@Injectable()
export class SurfaceScanProgressStore {
  private readonly byLeadId = new Map<string, SurfaceScanProgressSnapshot>();

  begin(leadId: string): void {
    this.byLeadId.set(leadId, {
      leadId,
      phase: "signals",
      completedPhases: [],
      message: "Reading brand signals",
      updatedAt: new Date().toISOString(),
    });
  }

  setPhase(
    leadId: string,
    phase: SurfaceScanProgressPhase,
    message?: string,
  ): void {
    const prev = this.byLeadId.get(leadId);
    const completed = new Set(prev?.completedPhases ?? []);
    if (prev && prev.phase !== phase && prev.phase !== "error") {
      completed.add(prev.phase);
    }
    this.byLeadId.set(leadId, {
      leadId,
      phase,
      completedPhases: [...completed],
      message,
      updatedAt: new Date().toISOString(),
    });
  }

  complete(leadId: string): void {
    const prev = this.byLeadId.get(leadId);
    const completed = new Set(prev?.completedPhases ?? []);
    if (prev?.phase && prev.phase !== "error") {
      completed.add(prev.phase);
    }
    for (const phase of [
      "signals",
      "products",
      "audience",
      "competitors",
    ] as const) {
      completed.add(phase);
    }
    this.byLeadId.set(leadId, {
      leadId,
      phase: "complete",
      completedPhases: [...completed],
      message: "Scan complete",
      updatedAt: new Date().toISOString(),
    });
  }

  fail(leadId: string, error: string): void {
    const prev = this.byLeadId.get(leadId);
    this.byLeadId.set(leadId, {
      leadId,
      phase: "error",
      completedPhases: prev?.completedPhases ?? [],
      error,
      message: error,
      updatedAt: new Date().toISOString(),
    });
  }

  get(leadId: string): SurfaceScanProgressSnapshot | null {
    return this.byLeadId.get(leadId) ?? null;
  }

  clear(leadId: string): void {
    this.byLeadId.delete(leadId);
  }
}

import { Injectable } from "@nestjs/common";

import type { BrandHomeSectionId } from "./brand-home.contract";
import {
  BRAND_HOME_PRIORITY_RANK,
  type BrandHomeCandidate,
} from "./brand-home.types";

@Injectable()
export class BrandHomePrioritizer {
  rank(candidate: BrandHomeCandidate): number {
    return BRAND_HOME_PRIORITY_RANK[candidate.priorityTier];
  }

  sort(
    sectionId: BrandHomeSectionId,
    candidates: readonly BrandHomeCandidate[],
  ): BrandHomeCandidate[] {
    return [...candidates].sort((left, right) => {
      const priority = this.rank(left) - this.rank(right);
      if (priority !== 0) return priority;
      if (sectionId === "NEEDS_ATTENTION") {
        const due = this.ascendingNullable(
          left.freshness.dueAt,
          right.freshness.dueAt,
        );
        if (due !== 0) return due;
      }
      const changed = this.descendingNullable(
        left.freshness.changedAt,
        right.freshness.changedAt,
      );
      return changed !== 0 ? changed : left.id.localeCompare(right.id);
    });
  }

  private ascendingNullable(left: string | null, right: string | null): number {
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left.localeCompare(right);
  }

  private descendingNullable(
    left: string | null,
    right: string | null,
  ): number {
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right.localeCompare(left);
  }
}

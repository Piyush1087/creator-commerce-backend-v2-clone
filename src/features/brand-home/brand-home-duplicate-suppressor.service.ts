import { Injectable } from "@nestjs/common";

import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";
import type { BrandHomeCandidate } from "./brand-home.types";

@Injectable()
export class BrandHomeDuplicateSuppressor {
  constructor(private readonly prioritizer: BrandHomePrioritizer) {}

  suppress(candidates: readonly BrandHomeCandidate[]): BrandHomeCandidate[] {
    const attentionCollaborations = new Set(
      candidates
        .filter((candidate) => candidate.kind === "COLLABORATION_ATTENTION")
        .flatMap((candidate) =>
          candidate.entityRefs
            .filter((ref) => ref.type === "COLLABORATION")
            .map((ref) => ref.id),
        ),
    );
    const opportunityOfferings = new Set(
      candidates
        .filter((candidate) => candidate.kind === "OFFERING_OPPORTUNITY")
        .flatMap((candidate) =>
          candidate.entityRefs
            .filter((ref) => ref.type === "OFFERING")
            .map((ref) => ref.id),
        ),
    );
    const filtered = candidates.filter((candidate) => {
      if (
        candidate.kind === "COLLABORATION_MOMENTUM" &&
        candidate.entityRefs.some(
          (ref) =>
            ref.type === "COLLABORATION" && attentionCollaborations.has(ref.id),
        )
      ) {
        return false;
      }
      return !(
        candidate.kind === "PRODUCT_INTELLIGENCE_LEARNED" &&
        candidate.entityRefs.some(
          (ref) => ref.type === "OFFERING" && opportunityOfferings.has(ref.id),
        )
      );
    });

    const selected = new Map<string, BrandHomeCandidate>();
    for (const candidate of filtered) {
      const current = selected.get(candidate.deduplicationKey);
      if (
        !current ||
        this.prioritizer.rank(candidate) < this.prioritizer.rank(current)
      ) {
        selected.set(candidate.deduplicationKey, candidate);
      } else if (
        this.prioritizer.rank(candidate) === this.prioritizer.rank(current)
      ) {
        selected.set(
          candidate.deduplicationKey,
          this.merge(
            current.id.localeCompare(candidate.id) <= 0 ? current : candidate,
            current.id.localeCompare(candidate.id) <= 0 ? candidate : current,
          ),
        );
      }
    }
    return [...selected.values()];
  }

  private merge(
    primary: BrandHomeCandidate,
    secondary: BrandHomeCandidate,
  ): BrandHomeCandidate {
    return {
      ...primary,
      entityRefs: this.unique(
        primary.entityRefs,
        secondary.entityRefs,
        (ref) => `${ref.type}:${ref.id}`,
      ),
      sourceDomains: this.unique(
        primary.sourceDomains,
        secondary.sourceDomains,
        (source) => source,
      ),
      limitations: this.unique(
        primary.limitations,
        secondary.limitations,
        (limitation) => limitation,
      ),
      freshness: {
        ...primary.freshness,
        changedAt: this.latest(
          primary.freshness.changedAt,
          secondary.freshness.changedAt,
        ),
        dueAt: this.earliest(
          primary.freshness.dueAt,
          secondary.freshness.dueAt,
        ),
      },
    };
  }

  private unique<T>(
    left: readonly T[],
    right: readonly T[],
    key: (value: T) => string,
  ): T[] {
    return [
      ...new Map(
        [...left, ...right].map((value) => [key(value), value]),
      ).values(),
    ];
  }

  private latest(left: string | null, right: string | null): string | null {
    if (!left) return right;
    if (!right) return left;
    return left > right ? left : right;
  }

  private earliest(left: string | null, right: string | null): string | null {
    if (!left) return right;
    if (!right) return left;
    return left < right ? left : right;
  }
}

export type FuzzyNamedEntity = {
  id: string;
  name: string;
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cur = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

/**
 * Score hint against entity name. Higher is better (0..1).
 */
export function scoreNameMatch(hint: string, name: string): number {
  const h = normalizeName(hint);
  const n = normalizeName(name);
  if (!h || !n) return 0;
  if (h === n) return 1;
  if (n.includes(h) || h.includes(n)) {
    return 0.92;
  }
  const maxLen = Math.max(h.length, n.length);
  const editScore = 1 - levenshtein(h, n) / maxLen;
  const tokenScore = jaccard(tokenSet(h), tokenSet(n));
  return Math.max(editScore * 0.55 + tokenScore * 0.45, tokenScore);
}

export function fuzzyMatchNamedEntity<T extends FuzzyNamedEntity>(
  hint: string | undefined | null,
  entities: T[],
  options?: { minScore?: number },
): T | null {
  const trimmed = String(hint ?? "").trim();
  if (!trimmed || entities.length === 0) {
    return null;
  }
  const minScore = options?.minScore ?? 0.55;
  let best: T | null = null;
  let bestScore = 0;
  for (const entity of entities) {
    const score = scoreNameMatch(trimmed, entity.name);
    if (score > bestScore) {
      best = entity;
      bestScore = score;
    }
  }
  return bestScore >= minScore ? best : null;
}

export function fuzzyMatchNamedEntities<T extends FuzzyNamedEntity>(
  hints: string[],
  entities: T[],
  options?: { minScore?: number },
): T[] {
  const matched: T[] = [];
  const used = new Set<string>();
  for (const hint of hints) {
    const hit = fuzzyMatchNamedEntity(
      hint,
      entities.filter((e) => !used.has(e.id)),
      options,
    );
    if (hit) {
      matched.push(hit);
      used.add(hit.id);
    }
  }
  return matched;
}

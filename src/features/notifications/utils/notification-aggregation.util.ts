import type { NotificationPayload } from "../types/notifications.types";

type AggregationMeta = {
  actor_count?: number;
  actor_names?: string[];
  last_actor_name?: string | null;
};

export function aggregatePayload(
  existing: NotificationPayload,
  actorName: string | null | undefined,
  incoming: NotificationPayload,
): NotificationPayload {
  const meta = (existing._aggregation as AggregationMeta | undefined) ?? {};
  const names = new Set(meta.actor_names ?? []);
  if (actorName && actorName.trim().length > 0) {
    names.add(actorName.trim());
  }

  return {
    ...existing,
    ...incoming,
    _aggregation: {
      actor_count: names.size,
      actor_names: Array.from(names),
      last_actor_name: actorName ?? meta.last_actor_name ?? null,
    },
  };
}

export function formatAggregationSummary(payload: NotificationPayload): string {
  const meta = payload._aggregation as AggregationMeta | undefined;
  const count = meta?.actor_count ?? 0;
  if (count <= 1) {
    return meta?.last_actor_name ?? "Someone";
  }
  return `${count} creators`;
}

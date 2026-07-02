import { z } from "zod";

import { NOTIFICATION_EVENT_REGISTRY } from "../config/notification-event-registry";

const eventTypeKeys = Object.keys(NOTIFICATION_EVENT_REGISTRY) as [
  string,
  ...string[],
];

export const notificationPayloadSchema = z.record(z.unknown());

export const dispatchNotificationSchema = z.object({
  event_type: z.enum(eventTypeKeys),
  payload: notificationPayloadSchema.default({}),
  actor_name: z.string().max(200).optional().nullable(),
  trigger_user_id: z.string().uuid().optional().nullable(),
});

export const testEmitNotificationSchema = dispatchNotificationSchema.extend({
  workspace_id: z.string().uuid().optional(),
});

export const markNotificationReadSchema = z.object({
  is_read: z.boolean().default(true),
});

export type DispatchNotificationInput = z.infer<
  typeof dispatchNotificationSchema
>;

export type TestEmitNotificationInput = z.infer<
  typeof testEmitNotificationSchema
>;

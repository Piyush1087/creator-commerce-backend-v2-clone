import { z } from "zod";

import { NOTIFICATION_EVENT_REGISTRY } from "../config/notification-event-registry";

const eventTypeKeys = Object.keys(NOTIFICATION_EVENT_REGISTRY) as [
  string,
  ...string[],
];

export const notificationPayloadSchema = z.record(z.unknown());

export const dispatchNotificationSchema = z
  .object({
    event_type: z.enum(eventTypeKeys),
    payload: notificationPayloadSchema.default({}),
    source_type: z.string().trim().min(1).max(100),
    source_id: z.string().trim().min(1).max(200),
    transition_id: z.string().trim().min(1).max(200),
  })
  .strict();

export const testEmitNotificationSchema = dispatchNotificationSchema;

export const markNotificationReadSchema = z.object({}).strict();

export type DispatchNotificationInput = z.infer<
  typeof dispatchNotificationSchema
>;

export type TestEmitNotificationInput = z.infer<
  typeof testEmitNotificationSchema
>;

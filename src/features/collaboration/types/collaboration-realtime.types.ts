export type CollaborationRealtimeEventType =
  | "thread.updated"
  | "message.created";

export type CollaborationRealtimePayload = {
  type: CollaborationRealtimeEventType;
  collaboration_id: string;
  at: string;
};

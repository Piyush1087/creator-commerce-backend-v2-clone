/**
 * Collaboration entities for prompt understanding (not Prisma models).
 */
export const COLLABORATION_ENTITIES = [
  "Campaign",
  "Creator",
  "Brand",
  "Collaboration",
  "Quote",
  "CounterOffer",
  "Escrow",
  "Shipment",
  "Deliverable",
  "Content",
  "Revision",
  "LivePost",
  "Compliance",
  "Timeline",
  "Stage",
] as const;

export type CollaborationEntity = (typeof COLLABORATION_ENTITIES)[number];

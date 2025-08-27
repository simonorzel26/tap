import { z } from "zod";
import { makeBrandedId, makeBrandedIsoInstant, ZEmailAddress, ZTimezone, ZCapacity, ZPositiveInt, ZNonNegativeInt } from "./zodPrimitives";

/** Per-entity branded IDs (stronger than a generic Id). */
export const ZActorId = makeBrandedId("ActorId");
export const ZResourceId = makeBrandedId("ResourceId");
export const ZSlotId = makeBrandedId("SlotId");
export const ZOfferId = makeBrandedId("OfferId");
export const ZHoldId = makeBrandedId("HoldId");
export const ZOrderId = makeBrandedId("OrderId");

export const ZIsoInstant = makeBrandedIsoInstant("IsoInstant");

/** Re-export primitives for convenience. */
export { ZCapacity, ZPositiveInt, ZNonNegativeInt, ZEmailAddress, ZTimezone };

/** Domain types (runtime-validating + branded at parse time). */
export const ZActor = z.object({
  id: ZActorId,
  email: ZEmailAddress
}).strict();
export type Actor = z.infer<typeof ZActor>;

export const ZResource = z.object({
  id: ZResourceId,
  timezone: ZTimezone,
  capacity: ZCapacity
}).strict();
export type Resource = z.infer<typeof ZResource>;

export const ZSlot = z.object({
  id: ZSlotId,
  resourceId: ZResourceId,
  start: ZIsoInstant,
  end: ZIsoInstant,
  capacity: ZCapacity
}).strict().refine(o => o.start < o.end, { message: "start<end" });
export type Slot = z.infer<typeof ZSlot>;

export const ZOffer = z.object({
  id: ZOfferId,
  slotId: ZSlotId,
  resourceId: ZResourceId,
  start: ZIsoInstant,
  end: ZIsoInstant,
  capacity: ZCapacity,
  issuedAt: ZIsoInstant,
  version: ZNonNegativeInt
}).strict();
export type Offer = z.infer<typeof ZOffer>;

export const ZHoldRequest = z.object({
  id: ZHoldId,
  slotId: ZSlotId,
  actorId: ZActorId,
  requestedTtlSeconds: ZPositiveInt.optional(),
  requestedAt: ZIsoInstant
}).strict();
export type HoldRequest = z.infer<typeof ZHoldRequest>;

export const ZHoldReceipt = z.object({
  id: ZHoldId,
  slotId: ZSlotId,
  actorId: ZActorId,
  expiresAt: ZIsoInstant,
  issuedAt: ZIsoInstant
}).strict();
export type HoldReceipt = z.infer<typeof ZHoldReceipt>;

export const ZReleaseRequest = z.object({
  holdId: ZHoldId,
  requestedAt: ZIsoInstant
}).strict();
export type ReleaseRequest = z.infer<typeof ZReleaseRequest>;

export const ZOrderCommand = z.object({
  id: ZOrderId,
  holdId: ZHoldId,
  actorId: ZActorId,
  requestedAt: ZIsoInstant
}).strict();
export type OrderCommand = z.infer<typeof ZOrderCommand>;

export const ZWorld = z.object({
  version: ZNonNegativeInt,
  resources: z.record(z.string(), ZResource),
  slots: z.record(z.string(), ZSlot),
  holds: z.record(z.string(), ZHoldReceipt),
  orders: z.record(z.string(), z.object({
    id: ZOrderId,
    holdId: ZHoldId,
    actorId: ZActorId,
    createdAt: ZIsoInstant
  }).strict())
}).strict();
export type World = z.infer<typeof ZWorld>;

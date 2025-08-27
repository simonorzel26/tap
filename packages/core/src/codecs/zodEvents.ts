import { z } from "zod";
import { EventType } from "../events/eventEnumsAndTypes";
import { ZIsoInstant, ZResourceId, ZSlotId, ZOfferId, ZHoldId, ZOrderId, ZActorId, ZCapacity } from "./zodDomain";

/** Schemas use native enums (no string literals). */
export const ZEventResourceCreated = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.ResourceCreated, { message: "ResourceCreated" }),
  at: ZIsoInstant,
  resourceId: ZResourceId,
  timezone: z.string().min(1),
  capacity: ZCapacity
}).strict();

export const ZEventSlotPublished = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.SlotPublished, { message: "SlotPublished" }),
  at: ZIsoInstant,
  slotId: ZSlotId,
  resourceId: ZResourceId,
  start: ZIsoInstant,
  end: ZIsoInstant,
  capacity: ZCapacity
}).strict().refine(o => o.start < o.end, { message: "start<end" });

export const ZEventOfferIssued = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.OfferIssued, { message: "OfferIssued" }),
  at: ZIsoInstant,
  offerId: ZOfferId,
  slotId: ZSlotId,
  resourceId: ZResourceId,
  start: ZIsoInstant,
  end: ZIsoInstant,
  capacity: ZCapacity,
  version: z.number().int().nonnegative()
}).strict();

export const ZEventHoldPlaced = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.HoldPlaced, { message: "HoldPlaced" }),
  at: ZIsoInstant,
  holdId: ZHoldId,
  slotId: ZSlotId,
  actorId: ZActorId,
  expiresAt: ZIsoInstant
}).strict();

export const ZEventHoldReleased = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.HoldReleased, { message: "HoldReleased" }),
  at: ZIsoInstant,
  holdId: ZHoldId
}).strict();

export const ZEventOrderConfirmed = z.object({
  type: z.nativeEnum(EventType).refine(v => v === EventType.OrderConfirmed, { message: "OrderConfirmed" }),
  at: ZIsoInstant,
  orderId: ZOrderId,
  holdId: ZHoldId,
  actorId: ZActorId
}).strict();

export const ZLedgerEvent = z.union([
  ZEventResourceCreated,
  ZEventSlotPublished,
  ZEventOfferIssued,
  ZEventHoldPlaced,
  ZEventHoldReleased,
  ZEventOrderConfirmed
]);

export const ZEventEnvelope = z.object({
  version: z.number().int().nonnegative(),
  event: ZLedgerEvent
}).strict();

import { IsoInstant } from "../time/isoInstant";
import { ResourceId, SlotId, HoldId, OfferId, OrderId, ActorId } from "../ids/semanticIds";

/** EventType: discriminant for the event union (enum = no string literals). */
export enum EventType {
  ResourceCreated = "ResourceCreated",
  SlotPublished = "SlotPublished",
  OfferIssued = "OfferIssued",
  HoldPlaced = "HoldPlaced",
  HoldReleased = "HoldReleased",
  OrderConfirmed = "OrderConfirmed"
}

export type EventResourceCreated = {
  type: EventType.ResourceCreated;
  at: IsoInstant;
  resourceId: ResourceId;
  timezone: string;
  capacity: number;
};

export type EventSlotPublished = {
  type: EventType.SlotPublished;
  at: IsoInstant;
  slotId: SlotId;
  resourceId: ResourceId;
  start: IsoInstant;
  end: IsoInstant;
  capacity: number;
};

export type EventOfferIssued = {
  type: EventType.OfferIssued;
  at: IsoInstant;
  offerId: OfferId;
  slotId: SlotId;
  resourceId: ResourceId;
  start: IsoInstant;
  end: IsoInstant;
  capacity: number;
  version: number;
};

export type EventHoldPlaced = {
  type: EventType.HoldPlaced;
  at: IsoInstant;
  holdId: HoldId;
  slotId: SlotId;
  actorId: ActorId;
  expiresAt: IsoInstant;
};

export type EventHoldReleased = {
  type: EventType.HoldReleased;
  at: IsoInstant;
  holdId: HoldId;
};

export type EventOrderConfirmed = {
  type: EventType.OrderConfirmed;
  at: IsoInstant;
  orderId: OrderId;
  holdId: HoldId;
  actorId: ActorId;
};

export type LedgerEvent =
  | EventResourceCreated
  | EventSlotPublished
  | EventOfferIssued
  | EventHoldPlaced
  | EventHoldReleased
  | EventOrderConfirmed;

export type EventEnvelope = { version: number; event: LedgerEvent };

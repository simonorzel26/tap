import { ActorId, ResourceId, SlotId, HoldId, OrderId } from "../ids/semanticIds";
import { IsoInstant } from "../time/isoInstant";

/** Junior: "domain" = real-world nouns we model. */
export type Actor = { id: ActorId; email: string };
export type Resource = { id: ResourceId; timezone: string; capacity: number };
export type Slot = { id: SlotId; resourceId: ResourceId; start: IsoInstant; end: IsoInstant; capacity: number };

export type HoldReceipt = { id: HoldId; slotId: SlotId; actorId: ActorId; expiresAt: IsoInstant; issuedAt: IsoInstant };
export type Order = { id: OrderId; holdId: HoldId; actorId: ActorId; createdAt: IsoInstant };

/** Snapshot produced by replaying events (append-only ledger). */
export type World = {
  version: number;
  resources: Record<string, Resource>;
  slots: Record<string, Slot>;
  holds: Record<string, HoldReceipt>;
  orders: Record<string, Order>;
};

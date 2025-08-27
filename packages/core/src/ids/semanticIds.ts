import { Brand, brand } from "../base/brandTypes";

/** Distinct branded IDs prevent accidental mixups across entities. */
export type ActorId = Brand<string, "ActorId">;
export type ResourceId = Brand<string, "ResourceId">;
export type SlotId = Brand<string, "SlotId">;
export type OfferId = Brand<string, "OfferId">;
export type HoldId = Brand<string, "HoldId">;
export type OrderId = Brand<string, "OrderId">;

/** Version: monotonic (always increasing) integer for event ordering. */
export type Version = Brand<number, "Version">;

export const asActorId = (s: string): ActorId => brand<string, "ActorId">(s);
export const asResourceId = (s: string): ResourceId => brand<string, "ResourceId">(s);
export const asSlotId = (s: string): SlotId => brand<string, "SlotId">(s);
export const asOfferId = (s: string): OfferId => brand<string, "OfferId">(s);
export const asHoldId = (s: string): HoldId => brand<string, "HoldId">(s);
export const asOrderId = (s: string): OrderId => brand<string, "OrderId">(s);

export const asVersion = (n: number): Version => {
  if (!Number.isInteger(n) || n < 0) throw new Error("Version must be a non-negative integer");
  return brand<number, "Version">(n);
};
export const nextVersion = (v: Version): Version => asVersion((v as number) + 1);

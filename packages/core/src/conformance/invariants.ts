import { World } from "../codecs/zodDomain";

/**
 * Invariant: number of active holds must not exceed capacity in a slot.
 * Junior: "invariant" = a rule that must always be true.
 */
export const invariantActiveHoldsWithinCapacity = (world: World): boolean => {
  for (const slot of Object.values(world.slots)) {
    const active = Object.values(world.holds).filter((h: any) => h.slotId === slot.id && h.expiresAt > slot.start);
    if (active.length > slot.capacity) return false;
  }
  return true;
};

/** Invariant: confirmed orders per slot must not exceed capacity. */
export const invariantOrdersWithinCapacity = (world: World): boolean => {
  for (const slot of Object.values(world.slots)) {
    const ordersForSlot = Object.values(world.orders).filter((o: any) => world.holds[o.holdId as unknown as string]?.slotId === slot.id);
    if (ordersForSlot.length > slot.capacity) return false;
  }
  return true;
};

/** Invariant: all referenced IDs must exist. */
export const invariantReferencedIdsExist = (world: World): boolean => {
  for (const o of Object.values(world.orders)) if (!world.holds[(o as any).holdId as unknown as string]) return false;
  for (const h of Object.values(world.holds)) if (!world.slots[(h as any).slotId as unknown as string]) return false;
  for (const s of Object.values(world.slots)) if (!world.resources[(s as any).resourceId as unknown as string]) return false;
  return true;
};

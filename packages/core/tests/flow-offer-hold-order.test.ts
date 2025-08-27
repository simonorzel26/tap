import { describe, it, expect } from "bun:test";
import {
  createEmptyWorld, wrapEventAsNextEnvelope, applyEnvelopeToWorld,
  planPublishSlot, planPlaceHold, planConfirmOrder, planIssueOffer
} from "../src/state/pureReducerAndPlans";
import { EventType } from "../src/events/eventEnumsAndTypes";

describe("Offer → Hold → Order (strongly typed + minimal)", () => {
  it("publishes slot, issues offer, places hold, confirms order", () => {
    const now = "2025-08-27T10:00:00Z";
    let world = createEmptyWorld();

    world = applyEnvelopeToWorld(world, wrapEventAsNextEnvelope(world, {
      type: EventType.ResourceCreated,
      at: now,
      resourceId: "resource-1",
      timezone: "Europe/Berlin",
      capacity: 1
    }));

    const slotPlan = planPublishSlot(world, {
      type: EventType.SlotPublished,
      at: now,
      slotId: "slot-1",
      resourceId: "resource-1",
      start: "2025-08-28T10:00:00Z",
      end:   "2025-08-28T11:00:00Z",
      capacity: 1
    });
    expect(slotPlan.ok).toBe(true);
    world = applyEnvelopeToWorld(world, wrapEventAsNextEnvelope(world, (slotPlan as any).value));

    const offerPlan = planIssueOffer(world, now, "slot-1", "offer-1", 0);
    expect(offerPlan.ok).toBe(true);

    const holdPlan = planPlaceHold(world, { id: "hold-1", slotId: "slot-1", actorId: "actor-1", requestedAt: now }, 600);
    expect(holdPlan.ok).toBe(true);
    world = applyEnvelopeToWorld(world, wrapEventAsNextEnvelope(world, (holdPlan as any).value));

    const orderPlan = planConfirmOrder(world, { id: "order-1", holdId: "hold-1", actorId: "actor-1", requestedAt: now });
    expect(orderPlan.ok).toBe(true);
    world = applyEnvelopeToWorld(world, wrapEventAsNextEnvelope(world, (orderPlan as any).value));

    expect(Object.keys(world.orders)).toHaveLength(1);
  });
});

import { z } from "zod";
import { ZWorld, ZHoldRequest, ZOrderCommand, ZReleaseRequest, World } from "../codecs/zodDomain";
import { ZEventEnvelope, ZLedgerEvent, ZEventSlotPublished } from "../codecs/zodEvents";
import { success, failure, Result } from "../base/resultTypes";
import { makeTapProblem, TapErrorCode } from "../errors/problemDetails9457";
import { EventType } from "../events/eventEnumsAndTypes";



export const createEmptyWorld = (): World => ({
  version: 0,
  resources: {},
  slots: {},
  holds: {},
  orders: {}
});

export const validateEnvelope = (env: unknown) => ZEventEnvelope.parse(env);
export const validateEvent = (ev: unknown) => ZLedgerEvent.parse(ev);

/** Apply a single envelope with version continuity check. */
export const applyEnvelopeToWorld = (world: World, rawEnvelope: unknown): World => {
  const { version, event } = validateEnvelope(rawEnvelope);
  if (world.version + 1 !== version) throw new Error("version-gap");

  switch (event.type) {
    case EventType.ResourceCreated: {
      const e = event as any;
      world.resources[e.resourceId as unknown as string] = {
        id: e.resourceId,
        timezone: e.timezone,
        capacity: e.capacity
      };
      break;
    }

    case EventType.SlotPublished: {
      const e = event as any;
      world.slots[e.slotId as unknown as string] = {
        id: e.slotId,
        resourceId: e.resourceId,
        start: e.start,
        end: e.end,
        capacity: e.capacity
      };
      break;
    }

    case EventType.OfferIssued:
      // Publish-only metadata; world snapshot does not change.
      break;

    case EventType.HoldPlaced: {
      const e = event as any;
      world.holds[e.holdId as unknown as string] = {
        id: e.holdId,
        slotId: e.slotId,
        actorId: e.actorId,
        expiresAt: e.expiresAt,
        issuedAt: e.at
      };
      break;
    }

    case EventType.HoldReleased: {
      const e = event as any;
      delete world.holds[e.holdId as unknown as string];
      break;
    }

    case EventType.OrderConfirmed: {
      const e = event as any;
      world.orders[e.orderId as unknown as string] = {
        id: e.orderId,
        holdId: e.holdId,
        actorId: e.actorId,
        createdAt: e.at
      };
      delete world.holds[e.holdId as unknown as string];
      break;
    }
  }

  world.version = version;
  return world;
};

/** Reduce many envelopes into one world snapshot. */
export const reduceEnvelopes = (envelopes: unknown[]): Result<World, unknown> => {
  let world = createEmptyWorld();
  for (const env of envelopes) {
    try { world = applyEnvelopeToWorld(world, env); }
    catch (e) { return failure(makeTapProblem(TapErrorCode.Unknown, { detail: String(e) })); }
  }
  return success(world);
};

/** Ensure the next envelope has the correct monotonic version. */
export const wrapEventAsNextEnvelope = (world: World, event: unknown) => {
  const ev = validateEvent(event);
  return ZEventEnvelope.parse({ version: world.version + 1, event: ev });
};

/** Publish a slot (helper validates resource existence). */
export const planPublishSlot = (world: World, candidateEvent: unknown) => {
  const slotEvent = ZEventSlotPublished.parse(candidateEvent);
  const resource = world.resources[slotEvent.resourceId as unknown as string];
  if (!resource) return failure(makeTapProblem(TapErrorCode.ResourceNotFound, { detail: "resource" }));
  return success(slotEvent);
};

/** Issue an offer for an existing slot (no state change). */
export const planIssueOffer = (world: World, nowIso: unknown, slotId: unknown, offerId: unknown, version: number) => {
  const slot = world.slots[String(slotId)];
  if (!slot) return failure(makeTapProblem(TapErrorCode.ResourceNotFound, { detail: "slot" }));
  return success({
    type: EventType.OfferIssued,
    at: nowIso,
    offerId,
    slotId,
    resourceId: slot.resourceId,
    start: slot.start,
    end: slot.end,
    capacity: slot.capacity,
    version
  });
};

/** Place a hold (capacity + expiry checks). */
export const planPlaceHold = (world: World, request: unknown, finalTtlSeconds: number) => {
  const holdRequest = ZHoldRequest.parse(request);
  const slot = world.slots[holdRequest.slotId as unknown as string];
  if (!slot) return failure(makeTapProblem(TapErrorCode.ResourceNotFound, { detail: "slot" }));
  if (holdRequest.requestedAt >= slot.end) return failure(makeTapProblem(TapErrorCode.TemporalInvalidWindow));

  const activeHolds = Object.values(world.holds)
    .filter((h: any) => h.slotId === slot.id && h.expiresAt > holdRequest.requestedAt);
  if (activeHolds.length >= slot.capacity) return failure(makeTapProblem(TapErrorCode.AvailabilityCapacityExceeded));

  const anyConfirmedOrder = Object.values(world.orders)
    .some((o: any) => world.holds[o.holdId as unknown as string]?.slotId === slot.id);
  if (anyConfirmedOrder) return failure(makeTapProblem(TapErrorCode.ConflictTimeOverlap));

  const expiresAt = new Date(new Date(holdRequest.requestedAt as string).getTime() + finalTtlSeconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z") as any;
  return success({
    type: EventType.HoldPlaced,
    at: holdRequest.requestedAt,
    holdId: holdRequest.id,
    slotId: holdRequest.slotId,
    actorId: holdRequest.actorId,
    expiresAt
  });
};

/** Release a hold idempotently (DELETE is naturally idempotent). */
export const planReleaseHold = (world: World, request: unknown) => {
  const r = ZReleaseRequest.parse(request);
  const hold = world.holds[r.holdId as unknown as string];
  if (!hold) return failure(makeTapProblem(TapErrorCode.ResourceNotFound, { detail: "hold" }));
  return success({ type: EventType.HoldReleased, at: r.requestedAt, holdId: r.holdId });
};

/** Confirm an order from a valid, unexpired hold. */
export const planConfirmOrder = (world: World, command: unknown) => {
  const c = ZOrderCommand.parse(command);
  const hold = world.holds[c.holdId as unknown as string];
  if (!hold) return failure(makeTapProblem(TapErrorCode.ResourceNotFound, { detail: "hold" }));
  if (hold.actorId !== c.actorId) return failure(makeTapProblem(TapErrorCode.AuthUnauthorized));
  if (hold.expiresAt <= c.requestedAt) return failure(makeTapProblem(TapErrorCode.TemporalPastWindow));

  return success({
    type: EventType.OrderConfirmed,
    at: c.requestedAt,
    orderId: c.id,
    holdId: c.holdId,
    actorId: c.actorId
  });
};

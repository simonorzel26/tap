// tap-protocol.test.ts
// bun test
import { describe, it, expect } from "bun:test";
import { z } from "zod";

// Import the protocol module you saved previously as "tap-protocol.ts"
import {
  TAP_VERSION,
  TAP_MIME,
  EnvelopeBaseZ,
  CommandZ,
  EventZ,
  QueryZ,
  ReplyZ,
  ErrZ,
  MessageZ,
  ResourceDescriptorZ,
  IntervalZ,
  DeltaZ,
  Qry_CutCreateZ,
  Rpy_CutCreatedZ,
  Qry_StateSnapshotZ,
  Rpy_StateSnapshotZ,
  Qry_StreamOpenZ,
  Rpy_StreamOpenedZ,
  Evt_StateBootstrapZ,
  Evt_SupplyDeltaAppliedZ,
  Evt_AllocCommittedZ,
  Evt_AllocCanceledZ,
  Evt_HoldPlacedZ,
  Evt_HoldReleasedZ,
  Qry_FreeBusyGetZ,
  Rpy_FreeBusyDataZ,
  Qry_FeasibleCheckZ,
  Rpy_FeasibleResultZ,
  isCommand,
  isEvent,
  isQuery,
  isReply,
  isError,
  type Delta,
  type ISO8601,
  type Sequence,
} from "../src/core";

// Helpers
const iso = (s: string) => new Date(s).toISOString() as ISO8601;
const seq = (n: number) => n as Sequence;

const byAt = (a: Delta, b: Delta) => Date.parse(a.at) - Date.parse(b.at);

const integrateAt = (baseline: number, deltas: Delta[], t: string): number => {
  let v = baseline;
  const cutoff = Date.parse(t);
  for (const d of deltas) if (Date.parse(d.at) <= cutoff) v += d.delta;
  return v;
};

const integrateRangeMin = (
  baseline: number,
  deltas: Delta[],
  start: string,
  end: string,
): number => {
  let v = baseline;
  let min = v;
  let t = Date.parse(start);
  const E = Date.parse(end);
  const ds = [...deltas].sort(byAt);
  let i = 0;
  while (t < E) {
    const next = i < ds.length ? Math.min(Date.parse(ds[i].at), E) : E;
    min = Math.min(min, v);
    if (next === E) break;
    v += ds[i].delta;
    i++;
    t = next;
  }
  return min;
};

describe("TAP protocol primitives", () => {
  it("validates constants", () => {
    expect(TAP_VERSION.startsWith("tap/")).toBe(true);
    expect(TAP_MIME).toBe("application/tap+json");
  });

  it("validates IntervalZ and DeltaZ", () => {
    expect(() => IntervalZ.parse({ start: iso("2025-09-01T10:00:00Z"), end: iso("2025-09-01T11:00:00Z") })).not.toThrow();
    expect(() => IntervalZ.parse({ start: iso("2025-09-01T12:00:00Z"), end: iso("2025-09-01T11:00:00Z") })).toThrow();
    expect(() => DeltaZ.parse({ at: iso("2025-09-01T10:00:00Z"), delta: 1 })).not.toThrow();
  });

  it("accepts a ResourceDescriptor", () => {
    const r = {
      urn: "urn:tap:resource:room-301",
      authority: "did:web:hotel.example",
      timezone: "Europe/Berlin",
      kind: "room",
      capacityDefault: 1,
      attributes: { floor: 3 },
    };
    expect(() => ResourceDescriptorZ.parse(r)).not.toThrow();
  });

  it("wraps payloads in Envelope and validates MessageZ", () => {
    const cmd = CommandZ.parse({
      kind: "cmd",
      type: "supply.delta",
      idem: "idem-abc12345",
      resource: "urn:tap:resource:room-301",
      interval: { start: iso("2025-09-01T09:00:00Z"), end: iso("2025-09-01T17:00:00Z") },
      delta: +1,
      note: "opening hours",
    });
    const env = EnvelopeBaseZ.parse({
      v: TAP_VERSION,
      id: crypto.randomUUID(),
      ts: iso("2025-08-28T10:00:00Z"),
      issuer: "did:web:hotel.example",
      subj: "urn:tap:resource:room-301",
      corr: crypto.randomUUID(),
      meta: { traceId: "trace-1" },
    });
    expect(() => MessageZ.parse({ ...env, ...cmd })).not.toThrow();
  });
});

describe("Commands and Events (five core verbs)", () => {
  it("supply.delta → evt:supply.delta.applied shape coherence", () => {
    const evt = Evt_SupplyDeltaAppliedZ.parse({
      kind: "evt",
      type: "supply.delta.applied",
      resource: "urn:tap:resource:room-301",
      interval: { start: iso("2025-09-01T09:00:00Z"), end: iso("2025-09-01T17:00:00Z") },
      delta: +1,
      sourceIdem: "idem-abc12345",
      seq: seq(42),
    });
    expect(evt.delta).toBe(1);
    expect(evt.seq).toBe(seq(42));
  });

  it("hold.place → hold.placed; hold.confirm → alloc.committed; hold.release → hold.released; alloc.cancel → alloc.canceled", () => {
    const placed = Evt_HoldPlacedZ.parse({
      kind: "evt",
      type: "hold.placed",
      holdId: crypto.randomUUID(),
      resources: ["urn:tap:resource:room-301"],
      interval: { start: iso("2025-09-02T10:00:00Z"), end: iso("2025-09-02T11:00:00Z") },
      demands: [1],
      expiresAt: iso("2025-09-02T10:15:00Z"),
      seq: seq(101),
    });
    const committed = Evt_AllocCommittedZ.parse({
      kind: "evt",
      type: "alloc.committed",
      holdId: placed.holdId,
      allocationId: crypto.randomUUID(),
      seq: seq(102),
    });
    const released = Evt_HoldReleasedZ.parse({
      kind: "evt",
      type: "hold.released",
      holdId: placed.holdId,
      reason: "manual",
      seq: seq(103),
    });
    const canceled = Evt_AllocCanceledZ.parse({
      kind: "evt",
      type: "alloc.canceled",
      allocationId: committed.allocationId,
      reason: "customer_cancel",
      seq: seq(104),
    });
    expect(placed.seq && committed.seq && placed.seq < committed.seq).toBe(true);
    expect(released.reason).toBe("manual");
    expect(canceled.reason).toBe("customer_cancel");
  });
});

describe("Queries/Replies: feasibility, freebusy, snapshot + cut", () => {
  it("feasible.check and feasible.result validate", () => {
    const q = Qry_FeasibleCheckZ.parse({
      kind: "qry",
      type: "feasible.check",
      resources: ["urn:tap:resource:room-301"],
      interval: { start: iso("2025-09-05T09:00:00Z"), end: iso("2025-09-05T10:00:00Z") },
      demands: [1],
    });
    const r = Rpy_FeasibleResultZ.parse({
      kind: "rpy",
      type: "feasible.result",
      ok: true,
    });
    expect(q.resources.length).toBe(1);
    expect(r.ok).toBe(true);
  });

  it("freebusy.get/data validate", () => {
    const q = Qry_FreeBusyGetZ.parse({
      kind: "qry",
      type: "freebusy.get",
      resource: "urn:tap:resource:room-301",
      window: { start: iso("2025-09-01T00:00:00Z"), end: iso("2025-09-02T00:00:00Z") },
    });
    const r = Rpy_FreeBusyDataZ.parse({
      kind: "rpy",
      type: "freebusy.data",
      resource: q.resource,
      window: q.window,
      busy: [{ start: iso("2025-09-01T10:00:00Z"), end: iso("2025-09-01T11:00:00Z") }],
    });
    expect(r.busy.length).toBe(1);
  });

  it("cut.created + state.snapshot coherence and resume", () => {
    const cut = Rpy_CutCreatedZ.parse({
      kind: "rpy",
      type: "cut.created",
      cutId: crypto.randomUUID(),
      seqs: [{ resource: "urn:tap:resource:room-301", seqHi: seq(500) }],
      issuedAt: iso("2025-09-01T12:00:00Z"),
    });

    const snapRpy = Rpy_StateSnapshotZ.parse({
      kind: "rpy",
      type: "state.snapshot",
      cutId: cut.cutId,
      resource: "urn:tap:resource:room-301",
      window: { start: iso("2025-09-01T00:00:00Z"), end: iso("2025-09-02T00:00:00Z") },
      supply: [
        { at: iso("2025-09-01T09:00:00Z"), delta: +1 },
        { at: iso("2025-09-01T17:00:00Z"), delta: -1 },
      ],
      allocation: [
        { at: iso("2025-09-01T10:00:00Z"), delta: +1 },
        { at: iso("2025-09-01T11:00:00Z"), delta: -1 },
      ],
      seqHi: seq(500),
    });

    expect(snapRpy.seqHi).toBe(seq(500));

    const availAt0930 = integrateAt(0, snapRpy.supply, iso("2025-09-01T09:30:00Z")) - integrateAt(0, snapRpy.allocation, iso("2025-09-01T09:30:00Z"));
    const availAt1030 = integrateAt(0, snapRpy.supply, iso("2025-09-01T10:30:00Z")) - integrateAt(0, snapRpy.allocation, iso("2025-09-01T10:30:00Z"));
    const availAt1730 = integrateAt(0, snapRpy.supply, iso("2025-09-01T17:30:00Z")) - integrateAt(0, snapRpy.allocation, iso("2025-09-01T17:30:00Z"));

    expect(availAt0930).toBe(1);
    expect(availAt1030).toBe(0);
    expect(availAt1730).toBe(0);

    const minAvail = integrateRangeMin(
      0,
      [
        { at: iso("2025-09-01T09:00:00Z"), delta: +1 },
        { at: iso("2025-09-01T10:00:00Z"), delta: -1 },
        { at: iso("2025-09-01T11:00:00Z"), delta: +1 },
        { at: iso("2025-09-01T17:00:00Z"), delta: -1 },
      ],
      iso("2025-09-01T10:00:00Z"),
      iso("2025-09-01T11:00:00Z"),
    );
    expect(minAvail).toBe(0);
  });
});

describe("Stream bootstrap + tail semantics", () => {
  it("state.bootstrap frames reconstruct exact availability at asOf and allow strict tail", () => {
    const bootstrap = Evt_StateBootstrapZ.parse({
      kind: "evt",
      type: "state.bootstrap",
      resource: "urn:tap:resource:bus-42",
      window: { start: iso("2025-09-10T00:00:00Z"), end: iso("2025-09-11T00:00:00Z") },
      asOfSeq: seq(200),
      asOfTs: iso("2025-09-10T12:00:00Z"),
      baseline: { supply0: 0, allocation0: 0 },
      supply: [
        { at: iso("2025-09-10T08:00:00Z"), delta: +50 },
      ],
      allocation: [
        { at: iso("2025-09-10T09:00:00Z"), delta: +10 },
        { at: iso("2025-09-10T09:30:00Z"), delta: +10 },
      ],
    });

    const supplyAt1130 = integrateAt(bootstrap.baseline.supply0, bootstrap.supply, iso("2025-09-10T11:30:00Z"));
    const allocAt1130 = integrateAt(bootstrap.baseline.allocation0, bootstrap.allocation, iso("2025-09-10T11:30:00Z"));
    expect(supplyAt1130).toBe(50);
    expect(allocAt1130).toBe(20);
    expect(supplyAt1130 - allocAt1130).toBe(30);

    const tailEvent = Evt_SupplyDeltaAppliedZ.parse({
      kind: "evt",
      type: "supply.delta.applied",
      resource: bootstrap.resource,
      interval: { start: iso("2025-09-10T12:15:00Z"), end: iso("2025-09-10T12:45:00Z") },
      delta: +10,
      seq: seq(bootstrap.asOfSeq + 1),
    });
    expect(tailEvent.seq! > bootstrap.asOfSeq).toBe(true);
  });

  it("stream.open negotiation payloads validate", () => {
    const open = Qry_StreamOpenZ.parse({
      kind: "qry",
      type: "stream.open",
      resources: ["urn:tap:resource:room-301", "urn:tap:resource:room-305"],
      window: { start: iso("2025-09-01T00:00:00Z"), end: iso("2025-09-08T00:00:00Z") },
      includeBootstrap: true,
      heartbeatSec: 30,
    });
    const opened = Rpy_StreamOpenedZ.parse({
      kind: "rpy",
      type: "stream.opened",
      streamId: crypto.randomUUID(),
      heartbeatSec: 30,
    });
    expect(open.includeBootstrap).toBe(true);
    expect(opened.streamId).toBeTypeOf("string");
  });
});

describe("Message unions & type guards", () => {
  it("discriminates cmd/evt/qry/rpy/err correctly", () => {
    const env = {
      v: TAP_VERSION,
      id: crypto.randomUUID(),
      ts: iso("2025-08-28T12:00:00Z"),
      issuer: "did:web:node.example",
    };

    const cmdMsg = MessageZ.parse({ ...env, kind: "cmd", type: "supply.delta", idem: "idem-12345678", resource: "urn:tap:resource:x", interval: { start: iso("2025-10-01T00:00:00Z"), end: iso("2025-10-01T12:00:00Z") }, delta: +1 });
    const evtMsg = MessageZ.parse({ ...env, kind: "evt", type: "alloc.canceled", allocationId: crypto.randomUUID() });
    const qryMsg = MessageZ.parse({ ...env, kind: "qry", type: "freebusy.get", resource: "urn:tap:resource:x", window: { start: iso("2025-10-01T00:00:00Z"), end: iso("2025-10-02T00:00:00Z") } });
    const rpyMsg = MessageZ.parse({ ...env, kind: "rpy", type: "freebusy.data", resource: "urn:tap:resource:x", window: { start: iso("2025-10-01T00:00:00Z"), end: iso("2025-10-02T00:00:00Z") }, busy: [] });
    const errMsg = MessageZ.parse({ ...env, kind: "err", code: "bad_request", message: "nope" });

    expect(isCommand(cmdMsg)).toBe(true);
    expect(isEvent(evtMsg)).toBe(true);
    expect(isQuery(qryMsg)).toBe(true);
    expect(isReply(rpyMsg)).toBe(true);
    expect(isError(errMsg)).toBe(true);
  });
});

describe("Zero-sum invariant sanity (projection-level check)", () => {
  it("allocation never exceeds supply over a window in a coherent snapshot", () => {
    const window = { start: iso("2025-09-03T08:00:00Z"), end: iso("2025-09-03T12:00:00Z") };
    const supply: Delta[] = [
      { at: iso("2025-09-03T08:00:00Z"), delta: +2 },
      { at: iso("2025-09-03T10:00:00Z"), delta: +1 },
    ];
    const allocation: Delta[] = [
      { at: iso("2025-09-03T09:00:00Z"), delta: +1 },
      { at: iso("2025-09-03T11:00:00Z"), delta: +1 },
    ];

    const checkpoints = [
      iso("2025-09-03T08:30:00Z"),
      iso("2025-09-03T09:30:00Z"),
      iso("2025-09-03T10:30:00Z"),
      iso("2025-09-03T11:30:00Z"),
    ];

    for (const t of checkpoints) {
      const S = integrateAt(0, supply, t);
      const A = integrateAt(0, allocation, t);
      expect(S - A).toBeGreaterThanOrEqual(0);
    }

    const minAvail = integrateRangeMin(
      0,
      [
        { at: supply[0].at, delta: +2 },
        { at: allocation[0].at, delta: -1 },
        { at: supply[1].at, delta: +1 },
        { at: allocation[1].at, delta: -1 },
      ],
      window.start,
      window.end,
    );
    expect(minAvail).toBeGreaterThanOrEqual(0);
  });
});

describe("Error frames validate", () => {
  it("ErrZ validates canonical error codes", () => {
    const e = ErrZ.parse({ kind: "err", code: "capacity_violation", message: "over allocation" });
    expect(e.code).toBe("capacity_violation");
  });
});
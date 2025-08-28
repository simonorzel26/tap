// tap-protocol.ts
// Core wire contracts for TAP (Time Allocation Protocol)
// Stable, transport-agnostic JSON messages (Zod-validated).
// Mutations are idempotent; state changes are append-only events.
// bun add zod

import { z } from "zod";

/* ────────────────────────────────────────────────────────────────────────── */
/* 0) Version & constants                                                     */
/* ────────────────────────────────────────────────────────────────────────── */
export const TAP_VERSION = "tap/0.1" as const;
export const TAP_MIME = "application/tap+json" as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* 1) Brands & primitives                                                     */
/* ────────────────────────────────────────────────────────────────────────── */
type Brand<T, B extends string> = T & { readonly __brand: B };
export type UID = Brand<string, "uid">;
export type URN = Brand<string, "urn">;           // e.g., "urn:tap:resource:<uuid>"
export type NodeID = Brand<string, "node">;       // e.g., "did:web:example.com"
export type ISO8601 = Brand<string, "iso8601">;   // UTC
export type IdempotencyKey = Brand<string, "idem">;
export type TimeZone = Brand<string, "tz">;
export type Sequence = Brand<number, "seq">;      // per-resource monotone

const uid  = z.string().min(1).transform(v => v as UID);
const urn  = z.string().min(1).transform(v => v as URN);
const node = z.string().min(1).transform(v => v as NodeID);
const iso  = z.string().refine(v => !Number.isNaN(Date.parse(v)), "ISO-8601").transform(v => v as ISO8601);
const idem = z.string().min(8).transform(v => v as IdempotencyKey);
const tz   = z.string().min(1).transform(v => v as TimeZone);
const seqZ = z.number().int().nonnegative().transform(v => v as Sequence);

export const IntervalZ = z.object({ start: iso, end: iso })
  .refine(({ start, end }) => Date.parse(start) < Date.parse(end), { message: "start < end" });
export type Interval = z.infer<typeof IntervalZ>;

export const DemandZ = z.number().int().positive();
export type Demand = z.infer<typeof DemandZ>;

export const DeltaZ = z.object({ at: iso, delta: z.number().int() });
export type Delta = z.infer<typeof DeltaZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 2) Resource discovery (non-mutating)                                       */
/* ────────────────────────────────────────────────────────────────────────── */
export const ResourceDescriptorZ = z.object({
  urn,
  authority: node,
  timezone: tz,
  kind: z.string().min(1),               // "room" | "person" | "equipment" | "pool" | ...
  capacityDefault: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type ResourceDescriptor = z.infer<typeof ResourceDescriptorZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 3) Envelope (observability, causality, signing)                            */
/* ────────────────────────────────────────────────────────────────────────── */
export const EnvelopeMetaZ = z.object({
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
}).default({});

export const EnvelopeBaseZ = z.object({
  v: z.literal(TAP_VERSION),
  id: uid,                 // message id
  ts: iso,                 // server-issued time
  issuer: node,            // sending node
  subj: urn.optional(),    // primary subject (resource)
  corr: uid.optional(),    // correlation id
  caus: uid.optional(),    // causation id
  meta: EnvelopeMetaZ.optional(),
  sig: z.string().optional(),  // detached signature (algo out of scope)
});
export type EnvelopeBase = z.infer<typeof EnvelopeBaseZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 4) Commands (mutations; the five forever verbs; idempotent)                */
/* ────────────────────────────────────────────────────────────────────────── */
export const Cmd_SupplyDeltaZ = z.object({
  kind: z.literal("cmd"),
  type: z.literal("supply.delta"),
  idem,
  resource: urn,
  interval: IntervalZ,
  delta: z.number().int(),     // +/- capacity
  note: z.string().optional(),
});
export type Cmd_SupplyDelta = z.infer<typeof Cmd_SupplyDeltaZ>;

export const Cmd_HoldPlaceZ = z.object({
  kind: z.literal("cmd"),
  type: z.literal("hold.place"),
  idem,
  resources: z.array(urn).nonempty(),
  interval: IntervalZ,
  demands: z.array(DemandZ).nonempty(),
  ttlSec: z.number().int().positive(),
  note: z.string().optional(),
});
export type Cmd_HoldPlace = z.infer<typeof Cmd_HoldPlaceZ>;

export const Cmd_HoldConfirmZ = z.object({
  kind: z.literal("cmd"),
  type: z.literal("hold.confirm"),
  idem,
  holdId: uid,
  note: z.string().optional(),
});
export type Cmd_HoldConfirm = z.infer<typeof Cmd_HoldConfirmZ>;

export const Cmd_HoldReleaseZ = z.object({
  kind: z.literal("cmd"),
  type: z.literal("hold.release"),
  idem,
  holdId: uid,
  reason: z.string().optional(),
});
export type Cmd_HoldRelease = z.infer<typeof Cmd_HoldReleaseZ>;

export const Cmd_AllocCancelZ = z.object({
  kind: z.literal("cmd"),
  type: z.literal("alloc.cancel"),
  idem,
  allocationId: uid,
  reason: z.string().optional(),
});
export type Cmd_AllocCancel = z.infer<typeof Cmd_AllocCancelZ>;

export const CommandZ = z.discriminatedUnion("type", [
  Cmd_SupplyDeltaZ, Cmd_HoldPlaceZ, Cmd_HoldConfirmZ, Cmd_HoldReleaseZ, Cmd_AllocCancelZ,
]).and(z.object({ kind: z.literal("cmd") }));
export type Command = z.infer<typeof CommandZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 5) Events (immutable deltas)                                               */
/* ────────────────────────────────────────────────────────────────────────── */
const EvtBaseZ = z.object({
  kind: z.literal("evt"),
  sourceIdem: idem.optional(),  // echo idempotency
  seq: seqZ.optional(),         // per-resource ordering when subj==resource
});

export const Evt_SupplyDeltaAppliedZ = EvtBaseZ.extend({
  type: z.literal("supply.delta.applied"),
  resource: urn,
  interval: IntervalZ,
  delta: z.number().int(),
});
export type Evt_SupplyDeltaApplied = z.infer<typeof Evt_SupplyDeltaAppliedZ>;

export const Evt_HoldPlacedZ = EvtBaseZ.extend({
  type: z.literal("hold.placed"),
  holdId: uid,
  resources: z.array(urn).nonempty(),
  interval: IntervalZ,
  demands: z.array(DemandZ).nonempty(),
  expiresAt: iso,
});
export type Evt_HoldPlaced = z.infer<typeof Evt_HoldPlacedZ>;

export const Evt_HoldReleasedZ = EvtBaseZ.extend({
  type: z.literal("hold.released"),
  holdId: uid,
  reason: z.string().optional(),
});
export type Evt_HoldReleased = z.infer<typeof Evt_HoldReleasedZ>;

export const Evt_AllocCommittedZ = EvtBaseZ.extend({
  type: z.literal("alloc.committed"),
  holdId: uid,
  allocationId: uid,
});
export type Evt_AllocCommitted = z.infer<typeof Evt_AllocCommittedZ>;

export const Evt_AllocCanceledZ = EvtBaseZ.extend({
  type: z.literal("alloc.canceled"),
  allocationId: uid,
  reason: z.string().optional(),
});
export type Evt_AllocCanceled = z.infer<typeof Evt_AllocCanceledZ>;

/* Optional stream bootstrap (snapshot-in-stream) */
export const Evt_StateBootstrapZ = z.object({
  kind: z.literal("evt"),
  type: z.literal("state.bootstrap"),
  resource: urn,
  window: IntervalZ,
  asOfSeq: seqZ,
  asOfTs: iso,
  baseline: z.object({
    supply0: z.number().int(),
    allocation0: z.number().int(),
  }),
  supply: z.array(DeltaZ),
  allocation: z.array(DeltaZ),
});
export type Evt_StateBootstrap = z.infer<typeof Evt_StateBootstrapZ>;

/* Optional heartbeat for streams */
export const Evt_HeartbeatZ = z.object({
  kind: z.literal("evt"),
  type: z.literal("stream.heartbeat"),
  at: iso,
});
export type Evt_Heartbeat = z.infer<typeof Evt_HeartbeatZ>;

export const EventZ = z.discriminatedUnion("type", [
  Evt_SupplyDeltaAppliedZ,
  Evt_HoldPlacedZ,
  Evt_HoldReleasedZ,
  Evt_AllocCommittedZ,
  Evt_AllocCanceledZ,
  /* optional stream helpers */
  Evt_StateBootstrapZ,
  Evt_HeartbeatZ,
]).and(z.object({ kind: z.literal("evt") }));
export type Event = z.infer<typeof EventZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 6) Queries & Replies (pull APIs, including snapshot+cut)                   */
/* ────────────────────────────────────────────────────────────────────────── */
export const Qry_FeasibleCheckZ = z.object({
  kind: z.literal("qry"),
  type: z.literal("feasible.check"),
  resources: z.array(urn).nonempty(),
  interval: IntervalZ,
  demands: z.array(DemandZ).nonempty(),
});
export type Qry_FeasibleCheck = z.infer<typeof Qry_FeasibleCheckZ>;

export const Rpy_FeasibleResultZ = z.object({
  kind: z.literal("rpy"),
  type: z.literal("feasible.result"),
  ok: z.boolean(),
  reason: z.enum(["insufficient_capacity"]).optional(),
  at: iso.optional(),
});
export type Rpy_FeasibleResult = z.infer<typeof Rpy_FeasibleResultZ>;

export const Qry_FreeBusyGetZ = z.object({
  kind: z.literal("qry"),
  type: z.literal("freebusy.get"),
  resource: urn,
  window: IntervalZ,
});
export type Qry_FreeBusyGet = z.infer<typeof Qry_FreeBusyGetZ>;

export const Rpy_FreeBusyDataZ = z.object({
  kind: z.literal("rpy"),
  type: z.literal("freebusy.data"),
  resource: urn,
  window: IntervalZ,
  busy: z.array(IntervalZ),
});
export type Rpy_FreeBusyData = z.infer<typeof Rpy_FreeBusyDataZ>;

/* Snapshot + tail primitives */
export const Qry_CutCreateZ = z.object({
  kind: z.literal("qry"),
  type: z.literal("cut.create"),
  resources: z.array(urn).nonempty(),
});
export type Qry_CutCreate = z.infer<typeof Qry_CutCreateZ>;

export const Rpy_CutCreatedZ = z.object({
  kind: z.literal("rpy"),
  type: z.literal("cut.created"),
  cutId: uid,
  seqs: z.array(z.object({ resource: urn, seqHi: seqZ })), // inclusive watermark
  issuedAt: iso,
});
export type Rpy_CutCreated = z.infer<typeof Rpy_CutCreatedZ>;

export const Qry_StateSnapshotZ = z.object({
  kind: z.literal("qry"),
  type: z.literal("state.snapshot"),
  cutId: uid,
  resource: urn,
  window: IntervalZ,
  pageAfter: iso.optional(),
  pageSize: z.number().int().positive().max(10_000).optional(),
});
export type Qry_StateSnapshot = z.infer<typeof Qry_StateSnapshotZ>;

export const Rpy_StateSnapshotZ = z.object({
  kind: z.literal("rpy"),
  type: z.literal("state.snapshot"),
  cutId: uid,
  resource: urn,
  window: IntervalZ,
  supply: z.array(DeltaZ),
  allocation: z.array(DeltaZ),   // holds + committed allocs as-of cut
  seqHi: seqZ,
  nextPageAfter: iso.optional(),
});
export type Rpy_StateSnapshot = z.infer<typeof Rpy_StateSnapshotZ>;

export const QueryZ = z.discriminatedUnion("type", [
  Qry_FeasibleCheckZ,
  Qry_FreeBusyGetZ,
  Qry_CutCreateZ,
  Qry_StateSnapshotZ,
]).and(z.object({ kind: z.literal("qry") }));
export type Query = z.infer<typeof QueryZ>;

export const ReplyZ = z.discriminatedUnion("type", [
  Rpy_FeasibleResultZ,
  Rpy_FreeBusyDataZ,
  Rpy_CutCreatedZ,
  Rpy_StateSnapshotZ,
]).and(z.object({ kind: z.literal("rpy") }));
export type Reply = z.infer<typeof ReplyZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 7) Streams (push APIs)                                                     */
/* ────────────────────────────────────────────────────────────────────────── */
/**
 * Streams are transport-agnostic (SSE/WebSocket/broker).
 * Define a logical subscription request/ack so clients can negotiate once,
 * then receive `evt.*` frames (including optional `state.bootstrap`).
 */

/* Resume tokens for “after” subscriptions */
export const ResumeAfterZ = z.array(z.object({
  resource: urn,
  seqHi: seqZ,   // last seen inclusive watermark per resource
}));
export type ResumeAfter = z.infer<typeof ResumeAfterZ>;

/* Stream open (logical) — use in WebSocket init or a preflight HTTP POST.
   For pure SSE, these fields map to query params (server emits events immediately). */
export const Qry_StreamOpenZ = z.object({
  kind: z.literal("qry"),
  type: z.literal("stream.open"),
  resources: z.array(urn).nonempty(),
  window: IntervalZ.optional(),          // horizon for optional bootstrap
  includeBootstrap: z.boolean().default(true),
  after: ResumeAfterZ.optional(),        // if provided, resume strictly after these seqs; suppress bootstrap
  heartbeatSec: z.number().int().positive().max(300).optional(), // server hint
});
export type Qry_StreamOpen = z.infer<typeof Qry_StreamOpenZ>;

export const Rpy_StreamOpenedZ = z.object({
  kind: z.literal("rpy"),
  type: z.literal("stream.opened"),
  streamId: uid,
  // If server decided to set a fresh cut for bootstrap:
  cutId: uid.optional(),
  seqs: z.array(z.object({ resource: urn, seqHi: seqZ })).optional(),
  // Effective heartbeat negotiated
  heartbeatSec: z.number().int().positive().max(300).optional(),
});
export type Rpy_StreamOpened = z.infer<typeof Rpy_StreamOpenedZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 8) Errors                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */
export const ErrZ = z.object({
  kind: z.literal("err"),
  code: z.enum([
    "bad_request",
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "capacity_violation",
    "expired_hold",
    "idempotency_replay",
    "rate_limited",
    "internal",
  ]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type Err = z.infer<typeof ErrZ>;

/* ────────────────────────────────────────────────────────────────────────── */
/* 9) Message unions & type guards                                            */
/* ────────────────────────────────────────────────────────────────────────── */
export const PayloadZ = z.union([
  /* commands */ CommandZ,
  /* events   */ EventZ,
  /* queries  */ QueryZ,
  /* replies  */ ReplyZ,
  /* errors   */ ErrZ,
  /* stream   */ Qry_StreamOpenZ, Rpy_StreamOpenedZ, // stream ctl is just qry/rpy too
]);

export type Payload = z.infer<typeof PayloadZ>;
export const MessageZ = EnvelopeBaseZ.and(PayloadZ);
export type Message = z.infer<typeof MessageZ>;

export const isCommand = (m: Message): m is EnvelopeBase & z.infer<typeof CommandZ> => m.kind === "cmd";
export const isEvent   = (m: Message): m is EnvelopeBase & z.infer<typeof EventZ>   => m.kind === "evt";
export const isQuery   = (m: Message): m is EnvelopeBase & z.infer<typeof QueryZ>   => m.kind === "qry";
export const isReply   = (m: Message): m is EnvelopeBase & z.infer<typeof ReplyZ>   => m.kind === "rpy";
export const isError   = (m: Message): m is EnvelopeBase & Err                      => m.kind === "err";

/* ────────────────────────────────────────────────────────────────────────── */
/* 10) Protocol notes                                                         */
/* ────────────────────────────────────────────────────────────────────────── */
/**
 * – Zero-sum invariant (engine): Availability(t) = Supply(t) − Allocation(t) ≥ 0.
 * – Five commands are the only mutations; all carry `idem`.
 * – Every accepted command emits exactly one authoritative event.
 * – Streams deliver `evt.*` ordered per resource via `seq`. Use `state.bootstrap`
 *   to initialize in-stream, or use `cut.create` + `state.snapshot` then resume
 *   with `after` to tail strictly-after watermarks.
 * – HTTP snapshot (pull) and stream (push) coexist with identical payloads.
 * – Transport is not prescribed. Keep payloads identical across HTTP/SSE/WS/broker.
 * – Evolution: never change discriminants; add optional fields or new types.
 */
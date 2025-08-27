import { z } from "zod";

/** Discovery document path: cacheable, stable entry point. */
export const WELL_KNOWN_TAP_PATH = "/.well-known/tap" as const;

/** Capability: narrowly-scoped feature flag; keep list small. */
export enum TapCapability {
  Offers = "offers",
  Holds = "holds",
  Orders = "orders"
}

/** Well-known TAP document shape (runtime-validated). */
export const ZWellKnownTap = z.object({
  version: z.literal("0.1.0"),
  capabilities: z.array(z.nativeEnum(TapCapability)).nonempty(),
  issuer: z.string().url() // base URL for this TAP issuer
}).strict();
export type WellKnownTap = z.infer<typeof ZWellKnownTap>;

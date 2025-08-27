/**
 * Common HTTP headers we rely on; naming stays standard for familiarity.
 * Junior: Idempotency-Key makes POST safe to retry; ETag supports caching and optimistic concurrency.
 */
export enum StdHeader {
  Accept = "Accept",
  ContentType = "Content-Type",
  ETag = "ETag",
  IfMatch = "If-Match",
  IfNoneMatch = "If-None-Match",
  Link = "Link",
  Prefer = "Prefer",
  PreferenceApplied = "Preference-Applied",
  IdempotencyKey = "Idempotency-Key",
  ContentDigest = "Content-Digest",        // payload integrity
  Signature = "Signature",                 // HTTP Message Signatures (federation)
  SignatureInput = "Signature-Input"
}

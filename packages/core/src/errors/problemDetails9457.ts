/**
 * RFC 9457 "Problem Details": standard error object on HTTP APIs.
 * Junior: a consistent error shape helps clients handle failures predictably.
 */
export type HttpStatusCode = number & { readonly __httpStatusCode: unique symbol };
export const asHttpStatusCode = (n: number): HttpStatusCode => {
  if (!Number.isInteger(n) || n < 100 || n > 599) throw new Error(`Invalid HTTP status: ${n}`);
  return n as HttpStatusCode;
};

/** Small, stable TAP error registry for client branching. */
export enum TapErrorCode {
  AuthUnauthenticated = "TAP_AUTH_UNAUTHENTICATED",
  AuthUnauthorized = "TAP_AUTH_UNAUTHORIZED",
  AuthTempUnavailable = "TAP_AUTH_TEMP_UNAVAILABLE",

  ResourceNotFound = "TAP_RESOURCE_NOT_FOUND",
  ResourceLocked = "TAP_RESOURCE_LOCKED",
  ResourceConflict = "TAP_RESOURCE_CONFLICT",

  ConflictTimeOverlap = "TAP_CONFLICT_TIME_OVERLAP",
  AvailabilityCapacityExceeded = "TAP_AVAILABILITY_CAPACITY_EXCEEDED",

  TemporalInvalidWindow = "TAP_TEMPORAL_INVALID_WINDOW",
  TemporalPastWindow = "TAP_TEMPORAL_PAST_WINDOW",

  FederationUnreachablePeer = "TAP_FEDERATION_UNREACHABLE_PEER",

  RateLimitExceeded = "TAP_RATELIMIT_EXCEEDED",
  Unknown = "TAP_UNKNOWN"
}

const DEFAULT_TITLE: Record<TapErrorCode, string> = {
  [TapErrorCode.AuthUnauthenticated]: "Unauthenticated",
  [TapErrorCode.AuthUnauthorized]: "Unauthorized",
  [TapErrorCode.AuthTempUnavailable]: "Authentication temporarily unavailable",
  [TapErrorCode.ResourceNotFound]: "Resource not found",
  [TapErrorCode.ResourceLocked]: "Resource locked",
  [TapErrorCode.ResourceConflict]: "Resource conflict",
  [TapErrorCode.ConflictTimeOverlap]: "Time overlap",
  [TapErrorCode.AvailabilityCapacityExceeded]: "Capacity exceeded",
  [TapErrorCode.TemporalInvalidWindow]: "Invalid time window",
  [TapErrorCode.TemporalPastWindow]: "Past time window",
  [TapErrorCode.FederationUnreachablePeer]: "Unreachable federation peer",
  [TapErrorCode.RateLimitExceeded]: "Rate limit exceeded",
  [TapErrorCode.Unknown]: "Unknown error"
};

const DEFAULT_HTTP: Partial<Record<TapErrorCode, number>> = {
  [TapErrorCode.AuthUnauthenticated]: 401,
  [TapErrorCode.AuthUnauthorized]: 403,
  [TapErrorCode.AuthTempUnavailable]: 503,
  [TapErrorCode.ResourceNotFound]: 404,
  [TapErrorCode.ResourceLocked]: 423,
  [TapErrorCode.ResourceConflict]: 409,
  [TapErrorCode.ConflictTimeOverlap]: 409,
  [TapErrorCode.AvailabilityCapacityExceeded]: 422,
  [TapErrorCode.TemporalInvalidWindow]: 422,
  [TapErrorCode.TemporalPastWindow]: 422,
  [TapErrorCode.FederationUnreachablePeer]: 502,
  [TapErrorCode.RateLimitExceeded]: 429,
  [TapErrorCode.Unknown]: 500
};

export type TapProblemDetails = {
  type: `urn:tap:error:${string}` | "about:blank";
  title: string;
  status: HttpStatusCode;
  code: TapErrorCode;
  detail?: string;
  instance?: string;
  upstream_http_status?: HttpStatusCode;
  extensions?: Record<string, unknown>;
};

export const makeTapProblem = (
  code: TapErrorCode,
  input?: Partial<Pick<TapProblemDetails, "detail" | "instance" | "upstream_http_status" | "extensions">>
): TapProblemDetails => {
  const status = asHttpStatusCode(DEFAULT_HTTP[code] ?? 500);
  return {
    type: `urn:tap:error:${code.toLowerCase()}`,
    title: DEFAULT_TITLE[code],
    status,
    code,
    detail: input?.detail,
    instance: input?.instance,
    upstream_http_status: input?.upstream_http_status,
    extensions: input?.extensions
  } as TapProblemDetails;
};

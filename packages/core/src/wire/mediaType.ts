/**
 * Media type versioning: use HTTP-native content negotiation.
 * Accept:       application/tap+json;v=0.1
 * Content-Type: application/tap+json;v=0.1
 */
export const TAP_MEDIA_TYPE = "application/tap+json" as const;
export const TAP_VERSION = "0.1.0" as const;

/** Helper to format a Content-Type with version. */
export const contentTypeWithVersion = `${TAP_MEDIA_TYPE};v=${TAP_VERSION}` as const;

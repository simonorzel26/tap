/**
 * IsoInstant: exact UTC timestamp e.g. "2025-08-27T12:34:56Z".
 * We keep a validator to guard wire inputs.
 */
export type IsoInstant = string & { readonly __isoInstant: unique symbol };
export const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
export const isIsoInstant = (s: string) => ISO_INSTANT_RE.test(s);

export const addSeconds = (iso: IsoInstant, seconds: number): IsoInstant =>
  new Date(new Date(iso).getTime() + seconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z") as IsoInstant;

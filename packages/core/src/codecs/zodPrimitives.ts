import { z } from "zod";
import { Brand, brand } from "../base/brandTypes";

/**
 * Zod "brand transforms": parse -> validate -> cast to branded type.
 * This way, *parsed values* are strongly typed (no 'any' casts in the core).
 */

const ID_RE = /^[a-zA-Z0-9._:@-]{1,128}$/;
export const makeBrandedId = <Tag extends string>(tag: Tag) =>
  z.string().regex(ID_RE).transform((s) => brand<string, Tag>(s));

export const ZEmailAddress = z.string().email();

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
export const makeBrandedIsoInstant = <Tag extends string>(tag: Tag) =>
  z.string().regex(ISO_RE).transform((s) => brand<string, Tag>(s));

export const ZTimezone = z.string().min(1);
export const ZPositiveInt = z.number().int().positive();
export const ZNonNegativeInt = z.number().int().nonnegative();
export const ZCapacity = ZPositiveInt;

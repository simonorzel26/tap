/**
 * Brand: adds a hidden tag to a primitive type to avoid mixing up IDs.
 * Example: ResourceId and ActorId are both strings but *not* interchangeable.
 */
export type Brand<Primitive, Tag extends string> = Primitive & { readonly __brand: Tag };

/** Brand a value at compile time (no runtime change). */
export const brand = <Primitive, Tag extends string>(value: Primitive) =>
  value as Brand<Primitive, Tag>;

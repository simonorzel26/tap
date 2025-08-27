/**
 * Result: explicit success/failure instead of throwing exceptions.
 * ok=true carries a value; ok=false carries an error object.
 */
export type Success<T> = { ok: true; value: T };
export type Failure<E> = { ok: false; error: E };
export type Result<T, E> = Success<T> | Failure<E>;

export const success = <T>(value: T): Success<T> => ({ ok: true, value });
export const failure = <E>(error: E): Failure<E> => ({ ok: false, error });

import { assertNever } from "./assert-never.js";
import { none, Option, wrapOption, OptionWrapper, some } from "./option.js";

export interface Error<E> {
  readonly tag: "error";
  readonly error: E;
}

export interface Value<A> {
  readonly tag: "value";
  readonly value: A;
}

export type Result<E, A> = Error<E> | Value<A>;

export const error = <E, A = never>(error: E): Result<E, A> => ({
  tag: "error",
  error,
});

export const value = <A, E = never>(value: A): Result<E, A> => ({
  tag: "value",
  value,
});

export function isError<E, A>(e: Result<E, A>): e is Error<E> {
  return e.tag === "error";
}

export function isValue<E, A>(e: Result<E, A>): e is Value<A> {
  return e.tag === "value";
}

export function getOrElse<E, A>(e: Result<E, A>, defaultValue: (err: E) => A): A {
  switch (e.tag) {
    case "value":
      return e.value;
    case "error":
      return defaultValue(e.error);
    default:
      assertNever(e);
  }
}

export function map<E, A, B>(e: Result<E, A>, f: (a: A) => B): Result<E, B> {
  return isValue(e) ? value(f(e.value)) : error(e.error);
}

export function mapError<E, F, A>(e: Result<E, A>, f: (err: E) => F): Result<F, A> {
  return isError(e) ? error(f(e.error)) : value(e.value);
}

export function flatMap<E, A, B>(e: Result<E, A>, f: (a: A) => Result<E, B>): Result<E, B> {
  return isValue(e) ? f(e.value) : error(e.error);
}

export function matchResult<E, A, R>(res: Result<E, A>, onError: (err: E) => R, onValue: (val: A) => R): R {
  switch (res.tag) {
    case "value":
      return onValue(res.value);
    case "error":
      return onError(res.error);
    default:
      return assertNever(res);
  }
}

export function toOption<E, A>(e: Result<E, A>): Option<A> {
  return isValue(e) ? some(e.value) : none;
}

export function tryCatch<E, A>(action: () => A, onError: (erreur: unknown) => E): Result<E, A> {
  try {
    return value(action());
  } catch (err) {
    return error(onError(err));
  }
}

export interface ResultWrapper<E, A> {
  isValue(): boolean;
  isError(): boolean;
  getOrElse(defaultValue: (err: E) => A): A;
  map<B>(f: (a: A) => B): ResultWrapper<E, B>;
  mapError<F>(f: (err: E) => F): ResultWrapper<F, A>;
  flatMap<B>(f: (a: A) => Result<E, B>): ResultWrapper<E, B>;
  matchResult<R>(onError: (err: E) => R, onValue: (val: A) => R): R;
  toOption(): OptionWrapper<A>;
  unwrap(): Result<E, A>;
}

export function wrapResult<E, A>(res: Result<E, A>): ResultWrapper<E, A> {
  return {
    isValue(): boolean {
      return isValue(res);
    },
    isError(): boolean {
      return isError(res);
    },
    getOrElse(defaultValue: (err: E) => A): A {
      return getOrElse(res, defaultValue);
    },
    map<B>(f: (a: A) => B): ResultWrapper<E, B> {
      return wrapResult(map(res, f));
    },
    mapError<F>(f: (err: E) => F): ResultWrapper<F, A> {
      return wrapResult(mapError(res, f));
    },
    flatMap<B>(f: (a: A) => Result<E, B>): ResultWrapper<E, B> {
      return wrapResult(
        flatMap(res, (a) => {
          return f(a);
        }),
      );
    },
    matchResult<R>(onError: (err: E) => R, onValue: (val: A) => R): R {
      return matchResult(res, onError, onValue);
    },
    toOption(): OptionWrapper<A> {
      return wrapOption(toOption(res));
    },
    unwrap(): Result<E, A> {
      return res;
    },
  };
}

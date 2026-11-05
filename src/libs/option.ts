import { assertNever } from "./assert-never.js";
import { error, Result, wrapResult, ResultWrapper, value } from "./result.js";

export interface Some<A> {
  readonly tag: "Some";
  readonly valeur: A;
}

export interface None {
  readonly tag: "None";
}

export type Option<A> = Some<A> | None;

export function some<A>(valeur: A): Option<A> {
  return {
    tag: "Some",
    valeur,
  };
}

export const none: None = Object.freeze({ tag: "None" });

export function fromNullable<A>(val: A | null | undefined): Option<A> {
  return val === null || val === undefined ? none : some(val);
}

export function isSome<A>(opt: Option<A>): opt is Some<A> {
  return opt.tag === "Some";
}

export function isNone<A>(opt: Option<A>): opt is None {
  return opt.tag === "None";
}

export function get<A>(some: Some<A>): A {
  return some.valeur;
}

export function getOrElse<A>(opt: Option<A>, valeurParDefaut: () => A): A {
  switch (opt.tag) {
    case "Some":
      return opt.valeur;
    case "None":
      return valeurParDefaut();
    default:
      assertNever(opt);
  }
}

export function map<A, B>(opt: Option<A>, f: (a: A) => B): Option<B> {
  return isSome(opt) ? some(f(opt.valeur)) : none;
}

export function flatMap<A, B>(opt: Option<A>, f: (a: A) => Option<B>): Option<B> {
  return isSome(opt) ? f(opt.valeur) : none;
}

export function filter<A>(opt: Option<A>, predicat: (a: A) => boolean): Option<A> {
  return isSome(opt) && predicat(opt.valeur) ? opt : none;
}

export function matchOption<A, R>(opt: Option<A>, onNone: () => R, onSome: (valeur: A) => R): R {
  switch (opt.tag) {
    case "Some":
      return onSome(opt.valeur);
    case "None":
      return onNone();
    default:
      return assertNever(opt);
  }
}

export function toResult<E, A>(opt: Option<A>, onNone: () => E): Result<E, A> {
  return isSome(opt) ? value(opt.valeur) : error(onNone());
}

export interface OptionWrapper<A> {
  isSome(): boolean;
  isNone(): boolean;
  getOrElse(valeurParDefaut: () => A): A;
  map<B>(f: (a: A) => B): OptionWrapper<B>;
  flatMap<B>(f: (a: A) => Option<B>): OptionWrapper<B>;
  filter(predicat: (a: A) => boolean): OptionWrapper<A>;
  match<R>(onNone: () => R, onSome: (valeur: A) => R): R;
  unwrap(): Option<A>;
  toResult<E>(onNone: () => E): ResultWrapper<E, A>;
}

export function wrapOption<A>(opt: Option<A>): OptionWrapper<A> {
  return {
    isSome(): boolean {
      return isSome(opt);
    },

    isNone(): boolean {
      return isNone(opt);
    },
    getOrElse(valeurParDefaut: () => A): A {
      return getOrElse(opt, valeurParDefaut);
    },
    map<B>(f: (a: A) => B): OptionWrapper<B> {
      return wrapOption(map(opt, f));
    },
    flatMap<B>(f: (a: A) => Option<B>): OptionWrapper<B> {
      return wrapOption(
        flatMap(opt, (a) => {
          return f(a);
        }),
      );
    },
    filter(predicat: (a: A) => boolean): OptionWrapper<A> {
      return wrapOption(filter(opt, predicat));
    },
    match<R>(onNone: () => R, onSome: (valeur: A) => R): R {
      return matchOption(opt, onNone, onSome);
    },
    unwrap(): Option<A> {
      return opt;
    },
    toResult<E>(onNone: () => E): ResultWrapper<E, A> {
      return wrapResult(toResult(opt, onNone));
    },
  };
}

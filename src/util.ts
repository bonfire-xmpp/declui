/**
 * Checks if two types are equal. This checks by testing whether X and Y are isomorphically assignable.
 */
export type Equals<X, Y, True = true, False = false> = (<T>() => T extends X
  ? 1
  : 2) extends <T>() => T extends Y ? 1 : 2
  ? True
  : False;

/**
 * Converts from String value (i.e. StringConstructor) into string, etc.
 */
export type PropConvertType<T, U = any> = Equals<
  T,
  StringConstructor,
  string,
  Equals<
    T,
    ObjectConstructor,
    // eslint-disable-next-line
    object,
    Equals<
      T,
      NumberConstructor,
      number,
      Equals<
        T,
        ArrayConstructor,
        U[],
        Equals<
          T,
          FunctionConstructor,
          // eslint-disable-next-line
          Function,
          Equals<
            T,
            DateConstructor,
            Date,
            Equals<
              T,
              BooleanConstructor,
              boolean,
              Equals<T, Array<U>, U[], unknown>
            >
          >
        >
      >
    >
  >
>;

export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
/**
 * Exclusive Or on object export types: `A | B` as it should be (which is really just an alias for `A & B`)
 */
export type XOR<T, U> = (Without<T, U> & U) | (Without<U, T> & T);

/**
 * `x` in `(x:xs)` for tuple export types
 */
export type Head<T> = T extends readonly [infer U, ...unknown[]] ? U : never;
/**
 * `xs` in `(x:xs)` for tuple export types
 */
export type Tail<T> = T extends readonly any[]
  ? ((...args: T) => never) extends (a: any, ...args: infer R) => never
    ? R
    : never
  : never;

/**
 * `Foldl XOR {} Tuple`
 * Basically returns `XOR<A, XOR<B, XOR<C, ...{}>>>>>>`
 */
export type ReduceWithXor<T extends readonly any[]> = [T] extends [[]] // eslint-disable-next-line
  ? {}
  : XOR<Head<T>, ReduceWithXor<Tail<T>>>;

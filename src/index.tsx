import { h, Component, SetupContext, FunctionalComponent, VNode } from 'vue';
import { PropConvertType, ReduceWithXor } from './util';

type PropType =
  | StringConstructor
  | ObjectConstructor
  | NumberConstructor
  | ArrayConstructor
  | FunctionConstructor
  | DateConstructor
  | BooleanConstructor;

interface PropWithOptions {
  type: PropType;
  default?: any;
  required?: true | false;
  input?: true | false;
}

/**
 * Gets the prop type from a Prop or PropWithOptions
 */
type InferPropType<T, U = any> = T extends PropWithOptions
  ? PropConvertType<T['type'], U>
  : PropConvertType<T, U>;

/**
 * An object of props, roughly resembling that of Vue components
 */
type Props = { [key: string]: PropType | PropWithOptions };

/**
 * Props object with a specificly named prop
 */
type SpecificProp<N extends string> = Record<N, PropType | PropWithOptions>;

/**
 * Takes out required keys out of a Props object and returns them as a union
 */
type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends { required: true } ? K : never;
}[keyof T];
/**
 * Takes out optional keys out of a Props object and returns them as a union
 */
type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

/**
 * Transforms type @Props@ into an object like {propName: propType}.
 * Respects optionality and keeps definition relation with original object.
 */
type PropsParameter<P> =
  // This is needed to keep the relation between prop and definition in $props; borrowed from vue
  { [K in keyof P]?: unknown } &
    { [K in RequiredKeys<P>]: InferPropType<P[K]> } &
    { [K in OptionalKeys<P>]?: InferPropType<P[K]> };

// eslint-disable-next-line
type Context = Omit<SetupContext<{}>, 'expose'>;

/**
 * The type of a single rule, transforming $props using $becomes
 */
export interface ComponentRule<
  N extends string,
  // eslint-disable-next-line
  P extends (Props & SpecificProp<N>) | {} = {}
> {
  $name: N;
  $props?: P;
  $emits?: string[];
  $becomes: (props: PropsParameter<P>, context: Context) => VNode;
}

/**
 * Identity function, used for type checking/annotations for rules.
 */
export function defineRule<
  N extends string,
  // eslint-disable-next-line
  P extends (Props & SpecificProp<N>) | {} = {}
>(rule: ComponentRule<N, P>): ComponentRule<N, P> {
  return rule;
}

/**
 * Takes a tuple of `...ComponentRule<Ts>`s, and returns a tuple of `...PropsParameter<Ts>`s
 */
type RulesToParameters<Tuple extends readonly ComponentRule<any, any>[]> = {
  [K in keyof Tuple]: Tuple[K] extends ComponentRule<infer N, any>
    ? Tuple[K] extends ComponentRule<any, infer T>
      ? PropsParameter<T> & Record<N, InferPropType<Tuple[K]['$props'][N]>>
      : Record<N, InferPropType<Tuple[K]['$props'][N]>>
    : never;
};

/**
 * Accepted input type for a tuple of rules `Rules`
 */
export type RuleInput<Rules extends readonly ComponentRule<any, any>[]> = Array<
  ReduceWithXor<RulesToParameters<Rules>>
>;

function checkIfRuleMatchesProps<P extends Props>(
  rule: ComponentRule<any, P>,
  props: Record<string, any>
): boolean {
  const ruleProps = Object.entries(rule.$props || {});
  return (
    props[rule.$name] !== undefined ||
    Object.entries(props)
      .map(
        ([propName]) =>
          ruleProps.findIndex(([name]) => propName === name) !== -1
      )
      .every((x) => x)
  );
}

export function transformRulesToComponent(
  rules: readonly ComponentRule<any, any>[],
  containingElement: Component | string | 'none' = 'div'
): FunctionalComponent {
  const emits = rules.reduce(
    (acc: string[], x) => (acc = acc.concat(x.$emits || [])) && acc,
    []
  );

  const inputProps = Object.fromEntries(
    rules
      .map((x) => Object.entries(x.$props ?? {}))
      .map((ps) => ps.filter(([, v]) => (v as any)?.input))
      .flat()
  );
  const props = {
    data: {
      type: Array,
      optional: true,
      default: {},
    },
    ...inputProps,
  };

  const render = (props: any, context: Context) => {
    const funs: Array<(...args: any[]) => VNode> = props.data.map(
      (ps: Props) => () => {
        const matchedRule = rules.find((r) => checkIfRuleMatchesProps(r, ps));
        const defaultProps = Object.fromEntries(
          Object.entries(matchedRule?.$props || {})
            .filter(([, v]) => (v as PropWithOptions)?.default !== undefined)
            .map(([k, v]) => [k, (v as PropWithOptions).default])
        );
        return (
          matchedRule?.$becomes ||
          (() => console.warn('Could not match input', ps, 'with any rule'))
        )(
          {
            ...defaultProps,
            ...props,
            ...ps,
          },
          context
        );
      }
    );
    return containingElement === 'none'
      ? funs.map((f) => f())
      : typeof containingElement === 'string'
      ? // If it's a plain HTML element, don't pass any attrs
        h(containingElement, null, {
          default: () => funs.map((f) => f()),
        })
      : h(
          containingElement as any,
          { ...props, ...context.attrs },
          {
            default: () => funs.map((f) => f()),
          }
        );
  };
  render.emits = emits;
  render.props = props;

  return render;
}

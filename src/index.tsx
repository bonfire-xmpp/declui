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
    { [K in OptionalKeys<P>]?: InferPropType<P[K]> } & { _id?: number };

// eslint-disable-next-line
type VueContext = Omit<SetupContext<{}>, 'expose'>;

type Context = VueContext & {
  $attrs?: any;
  $props?: any;
  $emit?: (...args: any) => void;
} & {
  globals: Record<string, any>;
};

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
  $becomes: (props: PropsParameter<P>, context: Context, id: number) => VNode;
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
  const ruleProps = Object.entries({
    [rule.$name]: undefined,
    ...(rule.$props || {}),
  });
  return (
    props[rule.$name] !== undefined &&
    Object.entries(props)
      .map(
        ([propName]) =>
          ruleProps.findIndex(([name]) => propName === name) !== -1
      )
      .every((x) => x)
  );
}

type TransformSettings = {
  /**
   * Selects whether the output component should be functional (if true), or
   * stateful (the default).
   */
  functionalOutput?: boolean;

  /**
   * Specifies what component, HTML tag (if any) should enclose the rendered list.
   */
  containingElement?: Component | string | 'none';

  /**
   * The function that will be set as the component's `setup()`, if the output
   * isn't functional.
   */
  setup?: (props: any, context: VueContext) => any;
};

export function transformRulesToComponent<Settings extends TransformSettings>(
  rules: readonly ComponentRule<any, any>[],
  settings: Settings
): Settings['functionalOutput'] extends true ? FunctionalComponent : Component {
  const containingElement = settings.containingElement ?? 'div';

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

  // const globals: any = {};
  // const inject = (key: string, value: any) => (globals[key] = value);

  if (settings.functionalOutput) {
    const render: any = function (
      this: Record<string, any>,
      props: any,
      context: VueContext
    ) {
      // eslint-disable-next-line
      const { data, ...propsSansData } = props;

      const funs: Array<(...args: any[]) => VNode> = props.data.map(
        (ps: Props, i: number) => () => {
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
              ...propsSansData,
              ...ps,
            },
            { ...context, globals: this.globals },
            i
          );
        }
      );

      // No containing element, return the rendered array
      if (containingElement === 'none') {
        return funs.map((f) => f());
      }

      // If it's a plain HTML element, don't pass any attrs
      else if (typeof containingElement === 'string') {
        return h(containingElement, null, {
          default: () => funs.map((f) => f()),
        });
      }

      // It's a Vue component, pass the props and inherit attrs
      else {
        return h(
          containingElement as any,
          { ...propsSansData, ...context.attrs },
          {
            default: () => funs.map((f) => f()),
          }
        );
      }
    }.bind({
      globals: {} as Record<string, any>,
    });

    render.emits = emits;
    render.props = props;

    return render;
  }

  // Output a stateful (regular) component
  else {
    return {
      props,
      emits,
      setup: settings.setup,
      provide() {
        return {
          globals: {},
        };
      },
      render() {
        // eslint-disable-next-line
        const { data, ...propsSansData } = this.$props;

        const funs: Array<(...args: any[]) => VNode> = this.$props.data.map(
          (ps: Props, i: number) => () => {
            const matchedRule = rules.find((r) =>
              checkIfRuleMatchesProps(r, ps)
            );
            const defaultProps = Object.fromEntries(
              Object.entries(matchedRule?.$props || {})
                .filter(
                  ([, v]) => (v as PropWithOptions)?.default !== undefined
                )
                .map(([k, v]) => [k, (v as PropWithOptions).default])
            );
            return (
              matchedRule?.$becomes ||
              (() => console.warn('Could not match input', ps, 'with any rule'))
            )(
              {
                ...defaultProps,
                ...propsSansData,
                ...ps,
              },
              this,
              i
            );
          }
        );

        // No containing element, return the rendered array
        if (containingElement === 'none') {
          return funs.map((f) => f());
        }

        // If it's a plain HTML element, don't pass any attrs
        else if (typeof containingElement === 'string') {
          return h(containingElement, null, {
            default: () => funs.map((f) => f()),
          });
        }

        // It's a Vue component, pass the props and inherit attrs
        else {
          return h(
            containingElement as any,
            { ...propsSansData, ...this.$attrs },
            {
              default: () => funs.map((f) => f()),
            }
          );
        }
      },
    } as any;
  }
}

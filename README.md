# declui

Declarative UI shorthand for Vue 3.

Takes a set of rules and outputs a single Vue component handling them all.

## Motivation

In single page apps, there is often a need for tooltips, modals, popups,
dropdowns, dialogs, etc. Usually, the style of a -- say -- popup stays the same,
but the content changes.

Clicking on a user icon might display a list of actions for that users, and
clicking an email in a list might also display a list of actions. Visually, they
both belong to your design's look for lists. Logically, however, the data this
list displays is local to where it is triggered from.

Things only get more complex when going cross-platform, when right clicks
translate into long presses and context menus into action sheets.

To solve this issue, declui provides a way to 'describe' how one of many items
may look. Together with a complete list of 'descriptions', it outputs a Vue
component that can take a list of these items and display them.

For example, a right-click dropdown list can have a regular item with text (and
optionally a color), a sublist, or a divider. We might write these rules as:
```tsx
const rules = [
  // Our divider rule
  defineRule({
    $name: "divider",
	$becomes: () => <hr />
  }),

  // Regular text
  defineRule({
    $name: "text",
	$props: {
      text: String,
	  color: {
	    type: String,
		optional: true,
	  }
	},
	$becomes: ({text, color}) =>
		<Item color={color}>{text}</Item>
  }),

  // Regular text with a sublist
  defineRule({
    $name: "sublist",
	$props: {
      text: String,
	  color: {
	    type: String,
		optional: true,
	  },
	  sublist: {
	    type: Array,
		required: true,
	  }
	},
	$becomes: ({text, sublist, color}) =>
		<Sublist color={color} list={sublist}>{text}</Sublist>
  }),
] as const;
```

It's important to note a couple of things. Firstly, we use (and encourage you do
too) JSX to write the `VNode`s that `$becomes` returns. JSX like this, paired
with a [Babel plugin](https://github.com/vuejs/jsx-next) turns into calls to
`h()`, Vue's [render
function](https://v3.vuejs.org/guide/render-function.html#h-arguments).

Secondly, our rule objects are wrapped in `defineRule()`. It simply returns its
argument, however, it has an explicit type set for the parameter. That way
TypeScript can type check many things. For example, all the props' types in
`$becomes` have their types inferred based on `$props`.

Thirdly, we save these rules to a variable `rules`, with `as const` after the
`[]` array. This indicates to TypeScript that the type of `rules` is a tuple,
not an array. Without this, type checking would fail when you try to create a
component from these rules.

Lastly, and perhaps most importantly, all of the JSX elements in the example use
preexisting components. The idea is to have a well-defined and styled interface
that you can just plug into, with the JSX giving you freedom to adjust it, or
construct simple layouts in-place.

To create a component, you pass a ruleset to `transformRulesToComponent()`:
```tsx
const Dropdown = transformRulesToComponent(rules, {containingElement: Container})
```

That second parameter is the settings object, in this case just specifying the
enclosing element in which everything will be placed. It can be another
component, or a string specifying the HTML tag name. In case it is `"empty"`,
the items will be rendered as a
[fragment](https://v3.vuejs.org/guide/migration/fragments.html), i.e. without an
enclosing element.

Then, in your SFC, or wherever:
```vue
<template>
  <Tooltip :data="dropdown" />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Dropdown from '@/components/Dropdown';

export default defineComponent({
  components: { Dropdown },
  data() {
	const suboptions = [5, 15, 30, 60].map(x => ({ text: `Mute for ${x} minutes` }));

    return {
	  dropdown: [
	    { text: "Remove Friend", color: "red" },
		{ text: "Block User" },
		{ divider: true },
		{ sublist: suboptions, text: "Mute" },
	  ]
	}
  }
});
</script>
```

The generated component will take a prop `data` with the array of items that
adhere to its defining rules.

Input data can also be typechecked! If you have a tuple of rules (such as the
`rules` we defined above), the type of the corresponding `data` prop is
`RuleInput<typeof rules>`.

## Usage

### ComponentRule

You may have read, or your editor might have told you that `defineRule()` takes
(and returns) a `ComponentRule<...>`. This is the type of a single rule.

A rule has to have `$name: string` and `$becomes: (props, ctx, id) => VNode`
fields.

The `$becomes(props, ctx, id)` will be used to create a VNode when necessary.
- `props` is whatever the user passes (and that you defined in `$props`).
- `ctx` is `{$attr, $slots, $emit}`, or `{attr, slots, emit, globals}`if
  `functionalOutput` is true.
- `id` is a unique identifier for that particular call to `$becomes()`, and can
  be used by the function to uniquely identify itself. Currently, it is the
  zero-based index of the ordering with which the components were rendered.

The `$name` will become a required prop of type `unknown`. If you want, you can
further specify its type by defining a prop of the same name.

Rules may also have a field `$props`. This resembles the `props` of components
in Vue, and that intuition will get you far. Note, however, that Vue's `props`
and `$props` aren't exactly the same. When in doubt, TypeScript will fail a
typecheck if you're doing something that isn't supported.

The key of each field in `$props` is that prop's name. Its value may be
something like `String` or `Number`, or it may be an object of type `PropWithOptions`:
```ts
interface PropWithOptions {
  type: PropType;
  default?: any;
  required?: true | false;
  input?: true | false;
}
```

The only field here not present in Vue is `input`. If true, you will be able to
pass this prop directly by passing it to the resulting component:
```html
  <Tooltip :data="dropdown" markedAsInput="1234" />
```
The use for this is to allow `v-model` bindings, as they're sugar for a
prop+event binding.

Lastly, rules can have an `$emits` field. This is an array of strings,
representing all the events which that particular rule can emit.

### `defineRule()`

`defineRule` is isomorphic to `x => x`. It is used in TypeScript to infer the
right types both inside the parameter, and when constructing a ruleset (tuple of
`ComponentRule`s).

### `RuleInput<T>`

If `r` is a valid ruleset of the correct type (`readonly` tuple of one or more
`ComponentRule`s), then `RuleInput<typeof r>` is the type of all valid inputs.

This lets you export the type your (also exported) component expects.

I can't find the formal specification of TypeScript's type system, if any.
However, it seems to adopt the type relation of subtyping, which is preserved
under `RuleInput`. That is, for all `A` and `B`, if `A extends B`, then
`RuleInput<A> extends RuleInput <B>`. This lets you *extend* rules, such that
inputs for the old ruleset are also valid for the new one.

### `transformRulesToComponent(rules,settings): FunctionalComponent | Component`

Takes in a ruleset and the output settings.

`rules` is a tuple of `ComponentRule`s. TypeScript might be picky about its
type. If you think you passed the right type, but it still won't typecheck,
report an issue. In the meantime you can cast to `any`.

`settings` is the settings object:
```ts
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
```

`settings.containingElement` is the element that will enclose the rendered
items. It defaults to `div`. You can pass a Vue component, in which case it will
be rendered in the default slot. You can also pass a string, which is the HTML
tag name. If you pass `"empty"`, the items will be rendered inside as a
[fragment](https://v3.vuejs.org/guide/migration/fragments.html).

The resulting component will take in a prop `data` of type `RuleInput<typeof
rules>`.

Any events emitted by the rules can be listened to on the resulting component.

Any props marked with `input: true` can be passed by passing them to the resulting component.

Together, these allow for using `v-model:name` on the resulting component.

Input is matched to rules with the following algorithm:
 - Take an input `i`
 - Iterate through each rule `r` in `rules` in the order provided by the user
 - Does `i` contain a value for the `$name` in `r`, and do all of the fields in
   `i` exist in the input as defined by `r`? If so, we have found the matching
   rule. If not, continue.

An unmatched input will emit no output and will print a console warning.

### Communicating with siblings

Sometimes it is useful to send messages and/or data across the components
defined in `$rules`. To this end, you can use the `globals` object exposed to
components, one way or another.

If your output is a stateful component, then `globals` is available to all the
involved components using Vue's `inject`, including the enclosing component.

If your output is a functional component, then `globals` is passed as an extra
field in the `ctx` object of `$becomes()`. Do note, that since functional
components have no sense of state, the `globals` object will be the same for
_all_ instances of your component.

In this way, you are free to use `ref()`s, event emitters, etc.

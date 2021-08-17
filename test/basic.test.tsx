/**
 * @jest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { RuleInput, defineRule, transformRulesToComponent } from '../src';

const rule1 = {
  $name: 'divider',
  $becomes: () => <hr />,
};

const rule2 = {
  $name: 'title',
  $props: {
    icon: String,
    role: String,
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: 'test 1234 this is the default prop value',
    },
    thing: {
      type: Number,
      input: true,
      default: 0,
    },
  },
  $emits: ['update:thing'],
  $becomes: (props: any, ctx: any) => {
    return (
      <div data-icon={props.icon} data-role={props.role}>
        <h3 onClick={() => ctx.emit('update:thing', (props.thing ?? 0) + 1)}>
          {props.thing}. {props.title}
        </h3>
        {props.body ?? <p>{props.body}</p>}
      </div>
    );
  },
};

test('defineRules() typechecks, and is isomorphic to identity', () => {
  expect([defineRule(rule1), defineRule(rule2)] as const).toEqual([
    rule1,
    rule2,
  ]);
});

describe('all component features work', () => {
  const rules = [defineRule(rule1), defineRule(rule2)] as const;
  const Tooltip = transformRulesToComponent(rules, 'main');
  const data: RuleInput<typeof rules> = [
    { divider: true },
    { title: 'Add Friend', icon: 'account', role: 'additive' },
    {
      title: 'Block Fren :(',
      icon: 'account',
      role: 'destructive',
      body: 'why do that to a fren? ? ;_;',
    },
  ];

  it('can transform rules into a component', () => {
    expect(Tooltip.props).toHaveProperty('thing', {
      type: Number,
      input: true,
      default: 0,
    });
  });

  it('accepts valid input for rules', () => {
    const wrapper = mount(Tooltip, { props: { data } });

    // The heading is rendered
    expect(wrapper.text()).toContain('Add Friend');

    // The divider is rendered
    expect(wrapper.find('hr').exists()).toBe(true);
  });

  it('default prop values work', () => {
    const wrapper = mount(Tooltip, { props: { data: [{ title: 'title' }] } });
    expect(wrapper.text()).toContain(
      'test 1234 this is the default prop value'
    );
  });

  it('v-model works', () => {
    const wrapper = mount(Tooltip, { props: { data, thing: 1 } });

    // Check if v-model, global input prop binding works
    wrapper.find('h3').trigger('click');
    expect(wrapper.emitted()).toHaveProperty('update:thing', [[2]]);
  });

  it('renders fragments', () => {
    const data: RuleInput<typeof rules> = [
      { divider: true },
      { title: 'Add Friend', icon: 'account', role: 'additive' },
    ];
    const Tooltip = transformRulesToComponent(rules, 'none');
    const wrapper = mount(Tooltip, { props: { data } });

    // <hr /> + 2 elements in rule1 = 3 total elements (no wrapper)
    expect(wrapper.findAll('*').length).toBe(3);
  });

  describe('check console warnings', () => {
    const data = [{ nonexistent: true }];

    // Set up a console.warn MITM
    const consoleOutput = [];
    const fakeWarn = (output: string) => consoleOutput.push(output);
    beforeEach(() => (console.warn = fakeWarn));

    it("warns when input doesn't match any rules", () => {
      mount(Tooltip, { props: { data } });
      expect(consoleOutput.length).not.toBe(0);
    });
  });
});

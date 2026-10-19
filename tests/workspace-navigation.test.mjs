import assert from 'node:assert/strict';
import test from 'node:test';
import { focusWorkspaceTarget, scheduleWorkspaceTarget } from '../app/workspace-navigation.js';

test('a workspace section jump waits for layout, opens its group, scrolls and focuses the target', () => {
  const frames = [];
  const calls = [];
  const group = { tagName: 'DETAILS', open: false, parentElement: null };
  const target = {
    tagName: 'DIV',
    parentElement: group,
    hasAttribute: () => false,
    setAttribute: (name, value) => calls.push(['attribute', name, value]),
    scrollIntoView: options => calls.push(['scroll', options]),
    focus: options => calls.push(['focus', options]),
  };
  const documentRoot = { getElementById: id => id === 'answer-target' ? target : null };
  assert.equal(scheduleWorkspaceTarget('answer-target', { documentRoot, scheduleFrame: callback => frames.push(callback) }), true);
  assert.deepEqual(calls, []);
  frames.shift()();
  assert.deepEqual(calls, []);
  frames.shift()();
  assert.equal(group.open, true);
  assert.deepEqual(calls, [
    ['attribute', 'tabindex', '-1'],
    ['scroll', { block: 'start', behavior: 'instant' }],
    ['focus', { preventScroll: true }],
  ]);
});

test('missing workspace targets fail safely', () => {
  assert.equal(focusWorkspaceTarget('missing', { getElementById: () => null }), false);
  assert.equal(scheduleWorkspaceTarget('', { scheduleFrame: () => assert.fail('should not schedule') }), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { lockFormForSave } from '../app/form-save-lock.js';

test('pending save freezes editable fields, stage navigation and close controls without changing values', () => {
  const controls = [
    { kind: 'answer', value: 'Submitted text', disabled: false },
    { kind: 'selection', value: 'growth', disabled: false },
    { kind: 'next-stage', disabled: false },
    { kind: 'close', disabled: false },
    { kind: 'conditional-field', value: 'Preserved hidden value', disabled: true },
  ];
  const attributes = new Map(), form = {
    querySelectorAll: () => controls,
    getAttribute: key => attributes.has(key) ? attributes.get(key) : null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
  };
  const unlock = lockFormForSave(form);
  assert.equal(attributes.get('aria-busy'), 'true');
  assert.ok(controls.every(control => control.disabled));
  assert.equal(controls[0].value, 'Submitted text');
  unlock();
  assert.equal(attributes.has('aria-busy'), false);
  assert.deepEqual(controls.map(control => control.disabled), [false, false, false, false, true]);
  assert.equal(controls[4].value, 'Preserved hidden value');
});

test('releasing a failed save restores a pre-existing busy attribute', () => {
  const attributes = new Map([['aria-busy', 'false']]), form = {
    querySelectorAll: () => [], getAttribute: key => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
  };
  const unlock = lockFormForSave(form);
  assert.equal(attributes.get('aria-busy'), 'true');
  unlock();
  assert.equal(attributes.get('aria-busy'), 'false');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSimpleHome, renderWorkspaceNavigation, renderTextSizeControl, readTextSizePreference, writeTextSizePreference, applyTextSizePreference, TOOL_GROUPS } from '../app/workspace-shell.js';

const memoryStorage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test('text size defaults large and preferences stay scoped to account, workspace and seat', () => {
  const storage = memoryStorage();
  const scope = { storage, userId: 'person-one', workspaceId: 'workspace-one', seat: 'growth' };
  assert.equal(readTextSizePreference(scope), 'large');
  assert.equal(writeTextSizePreference({ ...scope, value: 'extra-large' }), true);
  assert.equal(readTextSizePreference(scope), 'extra-large');
  assert.equal(readTextSizePreference({ ...scope, userId: 'person-two' }), 'large');
  assert.equal(readTextSizePreference({ ...scope, workspaceId: 'workspace-two' }), 'large');
  assert.equal(readTextSizePreference({ ...scope, seat: 'christian' }), 'large');
  assert.equal(writeTextSizePreference({ ...scope, value: '<script>' }), false);
  assert.equal(readTextSizePreference(scope), 'extra-large');
});

test('unavailable preference storage is handled without losing the session preference', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readTextSizePreference({ storage }), 'large');
  assert.equal(writeTextSizePreference({ storage, value: 'standard' }), false);
  let actual;
  applyTextSizePreference('extra-large', { setAttribute(key, value) { actual = [key, value]; } });
  assert.deepEqual(actual, ['data-text-size', 'extra-large']);
  assert.match(renderTextSizeControl('extra-large'), /value="extra-large" selected/);
});

test('simple home distinguishes partner reading, own answers and explicit decisions', () => {
  const christian = renderSimpleHome({ seat: 'christian', ownProgress: { answered: 3, total: 12 }, otherProgress: { answered: 8, total: 13 } });
  assert.match(christian, /3 of 12 questions answered/);
  assert.match(christian, /Read Debynyhan Banks’s answers/);
  assert.match(christian, /data-home-review="growth"/);
  assert.match(christian, /Reading an answer does not approve a proposal/);
  assert.match(christian, /data-view="decisions"/);
  const growth = renderSimpleHome({ seat: 'growth' });
  assert.match(growth, /Read Christian Okoh’s answers/);
  assert.match(growth, /data-home-review="christian"/);
});

test('all tool destinations remain reachable without mixing up home and dashboard', () => {
  const nav = [...TOOL_GROUPS.flatMap(([, keys]) => keys), 'discovery', 'alignment', 'decisions'].map(key => [key, '', key]);
  const html = renderWorkspaceNavigation({ nav, view: 'finance', seat: 'christian' });
  for (const [key] of nav) assert.ok(html.includes(`data-view="${key === 'overview' ? 'dashboard' : key}"`), key);
  assert.match(html, /data-view="overview"[^>]*>Home/);
  assert.doesNotMatch(html, /class="all-tools"[^>]*open/);
  assert.match(html, /aria-current="page"[^>]*>Costs and cash planning/);
  assert.doesNotMatch(renderWorkspaceNavigation({ nav, view: 'overview', seat: 'christian' }), /class="all-tools"[^>]*open/);
});

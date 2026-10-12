import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(new URL('../package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../src/shared/browser/preferences.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function load(window) {
  const exports = {}; const context = { exports }; if (window !== undefined) context.window = window;
  vm.runInNewContext(compiled, context); return exports;
}
test('preference reads and writes survive unavailable browser storage', () => {
  const denied = { get localStorage() { throw new Error('Synthetic storage restriction'); } };
  const quota = { localStorage: { getItem() { throw new Error('Synthetic denial'); }, setItem() { throw new Error('Synthetic quota'); }, removeItem() { throw new Error('Synthetic denial'); } } };
  for (const window of [undefined, denied, quota]) {
    const preference = load(window);
    assert.equal(preference.readPreference('guide'), null);
    assert.equal(preference.writePreference('guide', 'hidden'), false);
    assert.equal(preference.removePreference('guide'), false);
  }
});
test('normal preference behavior keeps the existing key and hide/show values', () => {
  const store = new Map();
  const preference = load({ localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) } });
  const key = 'regovise.coachmarks.assurance';
  assert.equal(preference.readPreference(key), null);
  assert.equal(preference.writePreference(key, 'hidden'), true);
  assert.equal(preference.readPreference(key), 'hidden');
  assert.equal(preference.removePreference(key), true);
  assert.equal(preference.readPreference(key), null);
});

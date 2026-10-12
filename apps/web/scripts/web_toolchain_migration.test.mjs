import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { twMerge } from 'tailwind-merge';
import { matchRoutes } from 'react-router-dom';
import { loadConfigFromFile } from 'vite';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesheet = path.join(appRoot, 'src/styles.css');
// Controlled utility candidates exercise preserved defaults even when no current
// page happens to use a bare class. The real application stylesheet/config/plugin
// still supply every definition under test; no browser rendering is simulated.
const candidateFixture = '\n@source inline("rounded-sm blur-sm ring shadow-sm animate-in animate-out");';
const result = await postcss([tailwind({ base: appRoot, optimize: false })]).process(fs.readFileSync(stylesheet, 'utf8') + candidateFixture, { from: stylesheet });
const variables = new Map();
result.root.walkDecls((declaration) => {
  if (declaration.prop.startsWith('--') && !declaration.prop.startsWith('--tw-')) variables.set(declaration.prop, declaration.value);
});

function declarations(selector) {
  const found = new Map();
  result.root.walkRules((rule) => {
    if (rule.selector === selector) {
      for (const node of rule.nodes) if (node.type === 'decl') found.set(node.prop, node.value);
    }
  });
  assert.ok(found.size, `Missing compiled rule: ${selector}`);
  return found;
}

function resolveValue(value) {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name) => variables.get(name) ?? `var(${name})`)
    .replace(/calc\(([\d.]+)rem \* ([\d.]+)\)/g, (_, unit, count) => `${Number(unit) * Number(count)}rem`);
}

test('actual Tailwind 4 compiler resolves composed panel utilities with existing colors and dimensions', () => {
  const panel = declarations('.panel');
  assert.equal(resolveValue(panel.get('background-color')), '#fff');
  assert.equal(panel.get('border-color'), '#ded8e4');
  assert.equal(resolveValue(panel.get('border-radius')), '0.5rem');
  assert.equal(resolveValue(panel.get('padding')), '1.5rem');
  const subtle = declarations('.panel-subtle');
  assert.equal(subtle.get('background-color'), '#fbf9fc');
  assert.equal(resolveValue(subtle.get('padding')), '1rem');
  assert.equal(declarations('.metric-card').get('background-color'), '#fbf9fc');
});

test('compiled input and primary button retain product colors, spacing and 44px minimum target', () => {
  const input = declarations('.input');
  assert.equal(input.get('color'), '#241232');
  assert.equal(input.get('border-color'), '#cfc7d8');
  assert.equal(resolveValue(input.get('padding-inline')), '1rem');
  assert.equal(resolveValue(input.get('padding-block')), '0.75rem');
  const button = declarations('.button-primary');
  assert.equal(button.get('background-color'), '#8b35e6');
  assert.equal(resolveValue(button.get('color')), '#fff');
  assert.equal(resolveValue(button.get('min-height')), '2.75rem');
  assert.equal(resolveValue(button.get('padding-block')), '0.625rem');
});

test('legacy small shadow, blur and radius defaults are explicit in the compiled cohort', () => {
  assert.equal(declarations('.rounded-sm').get('border-radius'), '0.125rem');
  assert.equal(declarations('.blur-sm').get('--tw-blur'), 'blur(4px)');
  assert.match(declarations('.shadow-sm').get('--tw-shadow'), /^0 1px 2px 0 /);
  assert.equal(declarations('.backdrop-blur-sm').get('--tw-backdrop-blur'), 'blur(4px)');
  assert.match(declarations('.ring').get('--tw-ring-shadow'), /calc\(3px \+/);
  assert.match(declarations('.ring').get('--tw-ring-shadow'), /rgb\(59 130 246 \/ 0\.5\)/);
});

test('legacy outline class names finish with transparent outlines rather than suppressing forced colors', () => {
  const selector = '.outline-none,\n  .focus\\:outline-none:focus,\n  .focus-visible\\:outline-none:focus-visible';
  const outline = declarations(selector);
  assert.equal(outline.get('outline'), '2px solid transparent');
  assert.equal(outline.get('outline-offset'), '2px');
  let forcedOutline;
  result.root.walkRules((rule) => {
    if (rule.selector === '.input') rule.walkAtRules('media', (media) => {
      if (media.params === '(forced-colors: active)') {
        forcedOutline = media.nodes.find((node) => node.type === 'decl' && node.prop === 'outline')?.value;
      }
    });
  });
  assert.equal(forcedOutline, '2px solid transparent');
});

test('compiled stylesheet includes desktop/mobile variants and Radix animation plugin output', () => {
  const media = [];
  result.root.walkAtRules('media', (rule) => media.push(rule.params));
  assert.ok(media.includes('(width >= 48rem)'));
  assert.ok(media.includes('(width >= 80rem)'));
  assert.ok(declarations('.animate-in').has('animation-name'));
  assert.ok(declarations('.animate-out').has('animation-name'));
  assert.doesNotMatch(result.css, /@tailwind\s|@apply\s/);
});

test('Tailwind 4 class merging retains overrides and responsive variants used by existing components', () => {
  assert.equal(twMerge('rounded-md px-4 bg-white', 'rounded-lg px-6 bg-[#fbf9fc]'), 'rounded-lg px-6 bg-[#fbf9fc]');
  assert.equal(twMerge('hidden md:flex xl:hidden', 'md:block'), 'hidden xl:hidden md:block');
  assert.equal(twMerge('focus-visible:ring-2 focus-visible:ring-[#8b35e6]', 'focus-visible:ring-4'), 'focus-visible:ring-[#8b35e6] focus-visible:ring-4');
});

test('Router 7 declarative matching preserves public share params and named detail routes', () => {
  const routes = [{ path: '/questionnaires/response/:shareToken' }, { path: '/libraries/:libraryId' }, { path: '*' }];
  assert.equal(matchRoutes(routes, '/questionnaires/response/synthetic-share')[0].params.shareToken, 'synthetic-share');
  assert.equal(matchRoutes(routes, '/libraries/synthetic-library')[0].params.libraryId, 'synthetic-library');
  assert.equal(matchRoutes(routes, '/unknown')[0].route.path, '*');
});

test('actual Vite configuration uses supported Rolldown groups with existing feature/vendor ownership', async () => {
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(appRoot, 'vite.config.ts'));
  const output = loaded.config.build.rolldownOptions.output;
  assert.equal(loaded.config.build.rollupOptions, undefined);
  const groups = output.codeSplitting.groups;
  const owner = (id) => groups.find((group) => group.test(id))?.name;
  assert.equal(owner('/example/node_modules/react-router/dist/index.js'), 'react-vendor');
  assert.equal(owner('/example/node_modules/@radix-ui/react-dialog/dist/index.js'), 'radix-ui');
  assert.equal(owner('/example/apps/web/src/features/evidence/EvidencePage.tsx'), 'evidence-operations');
  assert.equal(owner('/example/apps/web/src/features/builders/QuestionnaireResponsePage.tsx'), 'builders-ai');
  assert.equal(owner('/example/apps/web/src/shared/api/client.ts'), undefined);
});

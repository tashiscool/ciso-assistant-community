import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(webRoot, 'src/features/builders/QuestionnaireResponsePage.tsx');
const ts = createRequire(path.join(webRoot, 'package.json'))('typescript');
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  fileName: sourcePath,
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
  },
});
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const questions = [
  { ref: 'notes', prompt: 'Access review notes', type: 'text', section: 'Review', enableUpload: true },
  { ref: 'confirmed', prompt: 'Reviewed?', type: 'boolean', section: 'Review' },
  { ref: 'owner', prompt: 'Reviewer role', type: 'single-select', section: 'Review', options: ['Analyst', 'ISSO'] },
  { ref: 'policy', prompt: 'Managed policy', type: 'text', section: 'Review' },
];
const shell = {
  title: 'Synthetic access review', templateName: 'Synthetic example', status: 'Open',
  dueDate: null, loginRequired: false, questions,
};

function instance({ token = 'example-a', status = 'Open', answers = {}, uploads = {}, disabled = ['policy'] } = {}) {
  return {
    id: `synthetic-${token}`, title: shell.title, status, answers, uploads,
    percentComplete: 100, passingStatus: 'Passing', score: 0, maxScore: 0,
    runtime: {
      hiddenQuestions: [], disabledQuestions: disabled, requiredQuestions: [],
      displayOptions: {}, validationErrors: [],
    },
  };
}

/**
 * Executes the real compiled component, its event handlers and dependency effects
 * with stateful hook/JSX shims and pending fake API calls. This is a scoped handler
 * and rendered-props regression, not a browser, React scheduler or DOM test.
 * State is created by the component; the harness never seeds hook slot numbers.
 */
function createHarness({ initialInstance = instance(), publicQuestions = questions } = {}) {
  const slots = [];
  const requests = [];
  const queued = new Map();
  let cursor = 0;
  let effects = [];
  let shareToken = 'example-a';
  let tree;
  const RegModal = Symbol('RegModal');
  const hooks = {
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && dependencies.every((value, position) => Object.is(value, previous.dependencies[position]))) return;
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { dependencies: [...dependencies], cleanup: effect() };
      });
    },
  };
  function request(method, url, body) {
    requests.push({ method, url, body });
    const pending = queued.get(method)?.shift();
    if (pending) return pending.promise;
    if (method === 'GET') return Promise.resolve({ data: { ...shell, questions: publicQuestions, title: `${shell.title} ${shareToken}` } });
    if (method === 'POST' && url.endsWith('/validate')) return Promise.resolve({ data: initialInstance });
    throw new Error(`Unexpected questionnaire test request: ${method} ${url}`);
  }
  class FakeApiClient {
    get(url) { return request('GET', url); }
    post(url, body) { return request('POST', url, body); }
    put(url, body) { return request('PUT', url, body); }
  }
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, module: { exports }, Error, Set,
    require(specifier) {
      if (specifier === 'react') return hooks;
      if (specifier === 'react/jsx-runtime') {
        const jsx = (type, props) => ({ type, props });
        return { jsx, jsxs: jsx, Fragment: Symbol('Fragment') };
      }
      if (specifier === 'react-router-dom') return { useParams: () => ({ shareToken }) };
      if (specifier === '../../components/regovise/PagePrimitives') return { RegModal, RegStatusPill: Symbol('RegStatusPill') };
      if (specifier === '../../shared/api/client') return { ApiClient: FakeApiClient };
      throw new Error(`Unexpected questionnaire test import: ${specifier}`);
    },
  }, { filename: sourcePath });

  function render() {
    cursor = 0;
    effects = [];
    tree = exports.QuestionnaireResponsePage();
    effects.forEach((effect) => effect());
    return tree;
  }
  function nodes(node) {
    if (node == null || typeof node === 'boolean') return [];
    if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
    if (typeof node !== 'object') return [];
    // Execute the real stateless table child; hook scheduling remains scoped to
    // the page harness and is not a substitute for React/DOM browser coverage.
    if (typeof node.type === 'function') return nodes(node.type(node.props));
    if (node.type === RegModal && !node.props.open) return [];
    return [node, ...nodes(node.props?.children), ...nodes(node.type === RegModal ? node.props.footer : null)];
  }
  function textOf(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (typeof node === 'object' && typeof node.type === 'function') return textOf(node.type(node.props));
    return typeof node === 'object' ? textOf(node.props?.children) : String(node);
  }
  function field(id) {
    const found = nodes(tree).find((node) => node.props?.id === id);
    assert.ok(found, `Missing rendered field: ${id}`);
    return found;
  }
  function button(label) {
    const found = nodes(tree).find((node) => node.type === 'button' && (textOf(node) === label || node.props['aria-label'] === label));
    assert.ok(found, `Missing rendered button: ${label}`);
    return found;
  }
  async function settle() {
    // Actual request handlers have at most two awaited API calls (save + submit).
    for (let step = 0; step < 4; step += 1) await Promise.resolve();
    render();
  }
  function change(id, value) {
    const control = field(id);
    assert.ok(!control.props.disabled, `Cannot edit disabled field: ${id}`);
    assert.equal(typeof control.props.onChange, 'function', `Cannot edit read-only field: ${id}`);
    control.props.onChange({ target: { value }, currentTarget: { selectedOptions: Array.isArray(value) ? value.map((entry) => ({ value: entry })) : [] } });
    render();
  }
  function click(label) {
    const control = button(label);
    assert.ok(!control.props.disabled, `Cannot click disabled button: ${label}`);
    control.props.onClick();
    render();
  }
  function pending(method) {
    const result = deferred();
    if (!queued.has(method)) queued.set(method, []);
    queued.get(method).push(result);
    return result;
  }
  return {
    render, settle, change, click, field, button, pending, requests,
    controls: () => nodes(tree).filter((node) => ['input', 'select', 'textarea'].includes(node.type)),
    status: () => nodes(tree).find((node) => node.props?.role === 'status'),
    labelFor: (id) => nodes(tree).find((node) => node.type === 'label' && node.props.htmlFor === id),
    link: (label) => nodes(tree).find((node) => node.type === 'a' && textOf(node) === label),
    visibleText: () => textOf(tree),
    changeToken(token) { shareToken = token; render(); },
  };
}

async function openResponse(harness) {
  harness.render();
  await harness.settle();
  harness.change('questionnaire-access-code', '123456789');
  harness.click('Validate');
  await harness.settle();
}

test('pending access validation locks the actual access-code input and Validate button', async () => {
  const harness = createHarness();
  harness.render();
  await harness.settle();
  assert.equal(harness.field('questionnaire-access-code').props.disabled, false);
  harness.change('questionnaire-access-code', '123456789');
  const validation = harness.pending('POST');
  harness.click('Validate');
  assert.equal(harness.field('questionnaire-access-code').props.disabled, true);
  assert.equal(harness.button('Validate').props.disabled, true);
  assert.equal(harness.requests.at(-1).body.accessCode, '123456789');
  validation.resolve({ data: instance() });
  await harness.settle();
  assert.equal(harness.field('question-notes').props.disabled, false);
});

test('delayed Save locks all question/evidence controls and preserves the saved draft on success', async () => {
  const harness = createHarness();
  await openResponse(harness);
  assert.equal(harness.field('question-notes').props.disabled, false);
  assert.equal(harness.field('question-confirmed').props.disabled, false);
  assert.equal(harness.field('question-owner').props.disabled, false);
  assert.equal(harness.field('question-notes-evidence').props.disabled, false);
  assert.equal(harness.field('question-policy').props.disabled, true);
  harness.change('question-notes', 'Synthetic confirmed review');
  harness.change('question-confirmed', 'true');
  harness.change('question-owner', 'ISSO');
  harness.change('question-notes-evidence', 'synthetic-access-review.pdf');
  const saved = harness.pending('PUT');
  harness.click('Save');
  assert.equal(harness.requests.at(-1).method, 'PUT');
  assert.equal(harness.requests.at(-1).url, '/builders/questionnaire-access/example-a/responses');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.equal(answers.notes, 'Synthetic confirmed review');
  assert.equal(answers.confirmed, true);
  assert.equal(answers.owner, 'ISSO');
  assert.equal(uploads.notes, 'synthetic-access-review.pdf');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  assert.equal(harness.button('Saving...').props.disabled, true);
  assert.equal(harness.button('Submit').props.disabled, true);
  assert.throws(() => harness.change('question-notes', 'Newer unsaved edit'), /Cannot edit disabled field/);
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.equal(harness.field('question-notes').props.value, 'Synthetic confirmed review');
  assert.equal(harness.field('question-notes-evidence').props.value, 'synthetic-access-review.pdf');
  assert.equal(harness.field('question-notes').props.disabled, false);
  assert.equal(harness.button('Save').props.disabled, false);
  assert.equal(harness.field('question-policy').props.disabled, true);
  assert.match(harness.visibleText(), /Progress saved\./);
});

test('rejected Save retains the unsaved answer/evidence and re-enables Open controls', async () => {
  const harness = createHarness();
  await openResponse(harness);
  harness.change('question-notes', 'Synthetic draft must survive failure');
  harness.change('question-notes-evidence', 'draft-evidence.pdf');
  const saved = harness.pending('PUT');
  harness.click('Save');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  saved.reject(new Error('Synthetic save unavailable'));
  await harness.settle();
  assert.equal(harness.field('question-notes').props.value, 'Synthetic draft must survive failure');
  assert.equal(harness.field('question-notes-evidence').props.value, 'draft-evidence.pdf');
  assert.equal(harness.field('question-notes').props.disabled, false);
  assert.equal(harness.button('Save').props.disabled, false);
  assert.equal(harness.button('Submit').props.disabled, false);
  assert.equal(harness.field('question-policy').props.disabled, true);
  assert.match(harness.visibleText(), /Synthetic save unavailable/);
  assert.equal(harness.requests.filter((request) => request.method === 'PUT').length, 1);
});

test('submission keeps fields locked across save and submit requests and after Submitted readback', async () => {
  const harness = createHarness();
  await openResponse(harness);
  harness.change('question-notes', 'Synthetic final review');
  const saved = harness.pending('PUT');
  const submitted = harness.pending('POST');
  harness.click('Submit');
  harness.click('Submit response');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.ok(harness.controls().every((control) => control.props.disabled));
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.equal(harness.requests.at(-1).url, '/builders/questionnaire-access/example-a/submit');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  assert.equal(harness.button('Submitting...').props.disabled, true);
  submitted.resolve({ data: instance({ status: 'Submitted', answers, uploads }) });
  await harness.settle();
  assert.equal(harness.field('question-notes').props.value, 'Synthetic final review');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  assert.equal(harness.button('Save').props.disabled, true);
  assert.equal(harness.button('Submit').props.disabled, true);
  assert.match(harness.visibleText(), /Questionnaire submitted\. Answers are now locked/);
});

test('an already Submitted response remains locked when no request is pending', async () => {
  const harness = createHarness({ initialInstance: instance({ status: 'Submitted', answers: { notes: 'Synthetic submitted answer' } }) });
  await openResponse(harness);
  assert.equal(harness.field('question-notes').props.value, 'Synthetic submitted answer');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  assert.equal(harness.button('Save').props.disabled, true);
  assert.equal(harness.button('Submit').props.disabled, true);
});

test('RequestChanges permits idle edits while runtime-disabled fields remain locked', async () => {
  const harness = createHarness({ initialInstance: instance({ status: 'RequestChanges' }) });
  await openResponse(harness);
  assert.equal(harness.field('question-notes').props.disabled, false);
  assert.equal(harness.field('question-notes-evidence').props.disabled, false);
  assert.equal(harness.button('Save').props.disabled, false);
  assert.equal(harness.field('question-policy').props.disabled, true);
});

test('changing tokens runs the real effect cleanup and ignores an old Save during new validation', async () => {
  const harness = createHarness();
  await openResponse(harness);
  harness.change('question-notes', 'Synthetic previous-token draft');
  const oldSave = harness.pending('PUT');
  harness.click('Save');
  harness.changeToken('example-b');
  await harness.settle();
  harness.change('questionnaire-access-code', '987654321');
  const newValidation = harness.pending('POST');
  harness.click('Validate');
  oldSave.resolve({ data: instance({ answers: { notes: 'Stale old-token answer' } }) });
  await harness.settle();
  assert.equal(harness.field('questionnaire-access-code').props.value, '987654321');
  assert.equal(harness.field('questionnaire-access-code').props.disabled, true);
  assert.equal(harness.button('Validate').props.disabled, true);
  assert.doesNotMatch(harness.visibleText(), /Progress saved\./);
  newValidation.resolve({ data: instance({ token: 'example-b', answers: { notes: 'Synthetic current-token answer' } }) });
  await harness.settle();
  assert.equal(harness.field('question-notes').props.value, 'Synthetic current-token answer');
  assert.equal(harness.field('question-notes').props.disabled, false);
});

test('native multiselect edits preserve string arrays and expose existing selections outside current options', async () => {
  const publicQuestions = [...questions, { ref: 'scopes', prompt: 'Access scopes', type: 'multi-select', section: 'Review', options: ['Read', 'Write'] }];
  const harness = createHarness({ publicQuestions, initialInstance: instance({ answers: { scopes: ['Read', 'Legacy'] } }) });
  await openResponse(harness);
  const control = harness.field('question-scopes');
  assert.equal(control.type, 'select');
  assert.equal(control.props.multiple, true);
  assert.deepEqual(Array.from(control.props.value), ['Read', 'Legacy']);
  assert.match(harness.visibleText(), /Legacy \(stored selection\)/);
  harness.change('question-scopes', ['Read', 'Write', 'Legacy']);
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.ok(Array.isArray(answers.scopes));
  assert.deepEqual(Array.from(answers.scopes), ['Read', 'Write', 'Legacy']);
  assert.equal(harness.field('question-scopes').props.disabled, true);
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.deepEqual(Array.from(harness.field('question-scopes').props.value), ['Read', 'Write', 'Legacy']);
  assert.equal(harness.field('question-scopes').props.disabled, false);
});

test('an unanswered native multiselect starts empty and saves a selected string array', async () => {
  const publicQuestions = [...questions, { ref: 'scopes', prompt: 'Access scopes', type: 'multi-select', section: 'Review', options: ['Read', 'Write'] }];
  const harness = createHarness({ publicQuestions });
  await openResponse(harness);
  assert.deepEqual(Array.from(harness.field('question-scopes').props.value), []);
  harness.change('question-scopes', ['Write']);
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.deepEqual(Array.from(answers.scopes), ['Write']);
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.deepEqual(Array.from(harness.field('question-scopes').props.value), ['Write']);
});

for (const [label, stored] of [['string', 'Read,Write'], ['mixed array', ['Read', 9]], ['object', { selections: ['Read'] }]]) {
  test(`invalid stored multiselect ${label} is read-only and remains unchanged in another field's Save`, async () => {
    const publicQuestions = [...questions, { ref: 'scopes', prompt: 'Access scopes', type: 'multi-select', section: 'Review', options: ['Read', 'Write'] }];
    const harness = createHarness({ publicQuestions, initialInstance: instance({ answers: { scopes: stored } }) });
    await openResponse(harness);
    const control = harness.field('question-scopes');
    assert.equal(control.type, 'pre');
    assert.equal(control.props.onChange, undefined);
    assert.equal(control.props.children, JSON.stringify(stored, null, 2));
    assert.equal(harness.field('question-scopes-message').props.role, 'alert');
    assert.match(harness.visibleText(), /not a list of text selections and is read-only/);
    assert.throws(() => harness.change('question-scopes', ['Write']), /Cannot edit read-only field/);
    harness.change('question-notes', 'Synthetic unaffected text edit');
    const saved = harness.pending('PUT');
    harness.click('Save');
    const { answers, uploads } = harness.requests.at(-1).body;
    assert.equal(JSON.stringify(answers.scopes), JSON.stringify(stored));
    assert.equal(answers.notes, 'Synthetic unaffected text edit');
    saved.resolve({ data: instance({ answers, uploads }) });
    await harness.settle();
    assert.equal(harness.field('question-scopes').props.children, JSON.stringify(stored, null, 2));
  });
}

test('stored table rows are safely contained and round-trip unchanged when a text answer is saved', async () => {
  const table = [{ system: 'Synthetic system', count: 3, details: { owner: 'Example ISSO' } }, { system: '<script>synthetic text</script>', count: 0 }];
  const publicQuestions = [...questions, { ref: 'systems', prompt: 'Reviewed systems', type: 'table', section: 'Review' }];
  const harness = createHarness({ publicQuestions, initialInstance: instance({ answers: { systems: table } }) });
  await openResponse(harness);
  const control = harness.field('question-systems');
  assert.equal(control.type, 'pre');
  assert.equal(control.props.onChange, undefined);
  assert.equal(control.props.dangerouslySetInnerHTML, undefined);
  assert.equal(control.props.children, JSON.stringify(table, null, 2));
  assert.match(control.props.className, /max-h-64 overflow-auto/);
  assert.match(harness.visibleText(), /Table responses are read-only in this link\. Contact the sender to update this response\./);
  harness.change('question-notes', 'Synthetic edited review notes');
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.equal(JSON.stringify(answers.systems), JSON.stringify(table));
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.equal(harness.field('question-systems').props.children, JSON.stringify(table, null, 2));
});

test('structured fallback answers and evidence stay read-only while scalar text remains editable', async () => {
  const originalAnswers = { notes: { review: 'Synthetic record' }, confirmed: ['yes'], owner: { role: 'ISSO' }, scalar: 42 };
  const originalUploads = { notes: [{ artifact: 'synthetic-evidence.pdf' }] };
  const publicQuestions = [...questions, { ref: 'scalar', prompt: 'Scalar reference', type: 'text', section: 'Review' }];
  const harness = createHarness({ publicQuestions, initialInstance: instance({ answers: originalAnswers, uploads: originalUploads }) });
  await openResponse(harness);
  for (const ref of ['notes', 'confirmed', 'owner']) {
    const control = harness.field(`question-${ref}`);
    assert.equal(control.type, 'pre');
    assert.equal(control.props.onChange, undefined);
    assert.equal(control.props.children, JSON.stringify(originalAnswers[ref], null, 2));
  }
  assert.equal(harness.field('question-notes-evidence').type, 'pre');
  assert.equal(harness.field('question-notes-evidence').props.onChange, undefined);
  assert.equal(harness.field('question-scalar').props.value, '42');
  harness.change('question-scalar', 'Synthetic scalar edit');
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  for (const ref of ['notes', 'confirmed', 'owner']) assert.equal(JSON.stringify(answers[ref]), JSON.stringify(originalAnswers[ref]));
  assert.equal(JSON.stringify(uploads.notes), JSON.stringify(originalUploads.notes));
  assert.equal(answers.scalar, 'Synthetic scalar edit');
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.equal(harness.field('question-notes').props.children, JSON.stringify(originalAnswers.notes, null, 2));
});

test('edits and new Save attempts clear old success status, show Saving, and do not leave success after failure', async () => {
  const harness = createHarness();
  await openResponse(harness);
  assert.equal(harness.status().props['aria-live'], 'polite');
  assert.match(harness.status().props.children, /Access code accepted/);
  harness.change('question-notes', 'Synthetic new answer');
  assert.equal(harness.status(), undefined);
  const first = harness.pending('PUT');
  harness.click('Save');
  assert.equal(harness.status(), undefined);
  assert.equal(harness.button('Saving...').props.disabled, true);
  first.resolve({ data: instance(harness.requests.at(-1).body) });
  await harness.settle();
  assert.equal(harness.status().props.children, 'Progress saved.');
  assert.equal(harness.button('Save').props.disabled, false);
  harness.change('question-notes-evidence', 'synthetic-new-evidence.pdf');
  assert.equal(harness.status(), undefined);
  const second = harness.pending('PUT');
  harness.click('Save');
  second.resolve({ data: instance(harness.requests.at(-1).body) });
  await harness.settle();
  assert.equal(harness.status().props.children, 'Progress saved.');
  const failed = harness.pending('PUT');
  harness.click('Save');
  assert.equal(harness.status(), undefined);
  assert.equal(harness.button('Saving...').props.disabled, true);
  failed.reject(new Error('Synthetic later save failed'));
  await harness.settle();
  assert.equal(harness.status(), undefined);
  assert.equal(harness.button('Save').props.disabled, false);
  assert.match(harness.visibleText(), /Synthetic later save failed/);
  assert.doesNotMatch(harness.visibleText(), /Progress saved\./);
});

const tableQuestion = {
  ref: 'systems', prompt: 'Reviewed systems', type: 'table', section: 'Review',
  tableColumns: [
    { id: 'system', title: 'System', dataType: 'text', required: true },
    { id: 'count', title: 'Account count', dataType: 'number', required: false },
    { id: 'reviewed', title: 'Review date', dataType: 'date', required: false },
    { id: 'classification', title: 'Classification', dataType: 'dropdown', required: false, options: [{ value: 'A' }, { value: 'B' }] },
  ],
};

test('native table add/update/remove handlers save row objects and retain unknown column keys', async () => {
  const retained = { externalReference: { id: 'synthetic-reference' } };
  const rows = [
    { system: 'Synthetic initial', count: 1, reviewed: '2026-10-12', classification: 'A', ...retained },
    { system: 'Synthetic removed', count: '', reviewed: '', classification: '' },
  ];
  const harness = createHarness({ publicQuestions: [...questions, tableQuestion], initialInstance: instance({ answers: { systems: rows } }) });
  await openResponse(harness);
  const prefix = 'question-systems-row-0-';
  assert.equal(harness.field(`${prefix}system`).type, 'input');
  assert.equal(harness.field(`${prefix}system`).props.required, true);
  assert.match(harness.labelFor(`${prefix}system`).props.children.join(''), /Reviewed systems, row 1, System/);
  assert.equal(harness.field(`${prefix}count`).props.type, 'number');
  assert.equal(harness.field(`${prefix}reviewed`).props.type, 'date');
  assert.equal(harness.field(`${prefix}classification`).type, 'select');
  harness.change(`${prefix}system`, 'Synthetic updated');
  harness.change(`${prefix}count`, '2.5');
  harness.change(`${prefix}reviewed`, '2026-11-01');
  harness.change(`${prefix}classification`, 'B');
  harness.click('Add row');
  harness.change('question-systems-row-2-system', 'Synthetic added');
  harness.change('question-systems-row-2-count', '0');
  harness.click('Remove row 2 from Reviewed systems');
  assert.equal(harness.field('question-systems-row-1-system').props.value, 'Synthetic added');
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.ok(Array.isArray(answers.systems));
  assert.equal(answers.systems.length, 2);
  assert.equal(answers.systems[0].system, 'Synthetic updated');
  assert.equal(answers.systems[0].count, 2.5);
  assert.equal(answers.systems[0].reviewed, '2026-11-01');
  assert.equal(answers.systems[0].classification, 'B');
  assert.equal(JSON.stringify(answers.systems[0].externalReference), JSON.stringify(retained.externalReference));
  assert.equal(answers.systems[1].count, 0);
  assert.equal(answers.systems[1].reviewed, '');
  assert.ok(harness.controls().every((control) => control.props.disabled));
  assert.equal(harness.button('Add row').props.disabled, true);
  assert.equal(harness.button('Remove row 1 from Reviewed systems').props.disabled, true);
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
  assert.equal(harness.field(`${prefix}count`).props.value, 2.5);
  assert.equal(harness.field(`${prefix}system`).props.disabled, false);
  assert.equal(harness.button('Add row').props.disabled, false);
});

test('an unanswered table with valid metadata starts empty and creates an array only after Add row', async () => {
  const harness = createHarness({ publicQuestions: [...questions, tableQuestion] });
  await openResponse(harness);
  assert.match(harness.visibleText(), /No rows yet\. Add a row to respond\./);
  harness.click('Add row');
  harness.change('question-systems-row-0-system', 'Synthetic first row');
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.ok(Array.isArray(answers.systems));
  assert.equal(answers.systems[0].system, 'Synthetic first row');
  assert.equal(answers.systems[0].count, '');
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
});

test('native numeric/date table edits accept empty and valid values without committing non-finite or invalid dates', async () => {
  const rows = [{ system: 'Synthetic', count: 4, reviewed: '2026-10-12', classification: 'A' }];
  const harness = createHarness({ publicQuestions: [...questions, tableQuestion], initialInstance: instance({ answers: { systems: rows } }) });
  await openResponse(harness);
  harness.change('question-systems-row-0-count', 'Infinity');
  assert.equal(harness.field('question-systems-row-0-count').props.value, 4);
  harness.change('question-systems-row-0-reviewed', '2026-02-30');
  assert.equal(harness.field('question-systems-row-0-reviewed').props.value, '2026-10-12');
  harness.change('question-systems-row-0-count', '');
  harness.change('question-systems-row-0-reviewed', '');
  const saved = harness.pending('PUT');
  harness.click('Save');
  const { answers, uploads } = harness.requests.at(-1).body;
  assert.equal(answers.systems[0].count, '');
  assert.equal(answers.systems[0].reviewed, '');
  saved.resolve({ data: instance({ answers, uploads }) });
  await harness.settle();
});

for (const [name, status, disabled] of [['submitted', 'Submitted', []], ['rule disabled', 'Open', ['systems']]]) {
  test(`${name} table cells and row actions stay locked without a pending request`, async () => {
    const rows = [{ system: 'Synthetic protected', count: 1, reviewed: '', classification: 'A' }];
    const harness = createHarness({ publicQuestions: [...questions, tableQuestion], initialInstance: instance({ status, disabled, answers: { systems: rows } }) });
    await openResponse(harness);
    for (const column of tableQuestion.tableColumns) assert.equal(harness.field(`question-systems-row-0-${column.id}`).props.disabled, true);
    assert.equal(harness.button('Add row').props.disabled, true);
    assert.equal(harness.button('Remove row 1 from Reviewed systems').props.disabled, true);
  });
}

for (const [name, rows] of [['string', 'legacy table'], ['null row', [null]], ['nested array', [['legacy']]], ['numeric string cell', [{ system: 'Synthetic', count: '4' }]], ['invalid date cell', [{ system: 'Synthetic', reviewed: '2026-02-30' }]]]) {
  test(`table with ${name} remains read-only and unchanged despite valid column metadata`, async () => {
    const harness = createHarness({ publicQuestions: [...questions, tableQuestion], initialInstance: instance({ answers: { systems: rows } }) });
    await openResponse(harness);
    assert.equal(harness.field('question-systems').type, 'pre');
    assert.equal(harness.field('question-systems').props.onChange, undefined);
    harness.change('question-notes', 'Synthetic separate answer');
    const saved = harness.pending('PUT');
    harness.click('Save');
    const { answers, uploads } = harness.requests.at(-1).body;
    assert.equal(JSON.stringify(answers.systems), JSON.stringify(rows));
    saved.resolve({ data: instance({ answers, uploads }) });
    await harness.settle();
    assert.equal(harness.field('question-systems').props.children, JSON.stringify(rows, null, 2));
  });
}

test('invalid table column metadata keeps an existing row array read-only', async () => {
  const rows = [{ system: 'Synthetic legacy row', custom: { untouched: true } }];
  const invalidQuestion = { ...tableQuestion, tableColumns: [{ id: 'system', title: 'System', dataType: 'unknown', required: true }] };
  const harness = createHarness({ publicQuestions: [...questions, invalidQuestion], initialInstance: instance({ answers: { systems: rows } }) });
  await openResponse(harness);
  assert.equal(harness.field('question-systems').type, 'pre');
  assert.equal(harness.field('question-systems').props.children, JSON.stringify(rows, null, 2));
});

for (const stage of ['load', 'validate', 'save']) {
  test(`typed questionnaire_login_required on ${stage} provides only a fixed encoded questionnaire Sign in link`, async () => {
    const harness = createHarness();
    let pending;
    if (stage === 'load') { pending = harness.pending('GET'); harness.render(); }
    else if (stage === 'validate') {
      harness.render(); await harness.settle();
      harness.change('questionnaire-access-code', '123456789');
      pending = harness.pending('POST'); harness.click('Validate');
    } else {
      await openResponse(harness);
      pending = harness.pending('PUT'); harness.click('Save');
    }
    pending.reject(Object.assign(new Error('Sign in to access this questionnaire.'), { status: 401, code: 'questionnaire_login_required' }));
    await harness.settle();
    assert.equal(harness.link('Sign in').props.href, '/login?next=%2Fquestionnaires%2Fresponse%2Fexample-a');
    assert.match(harness.visibleText(), /Sign in to access this questionnaire\./);
  });
}

test('other 401 errors preserve their copy without inventing a questionnaire Sign in link', async () => {
  const harness = createHarness();
  const pending = harness.pending('GET');
  harness.render();
  pending.reject(Object.assign(new Error('Synthetic different unauthorized error'), { status: 401, code: 'other_error' }));
  await harness.settle();
  assert.equal(harness.link('Sign in'), undefined);
  assert.match(harness.visibleText(), /Synthetic different unauthorized error/);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { root, sourceFiles, canonicalRoots, sha256 } from '../lib/repository.mjs';
const require = createRequire(path.join(root, 'apps/web/package.json'));
const ts = require('typescript');
export async function findClones() {
  const bodies = new Map();
  for (const file of (await Promise.all(canonicalRoots.map((directory) => sourceFiles(directory, ['.ts', '.tsx'])))).flat()) {
    if (file.endsWith('.d.ts')) continue;
    const source = await fs.readFile(path.join(root, file), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name && node.body && node.body.statements.length >= 4) {
        const body = node.body.getText(ast).replace(/\s+/g, ' ').trim();
        if (body.length >= 250) {
          const hash = sha256(body);
          const records = bodies.get(hash) ?? [];
          records.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, name: node.name.text }); bodies.set(hash, records);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return [...bodies].filter(([, records]) => new Set(records.map((record) => record.file)).size > 1).map(([hash, records]) => ({ hash, records })).sort((a, b) => a.hash.localeCompare(b.hash));
}
export async function checkReuse() {
  const groups = await findClones();
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'ops/quality/reuse-baseline.json'), 'utf8'));
  const accepted = new Map(baseline.groups.map((group) => [group.hash, group]));
  const failures = [];
  for (const group of groups) {
    const previous = accepted.get(group.hash);
    if (!previous?.reason) failures.push({ reason: 'New nontrivial exact function clone', ...group });
    else {
      const allowed = new Set(previous.records.map((record) => `${record.file}:${record.name}`));
      if (group.records.some((record) => !allowed.has(`${record.file}:${record.name}`))) failures.push({ reason: 'Existing clone expanded to another caller', ...group });
    }
    accepted.delete(group.hash);
  }
  for (const [hash] of accepted) failures.push({ reason: 'Stale reuse exception: reduce the reviewed baseline', hash });
  return { exactCloneGroups: groups.length, reviewedLegacyDebt: baseline.groups.length, failures, note: 'Ratchet for exact named functions; not a semantic duplicate or all-function architecture audit.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkReuse(); console.log(JSON.stringify(result, null, 2)); if (result.failures.length) process.exitCode = 1;
}

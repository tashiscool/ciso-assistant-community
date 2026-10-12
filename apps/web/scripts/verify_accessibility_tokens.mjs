import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const scanRoots = [
  path.join(appRoot, 'src/features'),
  path.join(appRoot, 'src/components'),
  path.join(appRoot, 'src/shell'),
  path.join(appRoot, 'src/styles.css'),
  path.join(appRoot, 'index.html'),
];

const disallowedTokenPattern =
  /(?:text-white|text-slate-|bg-slate-|border-white|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|from-slate|to-slate|via-slate|bg-white\/|bg-black\/|border-white\/|divide-white\/|text-zinc-|bg-zinc-|text-gray-|bg-gray-|badge-(?:success|neutral|warning|danger|error|positive))/g;

const allowedOccurrences = [
  {
    file: 'src/components/ui/button.tsx',
    token: 'text-white',
    reason: 'Primary purple button text has sufficient contrast.',
  },
  {
    file: 'src/shell/Sidebar.tsx',
    token: 'text-white',
    reason: 'Purple staging pill text has sufficient contrast.',
  },
  {
    file: 'src/styles.css',
    token: 'text-white',
    reason: 'Shared primary button uses white text on the purple brand fill.',
  },
];

function walkFiles(entry) {
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    return [entry];
  }

  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((dirent) => {
    const child = path.join(entry, dirent.name);
    if (dirent.isDirectory()) {
      return walkFiles(child);
    }
    return dirent.isFile() ? [child] : [];
  });
}

function lineAndColumn(source, index) {
  const prefix = source.slice(0, index);
  const line = prefix.split('\n').length;
  const lastNewline = prefix.lastIndexOf('\n');
  const column = index - lastNewline;
  return { line, column };
}

const files = scanRoots.flatMap((root) => (fs.existsSync(root) ? walkFiles(root) : []));
const sourceFiles = files.filter((file) => /\.(tsx?|css|html)$/.test(file));
const failures = [];
let matchCount = 0;

for (const file of sourceFiles) {
  const relativeFile = path.relative(appRoot, file);
  const source = fs.readFileSync(file, 'utf8');
  const matches = [...source.matchAll(disallowedTokenPattern)];
  matchCount += matches.length;

  for (const match of matches) {
    const token = match[0];
    const allowed = allowedOccurrences.some(
      (occurrence) => occurrence.file === relativeFile && occurrence.token === token,
    );
    if (allowed) {
      continue;
    }

    const { line, column } = lineAndColumn(source, match.index ?? 0);
    failures.push(`${relativeFile}:${line}:${column} ${token}`);
  }
}

if (failures.length > 0) {
  console.error('Accessibility token verification failed.');
  console.error('Legacy dark/glass tokens remain in source files:');
  for (const failure of failures.slice(0, 120)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 120) {
    console.error(`- ...and ${failures.length - 120} more`);
  }
  process.exit(1);
}

console.log('Accessibility token verification passed.');
console.log(`Source files checked: ${sourceFiles.length}`);
console.log(`Legacy token occurrences found: ${matchCount}`);
console.log(`Intentional contrast-safe allowlisted occurrences: ${allowedOccurrences.length}`);

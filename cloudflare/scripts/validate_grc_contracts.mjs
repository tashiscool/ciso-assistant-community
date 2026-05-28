import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const cloudflareRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const vendorRoot = path.join(cloudflareRoot, 'vendor', 'grc');
const schemaRoot = path.join(vendorRoot, 'schemas');
const fixturesRoot = path.join(vendorRoot, 'fixtures');
const curatedSnapshotFile = path.join(cloudflareRoot, 'src', 'services', 'grc-engine', 'curatedSnapshot.generated.ts');
const bannedContentPatterns = [/\/plugin\b/i, /\/grc-engineer:/i, /claude-grc/i, /\bmarketplace\b/i];

const validationTargets = [
  { schemaFile: 'finding.schema.json', fixtureDir: 'findings' },
  { schemaFile: 'metric.schema.json', fixtureDir: 'metrics' },
  { schemaFile: 'risk.schema.json', fixtureDir: 'risks' },
  { schemaFile: 'exception.schema.json', fixtureDir: 'exceptions' },
  { schemaFile: 'vendor.schema.json', fixtureDir: 'vendors' },
  { schemaFile: 'policy.schema.json', fixtureDir: 'policies' },
];

async function listJsonFiles(root) {
  try {
    await fs.access(root);
  } catch {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const targetPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(targetPath)));
      continue;
    }
    if (entry.name.endsWith('.json')) {
      files.push(targetPath);
    }
  }
  return files.sort();
}

function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return markdown;
  }
  const endIndex = markdown.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return markdown;
  }
  return markdown.slice(endIndex + 5);
}

function sanitizeImportedText(value) {
  return value
    .replace(/claude-grc/gi, 'Regovise GRC')
    .replace(/\bclaude\b/gi, 'Regovise AI')
    .replace(/\bmarketplace\b/gi, 'Regovise framework library')
    .replace(/\bplugins?\b/gi, 'knowledge assets')
    .replace(/\bslash[- ]commands?\b/gi, 'guided actions')
    .replace(/\/grc-engineer:[\w-]+/gi, 'the matching Regovise GRC workflow')
    .replace(/\/plugin(?:\s+[^\n]*)?/gi, 'the Regovise GRC administration workflow')
    .replace(/\~\/\.cache\/claude-grc[^\s)]+/gi, 'the Regovise evidence workspace')
    .replace(/\bscaffolded\b/gi, 'generated')
    .replace(/\blocal plugin runtime\b/gi, 'Regovise execution model');
}

function sanitizeImportedMarkdown(markdown) {
  const normalized = sanitizeImportedText(stripFrontmatter(markdown));
  return normalized
    .replace(/```bash[\s\S]*?```/gi, (block) => {
      if (!/\/plugin|\/grc-engineer:|claude-grc/i.test(block)) {
        return block;
      }
      return [
        '```text',
        '- Open the matching Regovise workspace for this framework workflow.',
        '- Use Findings Explorer, Gap Assessments, Report Bundles, or GRC Admin to complete the task.',
        '- Track evidence and remediation inside Regovise instead of an external plugin runtime.',
        '```',
      ].join('\n');
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function loadCuratedSnapshot() {
  const source = await fs.readFile(curatedSnapshotFile, 'utf8');
  const prefix = 'export const curatedSnapshot = ';
  const suffix = ' as const;';
  if (!source.startsWith(prefix) || !source.trimEnd().endsWith(suffix)) {
    throw new Error(`Unexpected curated snapshot format in ${curatedSnapshotFile}`);
  }
  return JSON.parse(source.slice(prefix.length, source.trimEnd().length - suffix.length));
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  let validatedCount = 0;

  for (const target of validationTargets) {
    const schema = JSON.parse(await fs.readFile(path.join(schemaRoot, target.schemaFile), 'utf8'));
    const validate = ajv.compile(schema);
    const fixtureFiles = await listJsonFiles(path.join(fixturesRoot, target.fixtureDir));

    for (const fixtureFile of fixtureFiles) {
      const payload = JSON.parse(await fs.readFile(fixtureFile, 'utf8'));
      const valid = validate(payload);
      if (!valid) {
        throw new Error(
          `Fixture validation failed for ${fixtureFile}: ${ajv.errorsText(validate.errors, {
            separator: '\n',
          })}`,
        );
      }
      validatedCount += 1;
    }
  }

  const curatedSnapshot = await loadCuratedSnapshot();
  const documents = Array.isArray(curatedSnapshot.frameworks)
    ? curatedSnapshot.frameworks.flatMap((framework) => Array.isArray(framework.documents) ? framework.documents : [])
    : [];
  for (const document of documents) {
    const sanitized = sanitizeImportedMarkdown(String(document.bodyMarkdown ?? ''));
    const offending = bannedContentPatterns.find((pattern) => pattern.test(sanitized));
    if (offending) {
      throw new Error(
        `Sanitized framework content still matched ${offending} in ${String(document.sourcePath ?? document.slug ?? 'unknown document')}`,
      );
    }
  }

  console.log(`Validated ${validatedCount} GRC contract fixtures and ${documents.length} sanitized framework documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

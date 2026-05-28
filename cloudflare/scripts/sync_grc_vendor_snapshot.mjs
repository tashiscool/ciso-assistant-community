import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const upstreamRoot = path.join(workspaceRoot, 'claude-grc-engineering');
const outputTs = path.join(
  workspaceRoot,
  'cloudflare',
  'src',
  'services',
  'grc-engine',
  'curatedSnapshot.generated.ts',
);
const vendorRoot = path.join(workspaceRoot, 'cloudflare', 'vendor', 'grc');

const frameworkScfFrameworkIds = {
  'au-apra-cps-234': 'apac-aus-ps-cps-234-2019',
  'ch-fadp': 'emea-che-fadp-2025',
  'cis-controls': 'general-cis-csc-8-1',
  cmmc: 'usa-federal-dow-cmmc-2-level-2',
  'csa-ccm': 'general-csa-cmm-4-1-0',
  'cyber-essentials-plus': 'emea-gbr-cyber-essentials-requirements-3-3',
  dora: 'emea-eu-dora-2023',
  essential8: 'apac-aus-essential-8-2024',
  'eu-nis2': 'emea-eu-nis2-2022',
  'fedramp-rev5': 'usa-federal-gsa-fedramp-5-mod',
  gdpr: 'emea-eu-gdpr-2016',
  glba: 'usa-federal-law-glba-cfr-314-2023',
  'ind-dpdpa': 'apac-ind-dpdpa-2023',
  ismap: 'apac-jpn-ismap',
  iso27001: 'general-iso-27001-2022',
  'nist-800-53': 'general-nist-800-53-r5-2',
  'nist-csf-20': 'general-nist-csf-2-0',
  nydfs: 'usa-state-ny-dfs-23-nycrr500-2023-amd2',
  'pci-dss': 'general-pci-dss-4-0-1',
  'sg-mas-trm': 'apac-sgp-mas-trm-2021',
  'singapore-pdpa': 'apac-sgp-pdpa-2012',
  soc2: 'general-aicpa-tsc-2017',
  'us-ccpa': 'usa-state-ca-ccpa-cpra-2026',
  'us-finra': 'usa-federal-sro-finra',
  'us-hipaa-security': 'usa-federal-law-hipaa-security-rule-2013',
  'us-nerc-cip': 'usa-federal-nerc-cip-2024',
  'us-sox': 'usa-federal-law-sox-2002',
};

const workflowPluginCategories = {
  'grc-auditor': 'auditor',
  'grc-internal': 'internal',
  'grc-tprm': 'tprm',
  'grc-reporter': 'reporting',
};

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function summarizeMarkdown(markdown) {
  const cleaned = markdown
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/[#>*`_\-\[\]\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 240);
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfPresent(targetPath) {
  if (!(await exists(targetPath))) {
    return null;
  }
  return fs.readFile(targetPath, 'utf8');
}

async function listDirectories(targetPath) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function contentHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function copyDir(source, destination) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
    } else {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function loadFrameworkSnapshot(sourceRevision) {
  const frameworksRoot = path.join(upstreamRoot, 'plugins', 'frameworks');
  const frameworkSlugs = await listDirectories(frameworksRoot);
  const frameworks = [];

  for (const slug of frameworkSlugs) {
    const frameworkRoot = path.join(frameworksRoot, slug);
    const pluginManifestPath = path.join(frameworkRoot, '.claude-plugin', 'plugin.json');
    const pluginManifest = JSON.parse(await fs.readFile(pluginManifestPath, 'utf8'));
    const readme = (await readTextIfPresent(path.join(frameworkRoot, 'README.md'))) ?? '';
    const assessGuide = (await readTextIfPresent(path.join(frameworkRoot, 'commands', 'assess.md'))) ?? '';
    const evidenceChecklist =
      (await readTextIfPresent(path.join(frameworkRoot, 'commands', 'evidence-checklist.md'))) ?? '';
    const scopeGuide = (await readTextIfPresent(path.join(frameworkRoot, 'commands', 'scope.md'))) ?? '';
    const skillsDir = path.join(frameworkRoot, 'skills');
    let implementationGuidance = '';

    if (await exists(skillsDir)) {
      const skillFolders = await listDirectories(skillsDir);
      if (skillFolders.length > 0) {
        implementationGuidance =
          (await readTextIfPresent(path.join(skillsDir, skillFolders[0], 'SKILL.md'))) ?? '';
      }
    }

    const documents = [
      {
        slug: 'overview',
        title: `${pluginManifest.name} overview`,
        docKind: 'overview',
        sourcePath: toPosix(path.relative(upstreamRoot, path.join(frameworkRoot, 'README.md'))),
        bodyMarkdown: readme.trim(),
      },
      {
        slug: 'assessment-guide',
        title: `${pluginManifest.name} assessment guide`,
        docKind: 'assessment-guide',
        sourcePath: toPosix(path.relative(upstreamRoot, path.join(frameworkRoot, 'commands', 'assess.md'))),
        bodyMarkdown: assessGuide.trim(),
      },
      {
        slug: 'evidence-checklist',
        title: `${pluginManifest.name} evidence checklist`,
        docKind: 'evidence-checklist',
        sourcePath: toPosix(
          path.relative(upstreamRoot, path.join(frameworkRoot, 'commands', 'evidence-checklist.md')),
        ),
        bodyMarkdown: evidenceChecklist.trim(),
      },
      {
        slug: 'implementation-guidance',
        title: `${pluginManifest.name} implementation guidance`,
        docKind: 'implementation-guidance',
        sourcePath: implementationGuidance
          ? toPosix(path.relative(upstreamRoot, path.join(skillsDir, (await listDirectories(skillsDir))[0], 'SKILL.md')))
          : toPosix(path.relative(upstreamRoot, path.join(frameworkRoot, 'commands', 'scope.md'))),
        bodyMarkdown: (implementationGuidance || scopeGuide || readme).trim(),
      },
    ]
      .filter((document) => document.bodyMarkdown)
      .map((document) => ({
        ...document,
        summary: summarizeMarkdown(document.bodyMarkdown),
        contentHash: contentHash(document.bodyMarkdown),
      }));

    frameworks.push({
      slug,
      frameworkKey: pluginManifest.name,
      name: pluginManifest.name,
      description: pluginManifest.description ?? summarizeMarkdown(readme),
      category: 'framework',
      version: pluginManifest.version ?? null,
      tags: ['framework', slug],
      scfFrameworkId: frameworkScfFrameworkIds[slug] ?? null,
      sourcePath: toPosix(path.relative(upstreamRoot, frameworkRoot)),
      sourceRevision,
      documents,
    });
  }

  return frameworks;
}

async function loadWorkflowSnapshot(sourceRevision) {
  const pluginsRoot = path.join(upstreamRoot, 'plugins');
  const workflows = [];

  for (const [pluginSlug, category] of Object.entries(workflowPluginCategories)) {
    const pluginRoot = path.join(pluginsRoot, pluginSlug);
    const readme = (await readTextIfPresent(path.join(pluginRoot, 'README.md'))) ?? '';
    const commandsRoot = path.join(pluginRoot, 'commands');
    const skillsRoot = path.join(pluginRoot, 'skills');
    const documents = [];

    if (await exists(commandsRoot)) {
      const commandFiles = (await fs.readdir(commandsRoot)).filter((entry) => entry.endsWith('.md')).sort();
      for (const fileName of commandFiles) {
        const bodyMarkdown = (await fs.readFile(path.join(commandsRoot, fileName), 'utf8')).trim();
        if (!bodyMarkdown) {
          continue;
        }
        documents.push({
          slug: slugify(fileName.replace(/\.md$/, '')),
          title: `${pluginSlug} ${fileName.replace(/\.md$/, '').replace(/-/g, ' ')}`,
          docKind: 'workflow-playbook',
          sourcePath: toPosix(path.relative(upstreamRoot, path.join(commandsRoot, fileName))),
          bodyMarkdown,
          summary: summarizeMarkdown(bodyMarkdown),
          contentHash: contentHash(bodyMarkdown),
        });
      }
    }

    if (await exists(skillsRoot)) {
      const skillFolders = await listDirectories(skillsRoot);
      for (const skillFolder of skillFolders) {
        const skillPath = path.join(skillsRoot, skillFolder, 'SKILL.md');
        const bodyMarkdown = ((await readTextIfPresent(skillPath)) ?? '').trim();
        if (!bodyMarkdown) {
          continue;
        }
        documents.push({
          slug: slugify(skillFolder),
          title: `${pluginSlug} ${skillFolder.replace(/-/g, ' ')}`,
          docKind: 'workflow-guidance',
          sourcePath: toPosix(path.relative(upstreamRoot, skillPath)),
          bodyMarkdown,
          summary: summarizeMarkdown(bodyMarkdown),
          contentHash: contentHash(bodyMarkdown),
        });
      }
    }

    workflows.push({
      slug: pluginSlug,
      name: pluginSlug.replace(/^grc-/, '').replace(/-/g, ' '),
      description: summarizeMarkdown(readme),
      category,
      sourcePath: toPosix(path.relative(upstreamRoot, pluginRoot)),
      sourceRevision,
      documents,
    });
  }

  return workflows;
}

async function buildSnapshot() {
  if (!(await exists(upstreamRoot))) {
    throw new Error(`Expected upstream source at ${upstreamRoot}`);
  }

  let sourceRevision = 'unknown';
  try {
    const { stdout } = await execFile('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD']);
    sourceRevision = stdout.trim();
  } catch {}

  const frameworks = await loadFrameworkSnapshot(sourceRevision);
  const workflows = await loadWorkflowSnapshot(sourceRevision);

  return {
    generatedAt: new Date().toISOString(),
    sourceRepo: 'GRCEngClub/claude-grc-engineering',
    sourceRevision,
    frameworks,
    workflows,
  };
}

async function main() {
  const snapshot = await buildSnapshot();
  await fs.mkdir(path.dirname(outputTs), { recursive: true });
  await fs.writeFile(
    outputTs,
    `export const curatedSnapshot = ${JSON.stringify(snapshot, null, 2)} as const;\n`,
    'utf8',
  );

  await fs.mkdir(vendorRoot, { recursive: true });
  await copyDir(path.join(upstreamRoot, 'schemas'), path.join(vendorRoot, 'schemas'));
  await copyDir(path.join(upstreamRoot, 'tests', 'fixtures'), path.join(vendorRoot, 'fixtures'));
  console.log(`Wrote curated snapshot to ${outputTs}`);
  console.log(`Copied vendored schemas and fixtures into ${vendorRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cloudflareRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(cloudflareRoot, '..');
const ideaProjectsRoot = path.resolve(repoRoot, '..');
const osaRoot = process.env.OBSERVABLE_SECURITY_AGENT_ROOT || path.join(ideaProjectsRoot, 'security-infra', 'observable-security-agent');

const httpPath = path.join(cloudflareRoot, 'src', 'services', 'agent', 'http.ts');
const httpSource = fs.readFileSync(httpPath, 'utf8');
const manifestSchemaPath = path.join(osaRoot, 'schemas', 'agent-run-manifest.schema.json');
const sampleBundlePath = path.join(osaRoot, 'web', 'sample-data', 'regovise_handoff_bundle.json');

const requiredSourceMarkers = [
  "resource === 'runs'",
  "id === 'import-observable'",
  'observable-security-agent',
  'assurance_writeback_approvals',
  'putImportedObservableArtifact',
  'putImportedObservableGenericArtifact',
  'importedObservableArtifactKeys',
  'unavailableArtifactFamilies',
  'source_confidence',
  'rejection_diagnostics',
  'live_collection_coverage',
  'normalizeImportedObservablePolicyDecisions',
  'writeback_requests',
  'pending',
  'request-more-evidence',
  'dispatchPerformed: false',
];

const failures = [];
for (const marker of requiredSourceMarkers) {
  if (!httpSource.includes(marker)) failures.push(`Missing backend marker: ${marker}`);
}
if (!fs.existsSync(manifestSchemaPath)) failures.push(`Missing OSA manifest schema: ${manifestSchemaPath}`);
if (!fs.existsSync(sampleBundlePath)) failures.push(`Missing OSA Regovise handoff sample: ${sampleBundlePath}`);

if (fs.existsSync(sampleBundlePath)) {
  const bundle = JSON.parse(fs.readFileSync(sampleBundlePath, 'utf8'));
  if (bundle.target_endpoint !== '/agent/runs/import-observable') failures.push('Sample bundle target endpoint mismatch.');
  if (bundle.writeback_policy?.external_dispatch !== 'disabled') failures.push('Sample bundle must keep external dispatch disabled.');
  if (bundle.manifest?.producer?.name !== 'observable-security-agent') failures.push('Sample bundle manifest producer mismatch.');
  for (const family of ['agent_eval_results', 'normalized_findings', 'draft_tickets', 'source_confidence', 'rejection_diagnostics', 'live_collection_coverage']) {
    if (!bundle.artifacts?.[family]) failures.push(`Sample bundle missing artifact preview for ${family}.`);
  }
}

if (failures.length) {
  console.error('Observable import contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Observable import contract verification passed.');

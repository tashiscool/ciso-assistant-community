import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, sourceFiles, revision, sourceFingerprint, writeJson } from '../lib/repository.mjs';
import { buildFrontendBackendAlignment } from '../../cloudflare/scripts/frontend_backend_alignment_check.mjs';
export async function traceFeatures() {
  const alignment = await buildFrontendBackendAlignment();
  const featureRoot = path.join(root, 'apps/web/src/features');
  const features = [];
  for (const entry of await fs.readdir(featureRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const prefix = `apps/web/src/features/${entry.name}/`;
    features.push({
      feature: entry.name, sourceFiles: await sourceFiles(prefix),
      apiCallDeclarations: alignment.coverage.frontendApiCalls.filter((call) => call.file?.startsWith(prefix)),
      proof: { source: 'declared', frontendRuntime: 'not-established-by-this-audit', workerRuntime: 'not-established-by-this-audit', providerRuntime: 'not-established-by-this-audit' },
      productRole: ['ato-workspace-preview', 'vanta'].includes(entry.name) ? 'prototype-reference' : 'canonical-feature',
    });
  }
  return { generatedAt: new Date().toISOString(), revision: revision(), sourceFingerprint: await sourceFingerprint(), scope: 'static-source-inventory', summary: alignment.summary, features, routeDeclarations: alignment.coverage.frontendRoutes, evidenceLimit: 'Declared routes/calls and existing static alignment are not executed behavioral or external-provider proof. Runtime run reports must match revision and source fingerprint.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await traceFeatures(); const output = path.join(root, 'artifacts/verification/feature-traceability.json'); await writeJson(output, result);
  console.log(JSON.stringify({ output, features: result.features.length, ...result.summary, proofTier: result.scope }, null, 2));
}

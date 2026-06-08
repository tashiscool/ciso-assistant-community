#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const apiSource = fs.readFileSync(path.join(webRoot, 'src', 'features', 'assurance', 'api.ts'), 'utf8');
const inspectorSource = fs.readFileSync(path.join(webRoot, 'src', 'features', 'assurance', 'AgentRunInspectorPage.tsx'), 'utf8');

const required = [
  [apiSource, 'importObservableAgentRun', 'API helper'],
  [apiSource, '/agent/runs/import-observable', 'API endpoint'],
  [inspectorSource, 'Observable Security Agent import', 'Inspector import panel'],
  [inspectorSource, 'observableImportText', 'Inspector import state'],
  [inspectorSource, 'handleObservableImport', 'Inspector import action'],
  [inspectorSource, 'Load sample OSA run', 'Inspector sample import action'],
  [inspectorSource, 'source_confidence', 'Inspector source confidence preview'],
  [inspectorSource, 'rejection_diagnostics', 'Inspector rejection diagnostics preview'],
  [inspectorSource, 'live_collection_coverage', 'Inspector live coverage preview'],
  [inspectorSource, 'request_more_evidence', 'Inspector more evidence action'],
  [inspectorSource, 'Export draft', 'Inspector export draft action'],
  [inspectorSource, 'No external dispatch was performed', 'Inspector no-dispatch approval copy'],
  [apiSource, 'requestWritebackEvidence', 'API more evidence helper'],
  [apiSource, 'markWritebackDuplicate', 'API duplicate helper'],
  [apiSource, 'exportWritebackDraft', 'API export helper'],
  [inspectorSource, 'writeback', 'Writeback visibility'],
];

const failures = required.filter(([source, marker]) => !source.includes(marker)).map(([, marker, label]) => `${label} missing marker ${marker}`);
if (failures.length) {
  console.error('Observable import UI verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Observable import UI verification passed.');

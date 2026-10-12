#!/usr/bin/env node
// Canonical production smoke is the bounded release probe. Broad domain/fixture
// journeys belong in isolated local verification, not a production deployment.
import { runProductionProbeCli } from '../../ops/release/production_probe.mjs';
const args = process.argv.slice(2);
if (args[0] && !args[0].startsWith('--')) args.splice(0, 1, '--base-url', args[0]);
runProductionProbeCli(args).catch(() => {
  console.error('Production release probe failed; credentials and response bodies are omitted.');
  process.exitCode = 1;
});

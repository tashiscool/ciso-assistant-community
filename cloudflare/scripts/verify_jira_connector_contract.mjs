import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const http = readFileSync(resolve(root, 'src/services/agent/http.ts'), 'utf8');
const jira = readFileSync(resolve(root, 'src/services/agent/jira.ts'), 'utf8');

const required = [
  ["dispatch-jira route", "action === 'dispatch-jira'"],
  ["approved state gate", "approved' && approval.status !== 'dispatch_failed"],
  ["connector run evidence", "integration_connector_runs"],
  ["Jira create operation", "create_issue"],
  ["Jira comment operation", "add_comment"],
  ["Jira link operation", "link_issue"],
  ["Jira transition operation", "transition_issue"],
  ["Jira ticket import route", "action === 'import-tickets'"],
  ["Jira ticket import helper", "importJiraTickets"],
  ["dry-run helper", "dryRunJiraWriteIntent"],
  ["dispatch helper", "dispatchJiraWriteIntent"],
  ["Jira import preservation", "normalizeImportedObservableJiraWritebacks"],
];

const failures = [];
for (const [label, needle] of required) {
  if (!http.includes(needle) && !jira.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

if (failures.length) {
  console.error('Jira connector contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Jira connector contract check passed.');

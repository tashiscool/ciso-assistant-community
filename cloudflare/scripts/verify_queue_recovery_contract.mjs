import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferOriginalQueue } from '../src/queues/deadLetter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const grcConsumer = fs.readFileSync(path.join(root, 'src/queues/grc.ts'), 'utf8');

const examples = [
  [{ type: 'evidence.job.run' }, 'ciso-assistant-evidence-jobs'],
  [{ type: 'conmon.execution.run' }, 'ciso-assistant-conmon-jobs'],
  [{ type: 'grc.content.import' }, 'ciso-assistant-grc-content-import'],
  [{ type: 'grc.scf.refresh' }, 'ciso-assistant-grc-scf-refresh'],
  [{ type: 'grc.finding.ingest' }, 'ciso-assistant-grc-finding-ingest'],
  [{ type: 'grc.connector.collect' }, 'ciso-assistant-grc-finding-ingest'],
  [{ type: 'grc.gap.report' }, 'ciso-assistant-grc-gap-report'],
  [{ type: 'grc.gap.report', reportKind: 'board-brief' }, 'ciso-assistant-grc-content-import'],
  [{ type: 'grc.evidence.package' }, 'ciso-assistant-grc-gap-report'],
  [{ type: 'grc.ai.enrich' }, 'ciso-assistant-grc-ai-enrich'],
];

for (const [payload, expected] of examples) {
  assert.equal(inferOriginalQueue(payload), expected);
}
assert.equal(inferOriginalQueue({ type: 'not-real' }), 'unknown');
assert.equal((wrangler.match(/dead_letter_queue = "ciso-assistant-dlq"/g) ?? []).length, 14);
assert.equal((wrangler.match(/\{ queue = "ciso-assistant-dlq",/g) ?? []).length, 2);
assert.match(grcConsumer, /message\.retry\(\)/);
assert.doesNotMatch(grcConsumer, /GRC queue message failed[\s\S]{0,400}message\.ack\(\)/);

console.log('Regovise queue recovery contract verified.');

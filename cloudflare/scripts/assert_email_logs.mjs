import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const databaseName =
  process.env.LOCAL_D1_DATABASE_NAME ?? process.env.D1_DATABASE_NAME ?? 'ciso-assistant-d1';
const configuredProvider = (process.env.EMAIL_PROVIDER ?? 'none').trim().toLowerCase();
const normalizedProvider =
  configuredProvider === '' || configuredProvider === 'off' || configuredProvider === 'disabled'
    ? 'none'
    : configuredProvider;
const minCreatedAtMs = Number.parseInt(
  process.env.EMAIL_LOG_MIN_CREATED_AT_MS ?? `${Date.now() - 10 * 60 * 1000}`,
  10,
);

const requiredEvents = [
  'WORKSPACE_ACCESS_PROVISIONED',
  'REPORT_EXPORT_READY',
  'PORTAL_ASSIGNMENT_SUBMITTED',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function queryEmailLogs() {
  const sql = `
    select
      event_type,
      delivery_status,
      provider,
      count(*) as count,
      max(created_at_ms) as latest_created_at_ms
    from transactional_email_delivery_log
    where created_at_ms >= ${minCreatedAtMs}
    group by event_type, delivery_status, provider
    order by event_type, delivery_status, provider
  `;

  const { stdout } = await execFileAsync(
    'npx',
    ['wrangler', 'd1', 'execute', databaseName, '--local', '--json', '--command', sql],
    { cwd: process.cwd() },
  );

  const payload = JSON.parse(stdout);
  return payload?.[0]?.results ?? [];
}

async function main() {
  const rows = await queryEmailLogs();
  assert(Array.isArray(rows), 'Email log query did not return a result set.');

  const byEvent = new Map();
  for (const row of rows) {
    const eventRows = byEvent.get(row.event_type) ?? [];
    eventRows.push(row);
    byEvent.set(row.event_type, eventRows);
  }

  for (const eventType of requiredEvents) {
    const eventRows = byEvent.get(eventType) ?? [];
    assert(eventRows.length >= 1, `Expected an email delivery log row for ${eventType}.`);

    if (normalizedProvider === 'none') {
      assert(
        eventRows.some(
          (row) => row.delivery_status === 'skipped' && `${row.provider}`.toLowerCase() === 'none',
        ),
        `Expected ${eventType} to be logged as skipped with provider=none when email delivery is disabled.`,
      );
    }
  }

  const summary = requiredEvents
    .map((eventType) => {
      const eventRows = byEvent.get(eventType) ?? [];
      return `${eventType}:${eventRows.map((row) => `${row.delivery_status}/${row.provider}`).join(',')}`;
    })
    .join(' | ');

  console.log(`Transactional email log assertions passed: ${summary}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

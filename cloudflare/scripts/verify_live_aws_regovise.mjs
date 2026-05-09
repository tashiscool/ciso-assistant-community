import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const region = process.env.AWS_REGION ?? 'us-gov-west-1';
const csvFile = process.env.AWS_ACCESS_KEYS_CSV ?? process.env.OS_AGENT_CSV ?? path.join(os.homedir(), 'Downloads', 'tash_accessKeys.csv');
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const health = await request('/_api/core/health');
      if (health?.data?.ok === true) {
        return health.data.appEnv ?? 'development';
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Worker at ${baseUrl} did not become healthy in time.`);
}

async function poll(pathname, predicate, attempts = 25, delayMs = 1000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payload = await request(pathname, { headers });
    if (predicate(payload)) {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Polling ${pathname} timed out.`);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

async function loadAwsKeys() {
  const csv = await fs.readFile(csvFile, 'utf8');
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert(lines.length >= 2, `CSV file ${csvFile} did not contain access key rows.`);
  const headersRow = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
  const valuesRow = parseCsvLine(lines[1]);
  const record = Object.fromEntries(headersRow.map((header, index) => [header, valuesRow[index] ?? '']));
  const accessKeyId = record['access key id'] ?? record['access_key_id'] ?? record['aws_access_key_id'];
  const secretAccessKey = record['secret access key'] ?? record['secret_access_key'] ?? record['aws_secret_access_key'];
  assert(accessKeyId, `CSV file ${csvFile} is missing an access key id column.`);
  assert(secretAccessKey, `CSV file ${csvFile} is missing a secret access key column.`);
  return {
    accessKeyId,
    secretAccessKey,
  };
}

async function main() {
  console.log(`Verifying live AWS evidence through Regovise against ${baseUrl}`);
  console.log(`Using access key CSV at ${csvFile}`);
  const appEnv = await waitForHealth();

  await request('/_api/core/bootstrap-demo', { method: 'POST' });
  const { accessKeyId, secretAccessKey } = await loadAwsKeys();
  const uniqueSuffix = Date.now();

  const source = await request('/_api/evidence/sources', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `AWS GovCloud Live Verify ${uniqueSuffix}`,
      provider: 'aws',
      config: {
        owner: 'Cloud Security',
        allowSyntheticSeed: false,
        region,
        regions: [region],
        accountLabel: 'live-verify',
        auth: {
          accessKeyId,
          secretAccessKey,
        },
      },
    }),
  });
  const sourceId = source?.data?.id;
  assert(sourceId, 'Evidence source creation did not return an id.');

  const collection = await request(`/_api/evidence/sources/${sourceId}/collect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputMode: 'live',
      bundleKind: 'assessment',
    }),
  });
  const jobId = collection?.data?.jobId;
  assert(jobId, 'Evidence collection did not return a job id.');

  let job = null;
  try {
    job = await poll(
      `/_api/evidence/jobs/${jobId}`,
      (payload) => ['success', 'failed'].includes(payload?.data?.status),
      30,
      1500,
    );
  } catch (error) {
    if (appEnv !== 'development') {
      throw error;
    }
    await request(`/_api/evidence/jobs/${jobId}/replay`, {
      method: 'POST',
      headers,
    });
    job = await poll(
      `/_api/evidence/jobs/${jobId}`,
      (payload) => ['success', 'failed'].includes(payload?.data?.status),
      20,
      1500,
    );
  }

  assert(job?.data?.status === 'success', `Evidence job ${jobId} ended in ${job?.data?.status}: ${job?.data?.statusDetail ?? 'no detail'}`);
  assert((job?.data?.coverage?.discoveredAssetCount ?? 0) > 0, 'Live AWS collection did not discover any assets.');

  const rawArtifact = await request(`/_api/evidence/jobs/${jobId}/artifacts/raw_input`, { headers });
  const rawPreview = rawArtifact?.data?.preview ?? {};
  assert(rawPreview?.metadata?.generatedFrom === 'aws-live-collector', 'Raw input artifact is not from the AWS live collector.');
  assert(rawPreview?.metadata?.permissionCoverage, 'Raw input artifact is missing AWS permission coverage.');

  const evalRun = await request('/_api/assurance/evals/run', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      evidenceJobId: jobId,
    }),
  });
  assert(evalRun?.data?.summary?.evidenceJobId === jobId, 'Assurance evaluation did not return the expected evidence job.');

  const packageBuild = await request('/_api/assurance/packages/build', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      evidenceJobId: jobId,
      fileName: `live-aws-${uniqueSuffix}.json`,
    }),
  });
  assert(packageBuild?.data?.package?.evidenceJobId === jobId, '20x package build did not return the expected evidence job.');

  console.log(`AWS live evidence collection passed for source ${sourceId}`);
  console.log(`Evidence job ${jobId} discovered ${job.data.coverage.discoveredAssetCount} assets and ${job.data.coverage.cloudEventCount} cloud events.`);
  console.log(`Package reconciliation status: ${packageBuild?.data?.reconciliation?.status ?? 'unknown'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

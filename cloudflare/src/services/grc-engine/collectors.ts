import { AwsClient } from 'aws4fetch';
import { XMLParser } from 'fast-xml-parser';
import type { EnvBindings } from '../../types/env';
import type { FindingV1 } from './types';

export const NATIVE_COLLECTOR_PROVIDERS = ['github', 'wiz', 'aws', 'okta'] as const;

export type NativeCollectorSource = (typeof NATIVE_COLLECTOR_PROVIDERS)[number];

export type NativeCollectorConnector = {
  id: string | null;
  name: string;
  provider: string;
  category: string;
  authMode: string | null;
  baseUrl: string | null;
  status: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  capabilities: string[];
  lastError: string | null;
};

export type NativeCollectorResult = {
  mode: 'live' | 'fixture';
  sourceVersion: string;
  upstreamRunId: string;
  findings: FindingV1[];
  diagnostics: Record<string, unknown>;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getString(config: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function liveCollectorSourceVersion(source: NativeCollectorSource) {
  return `regovise-native-${source}-collector/live-v1`;
}

export function fixtureCollectorSourceVersion(source: NativeCollectorSource) {
  return `regovise-native-${source}-collector/fixture-v1`;
}

export function canUseFixtureCollectors(env: EnvBindings) {
  return env.APP_ENV !== 'production';
}

export function connectorLabel(source: string) {
  switch (normalizeToken(source)) {
    case 'github':
      return 'GitHub';
    case 'wiz':
      return 'Wiz';
    case 'aws':
      return 'AWS';
    case 'okta':
      return 'Okta';
    default:
      return source.toUpperCase();
  }
}

export function connectorCategory(source: string) {
  switch (normalizeToken(source)) {
    case 'github':
      return 'developer-security';
    case 'wiz':
    case 'aws':
      return 'cloud-security';
    case 'okta':
      return 'identity';
    default:
      return 'connector';
  }
}

function buildGithubFinding(
  now: string,
  repository: string,
  title: string,
  status: FindingV1['evaluations'][number]['status'],
  severity: FindingV1['evaluations'][number]['severity'],
  message: string,
  evidenceRefs: string[],
  controlId: string,
  resourceSuffix: string,
) {
  return {
    schema_version: '1.0.0',
    source: 'github',
    source_version: liveCollectorSourceVersion('github'),
    run_id: crypto.randomUUID(),
    collected_at: now,
    resource: {
      type: 'github_repository',
      id: `${repository}:${resourceSuffix}`,
      region: 'global',
    },
    evidence_refs: evidenceRefs,
    evaluations: [
      {
        control_framework: 'SCF',
        control_id: controlId,
        status,
        severity,
        title,
        message,
        evidence_refs: evidenceRefs,
        remediation: {
          summary: message,
          ref: `regovise://grc/github/${resourceSuffix}`,
          automation: status === 'fail' ? 'guided' : 'verified',
        },
      },
    ],
  } satisfies FindingV1;
}

function buildAwsFinding(
  now: string,
  bucket: string,
  region: string,
  accountId: string | null,
  title: string,
  status: FindingV1['evaluations'][number]['status'],
  severity: FindingV1['evaluations'][number]['severity'],
  message: string,
  evidenceRefs: string[],
  controlId: string,
  resourceSuffix: string,
) {
  return {
    schema_version: '1.0.0',
    source: 'aws',
    source_version: liveCollectorSourceVersion('aws'),
    run_id: crypto.randomUUID(),
    collected_at: now,
    resource: {
      type: 'aws_control_surface',
      id: `${bucket}:${resourceSuffix}`,
      arn: `arn:aws:s3:::${bucket}`,
      region,
      account_id: accountId ?? undefined,
    },
    evidence_refs: evidenceRefs,
    evaluations: [
      {
        control_framework: 'SCF',
        control_id: controlId,
        status,
        severity,
        title,
        message,
        evidence_refs: evidenceRefs,
        remediation: {
          summary: message,
          ref: `regovise://grc/aws/${resourceSuffix}`,
          automation: status === 'fail' ? 'guided' : 'verified',
        },
      },
    ],
  } satisfies FindingV1;
}

function buildOktaFinding(
  now: string,
  orgLabel: string,
  title: string,
  status: FindingV1['evaluations'][number]['status'],
  severity: FindingV1['evaluations'][number]['severity'],
  message: string,
  evidenceRefs: string[],
  controlId: string,
  resourceSuffix: string,
) {
  return {
    schema_version: '1.0.0',
    source: 'okta',
    source_version: liveCollectorSourceVersion('okta'),
    run_id: crypto.randomUUID(),
    collected_at: now,
    resource: {
      type: 'okta_admin_surface',
      id: `${orgLabel}:${resourceSuffix}`,
      region: 'global',
    },
    evidence_refs: evidenceRefs,
    evaluations: [
      {
        control_framework: 'SCF',
        control_id: controlId,
        status,
        severity,
        title,
        message,
        evidence_refs: evidenceRefs,
        remediation: {
          summary: message,
          ref: `regovise://grc/okta/${resourceSuffix}`,
          automation: status === 'fail' ? 'guided' : 'verified',
        },
      },
    ],
  } satisfies FindingV1;
}

function buildWizFinding(
  now: string,
  title: string,
  status: FindingV1['evaluations'][number]['status'],
  severity: FindingV1['evaluations'][number]['severity'],
  message: string,
  evidenceRefs: string[],
  resourceId: string,
) {
  return {
    schema_version: '1.0.0',
    source: 'wiz',
    source_version: liveCollectorSourceVersion('wiz'),
    run_id: crypto.randomUUID(),
    collected_at: now,
    resource: {
      type: 'cloud_posture_issue',
      id: resourceId,
      region: 'global',
    },
    evidence_refs: evidenceRefs,
    evaluations: [
      {
        control_framework: 'SCF',
        control_id: 'AST-04',
        status,
        severity,
        title,
        message,
        evidence_refs: evidenceRefs,
        remediation: {
          summary: message,
          ref: `regovise://grc/wiz/${resourceId}`,
          automation: status === 'fail' ? 'guided' : 'verified',
        },
      },
    ],
  } satisfies FindingV1;
}

export function buildNativeCollectorFixtures(source: NativeCollectorSource): FindingV1[] {
  const collectedAt = nowIso();
  switch (source) {
    case 'github':
      return [
        buildGithubFinding(
          collectedAt,
          'regovise/platform-app',
          'Default branch protection',
          'fail',
          'high',
          'The default branch does not require pull-request reviews before merge.',
          ['github://regovise/platform-app/branch-protection'],
          'IAC-03',
          'branch-protection',
        ),
      ];
    case 'wiz':
      return [
        buildWizFinding(
          collectedAt,
          'Public storage exposure',
          'fail',
          'critical',
          'The bucket is internet-accessible and contains compliance evidence artifacts.',
          ['wiz://bucket/regovise-public-artifacts'],
          'regovise-public-artifacts',
        ),
      ];
    case 'aws':
      return [
        buildAwsFinding(
          collectedAt,
          'regovise-prod-logs',
          'us-east-1',
          '123456789012',
          'Encryption at rest',
          'fail',
          'high',
          'Bucket default encryption is not configured.',
          ['aws://s3/regovise-prod-logs/default-encryption'],
          'CRY-05',
          's3-encryption',
        ),
      ];
    case 'okta':
      return [
        buildOktaFinding(
          collectedAt,
          'regovise-admin-access',
          'Privileged MFA enforcement',
          'fail',
          'critical',
          'Administrative access policy does not require phishing-resistant MFA.',
          ['okta://policy/regovise-admin-access'],
          'IAC-06',
          'admin-mfa',
        ),
      ];
  }
}

export function hasLiveCollectorConfiguration(
  source: NativeCollectorSource,
  connector: NativeCollectorConnector | null,
) {
  if (!connector || !connector.isEnabled) {
    return false;
  }
  const config = connector.config ?? {};
  switch (source) {
    case 'github':
      return Boolean(getString(config, ['token', 'accessToken', 'pat']) && getString(config, ['repository', 'repo']));
    case 'wiz':
      return Boolean(
        getString(config, ['apiToken', 'accessToken']) ||
          (getString(config, ['clientId']) && getString(config, ['clientSecret'])),
      );
    case 'aws':
      return Boolean(
        getString(config, ['accessKeyId']) &&
          getString(config, ['secretAccessKey']) &&
          getString(config, ['region']) &&
          getString(config, ['bucket', 'bucketName', 'logBucket']),
      );
    case 'okta':
      return Boolean(getString(config, ['apiToken', 'token']) && (connector.baseUrl || getString(config, ['baseUrl', 'orgUrl'])));
  }
}

async function githubRequest(connector: NativeCollectorConnector, pathname: string) {
  const token = getString(connector.config, ['token', 'accessToken', 'pat']);
  const baseUrl = connector.baseUrl || 'https://api.github.com';
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'regovise-grc-native-collector',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${pathname}.`);
  }
  return response.json();
}

async function collectGithubFindings(connector: NativeCollectorConnector): Promise<NativeCollectorResult> {
  const repository = getString(connector.config, ['repository', 'repo']);
  if (!repository) {
    throw new Error('GitHub collector requires a repository in owner/name form.');
  }
  const repo = asRecord(await githubRequest(connector, `/repos/${repository}`));
  const defaultBranch = typeof repo.default_branch === 'string' && repo.default_branch ? repo.default_branch : 'main';
  const branchProtectionUrl = `/repos/${repository}/branches/${encodeURIComponent(defaultBranch)}/protection`;
  const now = nowIso();
  let protectionRecord: Record<string, unknown> | null = null;
  let protectionEnabled = false;

  try {
    protectionRecord = asRecord(await githubRequest(connector, branchProtectionUrl));
    protectionEnabled = true;
  } catch {
    protectionEnabled = false;
  }

  const requiredReviews = Number(asRecord(protectionRecord?.required_pull_request_reviews).required_approving_review_count ?? 0);
  const statusChecks = asArray<string>(asRecord(protectionRecord?.required_status_checks).contexts);
  const branchProtected = protectionEnabled && requiredReviews > 0 && statusChecks.length > 0;

  const securityAndAnalysis = asRecord(repo.security_and_analysis);
  const codeScanningStatus = asRecord(securityAndAnalysis.code_scanning).status;
  const secretScanningStatus = asRecord(securityAndAnalysis.secret_scanning).status;

  const findings: FindingV1[] = [
    buildGithubFinding(
      now,
      repository,
      'Default branch protection',
      branchProtected ? 'pass' : 'fail',
      branchProtected ? 'low' : 'high',
      branchProtected
        ? `Default branch ${defaultBranch} enforces pull-request reviews and status checks.`
        : `Default branch ${defaultBranch} is missing required reviews or status checks.`,
      [`github://${repository}/branches/${defaultBranch}/protection`],
      'IAC-03',
      'branch-protection',
    ),
    buildGithubFinding(
      now,
      repository,
      'Code scanning readiness',
      codeScanningStatus === 'enabled' ? 'pass' : 'inconclusive',
      codeScanningStatus === 'enabled' ? 'low' : 'medium',
      codeScanningStatus === 'enabled'
        ? 'GitHub code scanning is enabled for the repository.'
        : 'Code scanning readiness could not be confirmed from the repository security posture.',
      [`github://${repository}/security/code-scanning`],
      'AST-02',
      'code-scanning',
    ),
    buildGithubFinding(
      now,
      repository,
      'Secret scanning readiness',
      secretScanningStatus === 'enabled' ? 'pass' : 'inconclusive',
      secretScanningStatus === 'enabled' ? 'low' : 'medium',
      secretScanningStatus === 'enabled'
        ? 'Secret scanning is enabled for the repository.'
        : 'Secret scanning readiness could not be confirmed from the repository security posture.',
      [`github://${repository}/security/secret-scanning`],
      'AST-03',
      'secret-scanning',
    ),
  ];

  return {
    mode: 'live',
    sourceVersion: liveCollectorSourceVersion('github'),
    upstreamRunId: crypto.randomUUID(),
    findings,
    diagnostics: {
      repository,
      defaultBranch,
      requiredReviews,
      requiredStatusChecks: statusChecks.length,
      codeScanningStatus: typeof codeScanningStatus === 'string' ? codeScanningStatus : 'unknown',
      secretScanningStatus: typeof secretScanningStatus === 'string' ? secretScanningStatus : 'unknown',
    },
  };
}

async function fetchWizAccessToken(connector: NativeCollectorConnector) {
  const bearer = getString(connector.config, ['apiToken', 'accessToken']);
  if (bearer) {
    return bearer;
  }
  const clientId = getString(connector.config, ['clientId']);
  const clientSecret = getString(connector.config, ['clientSecret']);
  if (!clientId || !clientSecret) {
    return null;
  }
  const baseUrl = (connector.baseUrl || 'https://api.us1.app.wiz.io').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: 'wiz-api',
      grant_type: 'client_credentials',
    }),
  });
  if (!response.ok) {
    throw new Error(`Wiz token request failed (${response.status}).`);
  }
  const body = asRecord(await response.json());
  return typeof body.access_token === 'string' && body.access_token ? body.access_token : null;
}

async function collectWizFindings(connector: NativeCollectorConnector): Promise<NativeCollectorResult> {
  const token = await fetchWizAccessToken(connector);
  if (!token) {
    throw new Error('Wiz collector requires apiToken/accessToken or clientId/clientSecret.');
  }
  const baseUrl = (connector.baseUrl || 'https://api.us1.app.wiz.io').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query RegoviseIssues($first: Int!) {
          issuesV2(first: $first) {
            nodes {
              id
              severity
              status
              type
              title
              entitySnapshot {
                name
              }
            }
          }
        }
      `,
      variables: { first: 5 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Wiz GraphQL request failed (${response.status}).`);
  }
  const body = asRecord(await response.json());
  const issues = asArray<Record<string, unknown>>(asRecord(asRecord(asRecord(body.data).issuesV2)).nodes);
  const now = nowIso();
  const findings =
    issues.length > 0
      ? issues.map((issue) =>
          buildWizFinding(
            now,
            typeof issue.title === 'string' && issue.title ? issue.title : 'Wiz cloud posture issue',
            normalizeToken(String(issue.status ?? 'open')) === 'resolved' ? 'pass' : 'fail',
            normalizeToken(String(issue.severity ?? 'high')) === 'critical'
              ? 'critical'
              : normalizeToken(String(issue.severity ?? 'high')) === 'medium'
                ? 'medium'
                : normalizeToken(String(issue.severity ?? 'high')) === 'low'
                  ? 'low'
                  : 'high',
            `Wiz reported ${String(issue.type ?? 'an issue')} for ${String(asRecord(issue.entitySnapshot).name ?? 'the cloud resource')}.`,
            [`wiz://issues/${String(issue.id ?? crypto.randomUUID())}`],
            String(issue.id ?? crypto.randomUUID()),
          ),
        )
      : [
          buildWizFinding(
            now,
            'Wiz issue feed',
            'pass',
            'low',
            'Wiz did not return open issues for the configured tenant scope.',
            ['wiz://issues'],
            'no-open-issues',
          ),
        ];

  return {
    mode: 'live',
    sourceVersion: liveCollectorSourceVersion('wiz'),
    upstreamRunId: crypto.randomUUID(),
    findings,
    diagnostics: {
      issueCount: issues.length,
      graphQLEndpoint: `${baseUrl}/graphql`,
    },
  };
}

async function collectOktaFindings(connector: NativeCollectorConnector): Promise<NativeCollectorResult> {
  const token = getString(connector.config, ['apiToken', 'token']);
  const baseUrl = (connector.baseUrl || getString(connector.config, ['baseUrl', 'orgUrl']) || '').replace(/\/$/, '');
  if (!token || !baseUrl) {
    throw new Error('Okta collector requires apiToken/token and baseUrl/orgUrl.');
  }
  const request = async (pathname: string) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `SSWS ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Okta API request failed (${response.status}) for ${pathname}.`);
    }
    return response.json();
  };

  const [roles, orgFactors] = await Promise.all([
    request('/api/v1/roles'),
    request('/api/v1/org/factors'),
  ]);
  const roleItems = asArray<Record<string, unknown>>(roles);
  const factorItems = asArray<Record<string, unknown>>(orgFactors);
  const privilegedRoleCount = roleItems.length;
  const phishingResistantFactor = factorItems.some((factor) => {
    const factorType = normalizeToken(String(factor.factorType ?? ''));
    const provider = normalizeToken(String(factor.provider ?? ''));
    const status = normalizeToken(String(factor.status ?? ''));
    return status === 'active' && (factorType === 'webauthn' || provider === 'okta-fastpass');
  });
  const now = nowIso();
  const orgLabel = new URL(baseUrl).hostname;

  return {
    mode: 'live',
    sourceVersion: liveCollectorSourceVersion('okta'),
    upstreamRunId: crypto.randomUUID(),
    findings: [
      buildOktaFinding(
        now,
        orgLabel,
        'Privileged MFA readiness',
        phishingResistantFactor ? 'pass' : 'fail',
        phishingResistantFactor ? 'low' : 'critical',
        phishingResistantFactor
          ? 'Okta org factors include an active phishing-resistant authenticator.'
          : 'No active phishing-resistant authenticator was confirmed for privileged Okta access.',
        [`okta://${orgLabel}/org-factors`],
        'IAC-06',
        'admin-mfa',
      ),
      buildOktaFinding(
        now,
        orgLabel,
        'Privileged role inventory',
        privilegedRoleCount > 0 ? 'pass' : 'inconclusive',
        privilegedRoleCount > 0 ? 'low' : 'medium',
        privilegedRoleCount > 0
          ? `Okta returned ${privilegedRoleCount} privileged role assignments.`
          : 'Okta returned no privileged roles for the configured tenant scope.',
        [`okta://${orgLabel}/roles`],
        'IAC-03',
        'role-assignments',
      ),
    ],
    diagnostics: {
      privilegedRoleCount,
      phishingResistantFactor,
      orgUrl: baseUrl,
    },
  };
}

async function collectAwsFindings(connector: NativeCollectorConnector): Promise<NativeCollectorResult> {
  const accessKeyId = getString(connector.config, ['accessKeyId']);
  const secretAccessKey = getString(connector.config, ['secretAccessKey']);
  const sessionToken = getString(connector.config, ['sessionToken']);
  const region = getString(connector.config, ['region']) || 'us-east-1';
  const bucket = getString(connector.config, ['bucket', 'bucketName', 'logBucket']);
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS collector requires accessKeyId, secretAccessKey, region, and bucket/logBucket.');
  }
  const accountId = getString(connector.config, ['accountId']);
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken || undefined,
    region,
    service: 's3',
  });

  const getXml = async (url: string, service: string, init: RequestInit = {}) => {
    const response = await client.fetch(url, {
      ...init,
      aws: { service, region },
    });
    if (!response.ok) {
      throw new Error(`AWS request failed (${response.status}) for ${url}.`);
    }
    return xmlParser.parse(await response.text());
  };

  let encryptionEnabled = false;
  try {
    const encryptionBody = await getXml(`https://${bucket}.s3.${region}.amazonaws.com/?encryption`, 's3');
    encryptionEnabled = Boolean(asRecord(asRecord(asRecord(encryptionBody).ServerSideEncryptionConfiguration)).Rule);
  } catch {
    encryptionEnabled = false;
  }

  let publicAccessBlocked = false;
  try {
    const publicBody = await getXml(`https://${bucket}.s3.${region}.amazonaws.com/?publicAccessBlock`, 's3');
    const config = asRecord(asRecord(publicBody).PublicAccessBlockConfiguration);
    publicAccessBlocked = Boolean(
      config.BlockPublicAcls && config.IgnorePublicAcls && config.BlockPublicPolicy && config.RestrictPublicBuckets,
    );
  } catch {
    publicAccessBlocked = false;
  }

  const cloudTrailClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken || undefined,
    region,
    service: 'cloudtrail',
  });
  const cloudTrailResponse = await cloudTrailClient.fetch(`https://cloudtrail.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: 'Action=DescribeTrails&Version=2013-11-01',
    aws: { service: 'cloudtrail', region },
  });
  if (!cloudTrailResponse.ok) {
    throw new Error(`AWS CloudTrail request failed (${cloudTrailResponse.status}).`);
  }
  const cloudTrailBody = xmlParser.parse(await cloudTrailResponse.text());
  const cloudTrailResponseRecord = asRecord(cloudTrailBody);
  const describeTrailsResponse = asRecord(cloudTrailResponseRecord.DescribeTrailsResponse);
  const describeTrailsResult = asRecord(describeTrailsResponse.DescribeTrailsResult);
  const trailList = asRecord(describeTrailsResult.trailList);
  const trails = asArray<Record<string, unknown>>(
    trailList.member,
  );
  const cloudTrailPresent = trails.length > 0;

  const iamClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken || undefined,
    region: 'us-east-1',
    service: 'iam',
  });
  const iamResponse = await iamClient.fetch('https://iam.amazonaws.com/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: 'Action=GetAccountSummary&Version=2010-05-08',
    aws: { service: 'iam', region: 'us-east-1' },
  });
  if (!iamResponse.ok) {
    throw new Error(`AWS IAM request failed (${iamResponse.status}).`);
  }
  const iamBody = xmlParser.parse(await iamResponse.text());
  const summaryEntries = asArray<Record<string, unknown>>(
    asRecord(
      asRecord(asRecord(asRecord(iamBody).GetAccountSummaryResponse)?.GetAccountSummaryResult)?.SummaryMap,
    ).entry,
  );
  const summaryMap = new Map(
    summaryEntries.map((entry) => [String(entry.key ?? ''), Number(entry.value ?? 0)]),
  );
  const rootMfaEnabled = summaryMap.get('AccountMFAEnabled') === 1;
  const now = nowIso();

  return {
    mode: 'live',
    sourceVersion: liveCollectorSourceVersion('aws'),
    upstreamRunId: crypto.randomUUID(),
    findings: [
      buildAwsFinding(
        now,
        bucket,
        region,
        accountId,
        'Bucket encryption at rest',
        encryptionEnabled ? 'pass' : 'fail',
        encryptionEnabled ? 'low' : 'high',
        encryptionEnabled
          ? `Bucket ${bucket} enforces server-side encryption at rest.`
          : `Bucket ${bucket} does not expose a server-side encryption configuration.`,
        [`aws://s3/${bucket}/encryption`],
        'CRY-05',
        's3-encryption',
      ),
      buildAwsFinding(
        now,
        bucket,
        region,
        accountId,
        'Public access block posture',
        publicAccessBlocked ? 'pass' : 'fail',
        publicAccessBlocked ? 'low' : 'high',
        publicAccessBlocked
          ? `Bucket ${bucket} blocks public ACLs and public bucket policies.`
          : `Bucket ${bucket} does not fully block public ACLs or policies.`,
        [`aws://s3/${bucket}/public-access-block`],
        'AST-04',
        's3-public-access',
      ),
      buildAwsFinding(
        now,
        bucket,
        region,
        accountId,
        'CloudTrail coverage',
        cloudTrailPresent ? 'pass' : 'fail',
        cloudTrailPresent ? 'low' : 'high',
        cloudTrailPresent
          ? `CloudTrail is configured in ${region} for the configured account scope.`
          : `CloudTrail trails were not returned for the configured account scope in ${region}.`,
        [`aws://cloudtrail/${region}/trails`],
        'LOG-01',
        'cloudtrail',
      ),
      buildAwsFinding(
        now,
        bucket,
        region,
        accountId,
        'Root MFA posture',
        rootMfaEnabled ? 'pass' : 'fail',
        rootMfaEnabled ? 'low' : 'critical',
        rootMfaEnabled
          ? 'AWS account summary reports MFA enabled for the root account.'
          : 'AWS account summary reports MFA is not enabled for the root account.',
        ['aws://iam/account-summary'],
        'IAC-06',
        'root-mfa',
      ),
    ],
    diagnostics: {
      bucket,
      region,
      encryptionEnabled,
      publicAccessBlocked,
      cloudTrailPresent,
      rootMfaEnabled,
    },
  };
}

export async function collectNativeFindings(
  env: EnvBindings,
  source: NativeCollectorSource,
  connector: NativeCollectorConnector | null,
): Promise<NativeCollectorResult> {
  if (!connector || !hasLiveCollectorConfiguration(source, connector)) {
    if (!canUseFixtureCollectors(env)) {
      throw new Error(
        `${connectorLabel(source)} native collection requires a valid live connector configuration in production.`,
      );
    }
    return {
      mode: 'fixture',
      sourceVersion: fixtureCollectorSourceVersion(source),
      upstreamRunId: crypto.randomUUID(),
      findings: buildNativeCollectorFixtures(source),
      diagnostics: {
        fixture: true,
        reason: 'Live connector credentials were not available; local validation used fixture findings.',
      },
    };
  }

  switch (source) {
    case 'github':
      return collectGithubFindings(connector);
    case 'wiz':
      return collectWizFindings(connector);
    case 'aws':
      return collectAwsFindings(connector);
    case 'okta':
      return collectOktaFindings(connector);
  }
}

import { AwsClient } from 'aws4fetch';
import { XMLParser } from 'fast-xml-parser';

import type { BundleKind, EvidenceInputMode } from './types';

type AwsCollectionArgs = {
  provider: string;
  sourceName: string;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  sourceConfig: Record<string, unknown>;
  adapterHints: Record<string, unknown>;
};

type AwsCallFailure = {
  call: string;
  errorCode: string;
  message: string;
};

type AwsCollectionManifest = {
  collectedAt: string;
  accountId: string;
  accountLabel: string | null;
  regions: string[];
  successfulCalls: string[];
  failedCalls: AwsCallFailure[];
};

type AwsRuntimeConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
  region: string;
  regions: string[];
  allEnabledRegions: boolean;
  accountLabel: string | null;
  owner: string | null;
};

type AwsServiceError = Error & {
  code: string;
  status: number;
};

type GuardDutyFinding = {
  Id?: string;
  Severity?: number;
  Type?: string;
  Title?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Service?: Record<string, unknown>;
  Resource?: Record<string, unknown>;
};

const XML = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

const PUBLIC_CIDRS = new Set(['0.0.0.0/0', '::/0']);
const ADMIN_PORTS = new Set([22, 3389, 8443]);
const DATABASE_PORTS = new Set([1433, 1521, 27017, 3306, 5432, 6379]);

function nowIso(): string {
  return new Date().toISOString();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value as T];
}

function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'enabled', 'active', 'open'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'disabled', 'closed'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const suffix = parts
    .map((part) => normalizeString(part))
    .filter((part) => part.length > 0)
    .join(':')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return suffix.length > 0 ? `${prefix}:${suffix}` : `${prefix}:${crypto.randomUUID()}`;
}

function mergeRecords(...values: unknown[]): Record<string, unknown> {
  return values.reduce<Record<string, unknown>>((accumulator, value) => {
    const record = toRecord(value);
    if (Object.keys(record).length === 0) {
      return accumulator;
    }
    return {
      ...accumulator,
      ...record,
    };
  }, {});
}

function parseXml(text: string): Record<string, unknown> {
  const parsed = XML.parse(text);
  return toRecord(parsed);
}

function unwrapPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    current = toRecord(current)[key];
  }
  return current;
}

function firstItem<T>(value: unknown): T | null {
  const items = toArray<T>(value);
  return items[0] ?? null;
}

function derivePartition(region: string): 'aws' | 'aws-us-gov' {
  return region.startsWith('us-gov-') ? 'aws-us-gov' : 'aws';
}

function deriveRuntimeConfig(sourceConfig: Record<string, unknown>, adapterHints: Record<string, unknown>): AwsRuntimeConfig | null {
  const merged = mergeRecords(
    sourceConfig,
    sourceConfig.aws,
    sourceConfig.liveCollection,
    sourceConfig.liveInput,
    sourceConfig.credentials,
    sourceConfig.auth,
    adapterHints,
    adapterHints.aws,
    adapterHints.liveCollection,
    adapterHints.liveInput,
    adapterHints.credentials,
    adapterHints.auth,
  );
  const auth = mergeRecords(
    merged.auth,
    merged.credentials,
    merged.awsAuth,
  );
  const accessKeyId = normalizeString(
    auth.accessKeyId ?? auth.access_key_id ?? auth.aws_access_key_id ?? merged.accessKeyId ?? merged.access_key_id,
  );
  const secretAccessKey = normalizeString(
    auth.secretAccessKey ??
      auth.secret_access_key ??
      auth.aws_secret_access_key ??
      merged.secretAccessKey ??
      merged.secret_access_key,
  );
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  const region = normalizeString(
    merged.region ?? merged.awsRegion ?? merged.aws_region,
    'us-gov-west-1',
  );
  const explicitRegions = normalizeStringArray(merged.regions ?? merged.awsRegions ?? merged.aws_regions);
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken:
      normalizeNullableString(
        auth.sessionToken ??
          auth.session_token ??
          auth.aws_session_token ??
          merged.sessionToken ??
          merged.session_token,
      ) ?? null,
    region,
    regions: explicitRegions.length > 0 ? explicitRegions : [region],
    allEnabledRegions: normalizeBoolean(merged.allEnabledRegions ?? merged.all_enabled_regions, false),
    accountLabel: normalizeNullableString(merged.accountLabel ?? merged.account_label),
    owner: normalizeNullableString(merged.owner),
  };
}

function buildAwsClient(config: AwsRuntimeConfig): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken ?? undefined,
    retries: 2,
    initRetryMs: 125,
  });
}

function endpointFor(service: string, region: string): { host: string; service: string; region: string } {
  const partition = derivePartition(region);
  if (service === 'iam') {
    return partition === 'aws-us-gov'
      ? { host: 'iam.us-gov.amazonaws.com', service: 'iam', region }
      : { host: 'iam.amazonaws.com', service: 'iam', region: 'us-east-1' };
  }
  if (service === 's3') {
    return { host: `s3.${region}.amazonaws.com`, service: 's3', region };
  }
  if (service === 'cloudwatch') {
    return { host: `monitoring.${region}.amazonaws.com`, service: 'monitoring', region };
  }
  if (service === 'elbv2') {
    return { host: `elasticloadbalancing.${region}.amazonaws.com`, service: 'elasticloadbalancing', region };
  }
  if (service === 'config') {
    return { host: `config.${region}.amazonaws.com`, service: 'config', region };
  }
  return { host: `${service}.${region}.amazonaws.com`, service, region };
}

async function responsePayload(response: Response): Promise<string> {
  return response.text();
}

function buildServiceError(payload: string, status: number, fallbackCode: string): AwsServiceError {
  let code = fallbackCode;
  let message = payload || fallbackCode;
  try {
    const json = JSON.parse(payload) as Record<string, unknown>;
    code = normalizeString(json.__type ?? json.code ?? json.Code, code).split('#').pop() ?? code;
    message = normalizeString(json.message ?? json.Message, message);
  } catch {
    const xml = parseXml(payload);
    const error = toRecord(unwrapPath(xml, ['ErrorResponse', 'Error'])) || toRecord(unwrapPath(xml, ['Error']));
    code = normalizeString(error.Code, code);
    message = normalizeString(error.Message, message);
  }
  const error = new Error(message) as AwsServiceError;
  error.code = code;
  error.status = status;
  return error;
}

async function callAwsQueryXml(args: {
  aws: AwsClient;
  region: string;
  service: string;
  action: string;
  version: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}): Promise<Record<string, unknown>> {
  const endpoint = endpointFor(args.service, args.region);
  const body = new URLSearchParams({
    Action: args.action,
    Version: args.version,
  });
  for (const [key, value] of Object.entries(args.params ?? {})) {
    if (value === null || value === undefined) {
      continue;
    }
    body.set(key, String(value));
  }
  const response = await args.aws.fetch(`https://${endpoint.host}/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: body.toString(),
    aws: {
      service: endpoint.service,
      region: endpoint.region,
    },
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw buildServiceError(payload, response.status, `${args.service}.${args.action}`);
  }
  return parseXml(payload);
}

async function callAwsJson(args: {
  aws: AwsClient;
  region: string;
  service: string;
  target: string;
  body: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const endpoint = endpointFor(args.service, args.region);
  const response = await args.aws.fetch(`https://${endpoint.host}/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': args.target,
    },
    body: JSON.stringify(args.body),
    aws: {
      service: endpoint.service,
      region: endpoint.region,
    },
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw buildServiceError(payload, response.status, args.target);
  }
  return payload ? (JSON.parse(payload) as Record<string, unknown>) : {};
}

async function callAwsS3(args: {
  aws: AwsClient;
  region: string;
  method: 'GET';
  path?: string;
  bucket?: string;
  query?: string;
}): Promise<Record<string, unknown>> {
  const endpoint = endpointFor('s3', args.region);
  const path = args.path ?? '/';
  const host = args.bucket ? `${args.bucket}.${endpoint.host}` : endpoint.host;
  const query = args.query ? `?${args.query}` : '';
  const response = await args.aws.fetch(`https://${host}${path}${query}`, {
    method: args.method,
    aws: {
      service: endpoint.service,
      region: endpoint.region,
    },
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw buildServiceError(payload, response.status, `s3${path}`);
  }
  return payload ? parseXml(payload) : {};
}

async function safeCall<T>(
  manifest: AwsCollectionManifest,
  callId: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    const value = await fn();
    manifest.successfulCalls.push(callId);
    return value;
  } catch (error) {
    const typed = error as Partial<AwsServiceError>;
    manifest.failedCalls.push({
      call: callId,
      errorCode: normalizeString(typed.code, error instanceof Error ? error.name : 'AwsError'),
      message: error instanceof Error ? error.message : 'Unknown AWS request failure',
    });
    return null;
  }
}

function extractTagMap(raw: unknown): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const item of toArray<Record<string, unknown>>(raw)) {
    const record = toRecord(item);
    const key = normalizeString(record.key ?? record.Key);
    const value = normalizeString(record.value ?? record.Value);
    if (key) {
      tags[key] = value;
    }
  }
  return tags;
}

function eventSemanticType(eventName: string, title: string): string {
  const combined = `${eventName} ${title}`.toLowerCase();
  if (combined.includes('createuser') || combined.includes('user created')) {
    return 'identity.user_created';
  }
  if (combined.includes('attachrolepolicy') || combined.includes('putrolepolicy') || combined.includes('permission')) {
    return 'identity.permission_changed';
  }
  if (combined.includes('stoplogging') || combined.includes('deletetrail')) {
    return 'logging.audit_disabled';
  }
  if (combined.includes('securitygroup') || combined.includes('authorize') || combined.includes('firewall')) {
    return 'network.firewall_rule_changed';
  }
  if (combined.includes('public') && (combined.includes('ssh') || combined.includes('3389') || combined.includes('admin'))) {
    return 'network.public_admin_service_opened';
  }
  if (combined.includes('public') && (combined.includes('5432') || combined.includes('3306') || combined.includes('database'))) {
    return 'network.public_database_service_opened';
  }
  if (combined.includes('guardduty') || combined.includes('recon:') || combined.includes('trojan:')) {
    return 'guardduty.threat_detected';
  }
  return 'generic.event';
}

function buildPermissionCoverage(manifest: AwsCollectionManifest): Record<string, unknown> {
  const denied = manifest.failedCalls.filter((failure) =>
    failure.errorCode.toLowerCase().includes('denied') || failure.errorCode.toLowerCase().includes('unauthorized'),
  );
  return {
    successfulCallCount: manifest.successfulCalls.length,
    failedCallCount: manifest.failedCalls.length,
    accessDeniedCallCount: denied.length,
    assessmentConfidence: manifest.failedCalls.length > 0 ? 'partial' : 'complete',
    failures: manifest.failedCalls,
  };
}

function mapSecurityGroupExposures(rows: Array<Record<string, unknown>>) {
  const assets: Array<Record<string, unknown>> = [];
  const cloudEvents: Array<Record<string, unknown>> = [];
  const scannerFindings: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const groupId = normalizeString(row.groupId ?? row.GroupId ?? row.id, 'sg');
    const permissions = toArray<Record<string, unknown>>(row.ipPermissions ?? row.IpPermissions);
    for (const permission of permissions) {
      const protocol = normalizeString(permission.ipProtocol ?? permission.IpProtocol, 'tcp');
      const fromPort = Number(permission.fromPort ?? permission.FromPort ?? permission.port ?? 0);
      const toPort = Number(permission.toPort ?? permission.ToPort ?? fromPort);
      const ipRanges = [
        ...toArray<Record<string, unknown>>(permission.ipRanges ?? permission.IpRanges),
        ...toArray<Record<string, unknown>>(permission.ipv6Ranges ?? permission.Ipv6Ranges),
      ];
      for (const range of ipRanges) {
        const cidr =
          normalizeString(range.cidrIp ?? range.CidrIp) || normalizeString(range.cidrIpv6 ?? range.CidrIpv6);
        if (!PUBLIC_CIDRS.has(cidr)) {
          continue;
        }
        const ports = toPort >= fromPort
          ? Array.from({ length: Math.min(toPort - fromPort + 1, 10) }, (_, index) => fromPort + index)
          : [fromPort];
        for (const port of ports) {
          const semanticType = ADMIN_PORTS.has(port)
            ? 'network.public_admin_service_opened'
            : DATABASE_PORTS.has(port)
              ? 'network.public_database_service_opened'
              : 'network.public_service_opened';
          const assetId = stableId('sg-exposure', [groupId, String(port)]);
          assets.push({
            assetId,
            name: `Security group ${groupId} exposure on port ${port}`,
            assetType: 'security-group-exposure',
            environment: 'production',
            owner: null,
            region: normalizeNullableString(row.region),
            accountId: normalizeNullableString(row.accountId),
            inBoundary: true,
            isPublic: true,
            privateIps: [],
            publicIps: [cidr],
            metadata: { groupId, port, protocol },
          });
          cloudEvents.push({
            eventId: stableId('sg-event', [groupId, String(port), cidr]),
            assetId,
            semanticType,
            severity: ADMIN_PORTS.has(port) ? 'critical' : 'high',
            status: 'open',
            centralEventRef: null,
            localEventRef: stableId('sg-local', [groupId, String(port)]),
            title: `Public exposure detected on ${groupId}:${port}`,
            metadata: { cidr, groupId, port, protocol },
          });
          scannerFindings.push({
            findingId: stableId('sg-finding', [groupId, String(port), cidr]),
            assetId,
            severity: ADMIN_PORTS.has(port) ? 'critical' : 'high',
            status: 'open',
            title: `Security group ${groupId} exposes port ${port} publicly`,
            cveIds: [],
            linkedTicketIds: [],
            exploitationReview: {},
            metadata: { cidr, groupId, port, protocol },
          });
        }
      }
    }
  }

  return { assets, cloudEvents, scannerFindings };
}

function unwrapCollection(document: Record<string, unknown>, path: string[]) {
  const node = unwrapPath(document, path);
  if (Array.isArray(node)) {
    return node.map((item) => toRecord(item));
  }
  const record = toRecord(node);
  for (const key of ['item', 'member', 'DBInstance', 'Bucket', 'MetricAlarm', 'LoadBalancer']) {
    const value = record[key];
    if (value !== undefined) {
      return toArray<Record<string, unknown>>(value).map((item) => toRecord(item));
    }
  }
  return Object.keys(record).length > 0 ? [record] : [];
}

function mapEc2Instances(document: Record<string, unknown>, region: string, owner: string | null) {
  const discoveredAssets: Array<Record<string, unknown>> = [];
  const securityGroups: Array<Record<string, unknown>> = [];

  const reservations = unwrapCollection(document, ['DescribeInstancesResponse', 'reservationSet']);
  for (const reservation of reservations) {
    const instances = toArray<Record<string, unknown>>(toRecord(reservation).instancesSet ? toRecord(toRecord(reservation).instancesSet).item : []);
    for (const instance of instances) {
      const tags = extractTagMap(toRecord(instance.tagSet).item);
      const privateIps = normalizeStringArray(
        [
          normalizeNullableString(instance.privateIpAddress),
          ...toArray<Record<string, unknown>>(toRecord(instance.networkInterfaceSet).item).map((record) =>
            normalizeString(record.privateIpAddress),
          ),
        ].filter(Boolean),
      );
      const publicIp = normalizeNullableString(instance.ipAddress ?? instance.publicIpAddress);
      const securityGroupIds = toArray<Record<string, unknown>>(toRecord(instance.groupSet).item)
        .map((group) => normalizeString(group.groupId))
        .filter((groupId) => groupId.length > 0);

      discoveredAssets.push({
        assetId: tags.AssetId ?? tags.asset_id ?? tags.Name ?? normalizeString(instance.instanceId),
        name: tags.Name ?? normalizeString(instance.instanceId, 'EC2 instance'),
        assetType: 'ec2-instance',
        environment: tags.Environment ?? 'production',
        owner: tags.Owner ?? tags.owner ?? owner,
        region,
        accountId: null,
        inBoundary: true,
        isPublic: !!publicIp,
        privateIps,
        publicIps: publicIp ? [publicIp] : [],
        metadata: {
          instanceId: normalizeNullableString(instance.instanceId),
          state: normalizeNullableString(toRecord(instance.instanceState).name),
          vpcId: normalizeNullableString(instance.vpcId),
          securityGroups: securityGroupIds,
          tags,
        },
      });

      for (const groupId of securityGroupIds) {
        securityGroups.push({
          groupId,
          region,
        });
      }
    }
  }

  return { discoveredAssets, securityGroups };
}

function mapSecurityGroups(document: Record<string, unknown>, region: string) {
  return unwrapCollection(document, ['DescribeSecurityGroupsResponse', 'DescribeSecurityGroupsResult', 'securityGroupInfo']).map((row) => {
    const group = toRecord(row);
    return {
      groupId: normalizeString(group.groupId ?? group.groupName, 'sg'),
      region,
      ipPermissions: toArray<Record<string, unknown>>(toRecord(group.ipPermissions).item).map((permission) => ({
        ipProtocol: normalizeString(permission.ipProtocol),
        fromPort: normalizeString(permission.fromPort),
        toPort: normalizeString(permission.toPort),
        ipRanges: toArray<Record<string, unknown>>(toRecord(permission.ipRanges).item).map((range) => ({
          cidrIp: normalizeString(range.cidrIp),
        })),
        ipv6Ranges: toArray<Record<string, unknown>>(toRecord(permission.ipv6Ranges).item).map((range) => ({
          cidrIpv6: normalizeString(range.cidrIpv6),
        })),
      })),
    };
  });
}

function mapFlowLogs(document: Record<string, unknown>, region: string) {
  return unwrapCollection(document, ['DescribeFlowLogsResponse', 'DescribeFlowLogsResult', 'flowLogSet']).map((row) => {
    const record = toRecord(row);
    return {
      sourceId: normalizeString(record.flowLogId, stableId('flow-log', [region, normalizeString(record.resourceId)])),
      assetId: normalizeNullableString(record.resourceId),
      sourceType: 'network_flow',
      localSource: `Flow log ${normalizeString(record.flowLogId)}`,
      centralDestination: normalizeNullableString(record.logDestinationType) ?? 'unknown',
      status: normalizeString(record.flowLogStatus, 'active').toLowerCase(),
      sampleLocalEventRef: null,
      sampleCentralEventRef: null,
      lastSeen: nowIso(),
      metadata: {
        trafficType: normalizeNullableString(record.trafficType),
        region,
      },
    };
  });
}

function mapRdsInstances(document: Record<string, unknown>, region: string, owner: string | null) {
  return unwrapCollection(document, ['DescribeDBInstancesResponse', 'DescribeDBInstancesResult', 'DBInstances']).map((row) => {
    const record = toRecord(row);
    const endpoint = toRecord(record.Endpoint);
    return {
      assetId: normalizeString(record.DBInstanceIdentifier, stableId('rds', [region, normalizeString(record.DBInstanceArn)])),
      name: normalizeString(record.DBInstanceIdentifier, 'RDS instance'),
      assetType: 'rds-instance',
      environment: 'production',
      owner,
      region,
      accountId: null,
      inBoundary: true,
      isPublic: normalizeBoolean(record.PubliclyAccessible, false),
      privateIps: normalizeNullableString(endpoint.Address) ? [normalizeString(endpoint.Address)] : [],
      publicIps: [],
      metadata: {
        dbInstanceArn: normalizeNullableString(record.DBInstanceArn),
        engine: normalizeNullableString(record.Engine),
        storageEncrypted: normalizeBoolean(record.StorageEncrypted, false),
      },
    };
  });
}

function mapElbLoadBalancers(document: Record<string, unknown>, region: string, owner: string | null) {
  return unwrapCollection(document, ['DescribeLoadBalancersResponse', 'DescribeLoadBalancersResult', 'LoadBalancers']).map((row) => {
    const record = toRecord(row);
    const dnsName = normalizeNullableString(record.DNSName);
    const scheme = normalizeString(record.Scheme).toLowerCase();
    return {
      assetId: normalizeString(record.LoadBalancerArn ?? record.LoadBalancerName, stableId('elb', [region, dnsName])),
      name: normalizeString(record.LoadBalancerName, 'Load balancer'),
      assetType: 'load-balancer',
      environment: 'production',
      owner,
      region,
      accountId: null,
      inBoundary: true,
      isPublic: scheme === 'internet-facing',
      privateIps: [],
      publicIps: dnsName ? [dnsName] : [],
      metadata: {
        loadBalancerArn: normalizeNullableString(record.LoadBalancerArn),
        scheme,
        type: normalizeNullableString(record.Type),
      },
    };
  });
}

function mapCloudWatchAlarms(document: Record<string, unknown>) {
  return unwrapCollection(document, ['DescribeAlarmsResponse', 'DescribeAlarmsResult', 'MetricAlarms']).map((row, index) => {
    const record = toRecord(row);
    return {
      ruleId: normalizeString(record.AlarmArn ?? record.AlarmName, `cw-alarm-${index + 1}`),
      name: normalizeString(record.AlarmName, `CloudWatch alarm ${index + 1}`),
      enabled: ['OK', 'ALARM', 'INSUFFICIENT_DATA'].includes(normalizeString(record.StateValue).toUpperCase()),
      semanticTypes: [],
      recipients: [],
      lastFired: normalizeNullableString(record.StateUpdatedTimestamp),
      metadata: {
        metricName: normalizeNullableString(record.MetricName),
        namespace: normalizeNullableString(record.Namespace),
        stateValue: normalizeNullableString(record.StateValue),
      },
    };
  });
}

function mapCloudTrailLookupEvents(document: Record<string, unknown>, region: string, accountId: string) {
  return toArray<Record<string, unknown>>(document.Events).map((row, index) => {
    const cloudTrailEventText = normalizeString(row.CloudTrailEvent);
    let cloudTrailEvent: Record<string, unknown> = {};
    if (cloudTrailEventText) {
      try {
        cloudTrailEvent = toRecord(JSON.parse(cloudTrailEventText));
      } catch {
        cloudTrailEvent = {};
      }
    }
    const resource = firstItem<Record<string, unknown>>(row.Resources);
    const eventName = normalizeString(row.EventName);
    const title = normalizeString(row.Username, eventName || `CloudTrail event ${index + 1}`);
    const assetId =
      normalizeNullableString(resource?.ResourceName) ??
      normalizeNullableString(cloudTrailEvent.requestParameters && toRecord(cloudTrailEvent.requestParameters).instanceId) ??
      null;
    return {
      eventId: normalizeString(row.EventId, stableId('cloudtrail', [region, String(index + 1)])),
      assetId,
      semanticType: eventSemanticType(eventName, title),
      severity: eventName.toLowerCase().includes('stoplogging') ? 'critical' : 'moderate',
      status: 'open',
      centralEventRef: normalizeNullableString(row.EventId),
      localEventRef: normalizeNullableString(row.EventId),
      title: eventName || `CloudTrail event ${index + 1}`,
      metadata: {
        accountId,
        eventSource: normalizeNullableString(row.EventSource),
        eventTime: normalizeNullableString(row.EventTime),
        username: normalizeNullableString(row.Username),
        region,
      },
    };
  });
}

function mapGuardDutyFindings(findings: GuardDutyFinding[], region: string, accountId: string) {
  const cloudEvents: Array<Record<string, unknown>> = [];
  const scannerFindings: Array<Record<string, unknown>> = [];
  for (const finding of findings) {
    const resource = toRecord(finding.Resource);
    const resourceDetails = toRecord(resource.InstanceDetails);
    const assetId =
      normalizeNullableString(resource.InstanceId) ??
      normalizeNullableString(resourceDetails.InstanceId) ??
      'org-wide-aws';
    const severityValue = Number(finding.Severity ?? 0);
    const severity = severityValue >= 8 ? 'critical' : severityValue >= 5 ? 'high' : 'moderate';
    const title = normalizeString(finding.Title ?? finding.Type, 'GuardDuty finding');
    const eventId = normalizeString(finding.Id, stableId('guardduty', [region, title]));
    cloudEvents.push({
      eventId,
      assetId,
      semanticType: 'guardduty.threat_detected',
      severity,
      status: 'open',
      centralEventRef: eventId,
      localEventRef: eventId,
      title,
      metadata: {
        accountId,
        region,
        findingType: normalizeNullableString(finding.Type),
        createdAt: normalizeNullableString(finding.CreatedAt),
      },
    });
    scannerFindings.push({
      findingId: `gd:${eventId}`,
      assetId,
      severity,
      status: 'open',
      title,
      cveIds: [],
      linkedTicketIds: [],
      exploitationReview: {},
      metadata: {
        accountId,
        region,
        findingType: normalizeNullableString(finding.Type),
        rawId: normalizeNullableString(finding.Id),
      },
    });
  }
  return { cloudEvents, scannerFindings };
}

function mirrorDeclaredInventory(discoveredAssets: Array<Record<string, unknown>>) {
  return discoveredAssets
    .filter((asset) => normalizeString(asset.assetType) !== 'security-group-exposure')
    .map((asset) => ({
      assetId: normalizeString(asset.assetId),
      name: normalizeString(asset.name),
      assetType: normalizeString(asset.assetType, 'service'),
      environment: normalizeString(asset.environment, 'production'),
      owner: normalizeNullableString(asset.owner),
      region: normalizeNullableString(asset.region),
      accountId: normalizeNullableString(asset.accountId),
      inBoundary: normalizeBoolean(asset.inBoundary, true),
      scannerRequired: true,
      logRequired: true,
      isPublic: normalizeBoolean(asset.isPublic, false),
      expectedPrivateIp: normalizeNullableString(firstItem<string>(asset.privateIps)),
      expectedPublicIp: normalizeNullableString(firstItem<string>(asset.publicIps)),
      metadata: toRecord(asset.metadata),
    }));
}

async function collectRegions(args: {
  aws: AwsClient;
  config: AwsRuntimeConfig;
  manifest: AwsCollectionManifest;
}): Promise<string[]> {
  if (args.config.allEnabledRegions) {
    const document = await safeCall(args.manifest, 'ec2:DescribeRegions', () =>
      callAwsQueryXml({
        aws: args.aws,
        region: args.config.region,
        service: 'ec2',
        action: 'DescribeRegions',
        version: '2016-11-15',
      }),
    );
    if (document) {
      const regions = unwrapCollection(document, ['DescribeRegionsResponse', 'DescribeRegionsResult', 'regionInfo'])
        .map((row) => normalizeString(toRecord(row).regionName))
        .filter((region) => region.length > 0);
      if (regions.length > 0) {
        return regions;
      }
    }
  }
  return args.config.regions;
}

export async function collectAwsLiveBundle(args: AwsCollectionArgs): Promise<Record<string, unknown> | null> {
  if (args.provider !== 'aws' || args.inputMode !== 'live') {
    return null;
  }

  const config = deriveRuntimeConfig(args.sourceConfig, args.adapterHints);
  if (!config) {
    return null;
  }

  const aws = buildAwsClient(config);
  const manifest: AwsCollectionManifest = {
    collectedAt: nowIso(),
    accountId: 'unknown',
    accountLabel: config.accountLabel,
    regions: [],
    successfulCalls: [],
    failedCalls: [],
  };

  const stsIdentity = await safeCall(manifest, 'sts:GetCallerIdentity', () =>
    callAwsQueryXml({
      aws,
      region: config.region,
      service: 'sts',
      action: 'GetCallerIdentity',
      version: '2011-06-15',
    }),
  );
  if (stsIdentity) {
    manifest.accountId =
      normalizeString(unwrapPath(stsIdentity, ['GetCallerIdentityResponse', 'GetCallerIdentityResult', 'Account'])) ||
      manifest.accountId;
  }

  const regions = await collectRegions({ aws, config, manifest });
  manifest.regions = regions;

  const discoveredAssets: Array<Record<string, unknown>> = [];
  const cloudEvents: Array<Record<string, unknown>> = [];
  const scannerFindings: Array<Record<string, unknown>> = [];
  const centralLogSources: Array<Record<string, unknown>> = [];
  const alertRules: Array<Record<string, unknown>> = [];
  const rawRegions: Array<Record<string, unknown>> = [];

  const s3Buckets = await safeCall(manifest, 's3:ListBuckets', () =>
    callAwsS3({
      aws,
      region: config.region,
      method: 'GET',
      path: '/',
    }),
  );
  const bucketAssets = toArray<Record<string, unknown>>(
    unwrapPath(s3Buckets ?? {}, ['ListAllMyBucketsResult', 'Buckets', 'Bucket']),
  ).map((bucket) => ({
    assetId: normalizeString(bucket.Name),
    name: normalizeString(bucket.Name, 'S3 bucket'),
    assetType: 's3-bucket',
    environment: 'production',
    owner: config.owner,
    region: config.region,
    accountId: manifest.accountId,
    inBoundary: true,
    isPublic: false,
    privateIps: [],
    publicIps: [],
    metadata: {
      creationDate: normalizeNullableString(bucket.CreationDate),
    },
  }));
  discoveredAssets.push(...bucketAssets);

  for (const region of regions) {
    const regionRecord: Record<string, unknown> = { region };

    const instancesDoc = await safeCall(manifest, `ec2:DescribeInstances:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'ec2',
        action: 'DescribeInstances',
        version: '2016-11-15',
      }),
    );
    if (instancesDoc) {
      regionRecord.describeInstances = instancesDoc;
      discoveredAssets.push(...mapEc2Instances(instancesDoc, region, config.owner).discoveredAssets);
    }

    const securityGroupsDoc = await safeCall(manifest, `ec2:DescribeSecurityGroups:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'ec2',
        action: 'DescribeSecurityGroups',
        version: '2016-11-15',
      }),
    );
    if (securityGroupsDoc) {
      regionRecord.describeSecurityGroups = securityGroupsDoc;
      const exposures = mapSecurityGroupExposures(mapSecurityGroups(securityGroupsDoc, region));
      discoveredAssets.push(...exposures.assets);
      cloudEvents.push(...exposures.cloudEvents);
      scannerFindings.push(...exposures.scannerFindings);
    }

    const flowLogsDoc = await safeCall(manifest, `ec2:DescribeFlowLogs:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'ec2',
        action: 'DescribeFlowLogs',
        version: '2016-11-15',
      }),
    );
    if (flowLogsDoc) {
      regionRecord.describeFlowLogs = flowLogsDoc;
      centralLogSources.push(...mapFlowLogs(flowLogsDoc, region));
    }

    const rdsDoc = await safeCall(manifest, `rds:DescribeDBInstances:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'rds',
        action: 'DescribeDBInstances',
        version: '2014-10-31',
      }),
    );
    if (rdsDoc) {
      regionRecord.describeDbInstances = rdsDoc;
      discoveredAssets.push(...mapRdsInstances(rdsDoc, region, config.owner));
    }

    const elbDoc = await safeCall(manifest, `elbv2:DescribeLoadBalancers:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'elbv2',
        action: 'DescribeLoadBalancers',
        version: '2015-12-01',
      }),
    );
    if (elbDoc) {
      regionRecord.describeLoadBalancers = elbDoc;
      discoveredAssets.push(...mapElbLoadBalancers(elbDoc, region, config.owner));
    }

    const alarmsDoc = await safeCall(manifest, `cloudwatch:DescribeAlarms:${region}`, () =>
      callAwsQueryXml({
        aws,
        region,
        service: 'cloudwatch',
        action: 'DescribeAlarms',
        version: '2010-08-01',
      }),
    );
    if (alarmsDoc) {
      regionRecord.describeAlarms = alarmsDoc;
      alertRules.push(...mapCloudWatchAlarms(alarmsDoc));
    }

    const trailsDoc = await safeCall(manifest, `cloudtrail:DescribeTrails:${region}`, () =>
      callAwsJson({
        aws,
        region,
        service: 'cloudtrail',
        target: 'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails',
        body: { includeShadowTrails: true },
      }),
    );
    if (trailsDoc) {
      regionRecord.describeTrails = trailsDoc;
      for (const trail of toArray<Record<string, unknown>>(trailsDoc.trailList)) {
        const name = normalizeString(trail.Name ?? trail.TrailARN, `cloudtrail-${region}`);
        centralLogSources.push({
          sourceId: stableId('cloudtrail', [region, name]),
          assetId: 'org-wide-aws',
          sourceType: 'cloud_control_plane',
          localSource: `CloudTrail ${name}`,
          centralDestination: normalizeNullableString(trail.CloudWatchLogsLogGroupArn)
            ? 'cloudwatch_logs'
            : normalizeNullableString(trail.S3BucketName)
              ? 's3'
              : 'unknown',
          status: 'active',
          sampleLocalEventRef: null,
          sampleCentralEventRef: null,
          lastSeen: nowIso(),
          metadata: {
            region,
            trailArn: normalizeNullableString(trail.TrailARN),
            isMultiRegionTrail: normalizeBoolean(trail.IsMultiRegionTrail, false),
          },
        });
      }
    }

    const lookupEventsDoc = await safeCall(manifest, `cloudtrail:LookupEvents:${region}`, () =>
      callAwsJson({
        aws,
        region,
        service: 'cloudtrail',
        target: 'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.LookupEvents',
        body: { MaxResults: 50 },
      }),
    );
    if (lookupEventsDoc) {
      regionRecord.lookupEvents = lookupEventsDoc;
      cloudEvents.push(...mapCloudTrailLookupEvents(lookupEventsDoc, region, manifest.accountId));
    }

    const detectorsDoc = await safeCall(manifest, `guardduty:ListDetectors:${region}`, () =>
      callAwsJson({
        aws,
        region,
        service: 'guardduty',
        target: 'GuardDutyService.ListDetectors',
        body: {},
      }),
    );
    if (detectorsDoc) {
      regionRecord.listDetectors = detectorsDoc;
      for (const detectorId of normalizeStringArray(detectorsDoc.DetectorIds)) {
        const findingIdsDoc = await safeCall(manifest, `guardduty:ListFindings:${region}:${detectorId}`, () =>
          callAwsJson({
            aws,
            region,
            service: 'guardduty',
            target: 'GuardDutyService.ListFindings',
            body: {
              DetectorId: detectorId,
              MaxResults: 50,
            },
          }),
        );
        const findingIds = normalizeStringArray(findingIdsDoc?.FindingIds);
        if (findingIds.length === 0) {
          continue;
        }
        const findingsDoc = await safeCall(manifest, `guardduty:GetFindings:${region}:${detectorId}`, () =>
          callAwsJson({
            aws,
            region,
            service: 'guardduty',
            target: 'GuardDutyService.GetFindings',
            body: {
              DetectorId: detectorId,
              FindingIds: findingIds,
            },
          }),
        );
        if (findingsDoc) {
          const mapped = mapGuardDutyFindings(toArray<GuardDutyFinding>(findingsDoc.Findings), region, manifest.accountId);
          cloudEvents.push(...mapped.cloudEvents);
          scannerFindings.push(...mapped.scannerFindings);
        }
      }
    }

    const configDoc = await safeCall(manifest, `config:DescribeConfigRules:${region}`, () =>
      callAwsJson({
        aws,
        region,
        service: 'config',
        target: 'StarlingDoveService.DescribeConfigRules',
        body: { Limit: 100 },
      }),
    );
    if (configDoc) {
      regionRecord.describeConfigRules = configDoc;
    }

    rawRegions.push(regionRecord);
  }

  const dedupAssets = uniqueBy(discoveredAssets, (item) => normalizeString(item.assetId));
  const dedupEvents = uniqueBy(cloudEvents, (item) => normalizeString(item.eventId));
  const dedupFindings = uniqueBy(scannerFindings, (item) => normalizeString(item.findingId));
  const dedupLogs = uniqueBy(centralLogSources, (item) => normalizeString(item.sourceId));
  const dedupAlerts = uniqueBy(alertRules, (item) => normalizeString(item.ruleId));

  const rawBundle: Record<string, unknown> = {
    declaredInventory: mirrorDeclaredInventory(dedupAssets),
    discoveredAssets: dedupAssets,
    cloudEvents: dedupEvents,
    scannerTargets: dedupAssets
      .filter((asset) => normalizeString(asset.assetType) !== 'security-group-exposure')
      .map((asset, index) => ({
        targetId: stableId('aws-target', [normalizeString(asset.assetId), String(index + 1)]),
        assetId: normalizeString(asset.assetId),
        scannerName: 'aws-live',
        hostname: normalizeNullableString(asset.name),
        ipAddress:
          normalizeNullableString(firstItem<string>(asset.privateIps)) ??
          normalizeNullableString(firstItem<string>(asset.publicIps)),
        credentialed: true,
        lastScanTime: manifest.collectedAt,
        metadata: {
          generatedFrom: 'aws-live-collector',
        },
      })),
    scannerFindings: dedupFindings,
    centralLogSources: dedupLogs,
    alertRules: dedupAlerts,
    tickets: [],
    seededPoam: [],
    collectedAt: manifest.collectedAt,
    schemaVersion: 'v1-live-aws',
    metadata: {
      generatedFrom: 'aws-live-collector',
      adapterSources: [
        'sts',
        'ec2',
        'cloudtrail',
        'cloudwatch',
        'guardduty',
        's3',
        'rds',
        'elbv2',
        'config',
      ],
      provider: args.provider,
      sourceName: args.sourceName,
      inputMode: args.inputMode,
      bundleKind: args.bundleKind,
      accountId: manifest.accountId,
      accountLabel: manifest.accountLabel,
      regions,
      permissionCoverage: buildPermissionCoverage(manifest),
      rawAws: {
        stsIdentity,
        regions: rawRegions,
      },
    },
  };

  const hasMeaningfulPayload =
    dedupAssets.length > 0 ||
    dedupEvents.length > 0 ||
    dedupFindings.length > 0 ||
    dedupLogs.length > 0 ||
    dedupAlerts.length > 0;

  return hasMeaningfulPayload ? rawBundle : null;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const identifier = key(item);
    if (!identifier || seen.has(identifier)) {
      continue;
    }
    seen.add(identifier);
    output.push(item);
  }
  return output;
}

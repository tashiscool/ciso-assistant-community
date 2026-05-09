import type { BundleKind, EvidenceInputMode } from './types';

type LiveAdapterResolvedBundle = {
  rawBundle: Record<string, unknown>;
  adapterSources: string[];
};

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

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
    if (['1', 'true', 'yes', 'y', 'enabled', 'active', 'open', 'public'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'disabled', 'private'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function normalizeSeverity(value: unknown, fallback = 'moderate'): string {
  const normalized = normalizeString(value, fallback).toLowerCase();
  switch (normalized) {
    case 'critical':
    case 'high':
    case 'moderate':
    case 'medium':
    case 'low':
      return normalized === 'medium' ? 'moderate' : normalized;
    case 'informational':
    case 'info':
      return 'low';
    default:
      return fallback;
  }
}

function normalizeStatus(value: unknown, fallback = 'open'): string {
  const normalized = normalizeString(value, fallback).toLowerCase();
  if (['closed', 'resolved', 'fixed', 'complete', 'completed'].includes(normalized)) {
    return 'closed';
  }
  if (['accepted', 'suppressed', 'waived'].includes(normalized)) {
    return 'accepted';
  }
  if (['stale', 'inactive', 'disabled'].includes(normalized)) {
    return normalized;
  }
  return normalized.length > 0 ? normalized : fallback;
}

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const value = parts
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0)
    .join(':')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return value.length > 0 ? `${prefix}:${value}` : `${prefix}:${crypto.randomUUID()}`;
}

function pickFirstArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return [];
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

function eventSemanticType(record: Record<string, unknown>): string {
  const eventName = normalizeString(record.eventName ?? record.event_name).toLowerCase();
  const categoryName = normalizeString(record.category_name ?? record.categoryName).toLowerCase();
  const className = normalizeString(record.class_name ?? record.className).toLowerCase();
  const activityName = normalizeString(record.activity_name ?? record.activityName).toLowerCase();
  const title = normalizeString(
    toRecord(record.finding_info).title ??
      toRecord(record.finding_info).desc ??
      record.title ??
      record.description,
  ).toLowerCase();
  const combined = [eventName, categoryName, className, activityName, title].join(' ');

  if (combined.includes('createuser') || combined.includes('user created')) {
    return 'identity.user_created';
  }
  if (combined.includes('attachrolepolicy') || combined.includes('putrolepolicy') || combined.includes('permission')) {
    return 'identity.permission_changed';
  }
  if (combined.includes('mfa') && combined.includes('disable')) {
    return 'identity.mfa_disabled';
  }
  if (combined.includes('stoplogging') || combined.includes('deletetrail')) {
    return 'logging.audit_disabled';
  }
  if (combined.includes('securitygroup') || combined.includes('firewall')) {
    return 'network.firewall_rule_changed';
  }
  if (combined.includes('public') && (combined.includes('ssh') || combined.includes('3389') || combined.includes('admin'))) {
    return 'network.public_admin_service_opened';
  }
  if (combined.includes('public') && (combined.includes('5432') || combined.includes('3306') || combined.includes('database'))) {
    return 'network.public_database_service_opened';
  }
  if (combined.includes('vulnerab') || combined.includes('cve') || combined.includes('scanner')) {
    return 'scanner.high_vulnerability_detected';
  }
  return 'generic.event';
}

function mapInventoryRows(rows: unknown[], defaultOwner: string | null): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    const publicIps = normalizeStringArray(
      row.publicIps ?? row.public_ips ?? row.publicIpAddresses ?? row.public_ip_addresses,
    );
    return {
      assetId:
        normalizeString(row.assetId ?? row.asset_id ?? row.instanceId ?? row.instance_id ?? row.id) ||
        `inventory-${index + 1}`,
      name:
        normalizeString(row.name ?? row.assetName ?? row.asset_name ?? row.hostname ?? row.resourceId ?? row.resource_id) ||
        `Inventory asset ${index + 1}`,
      assetType: normalizeString(row.assetType ?? row.asset_type ?? row.resourceType ?? row.resource_type, 'service'),
      environment: normalizeString(row.environment, 'production'),
      owner: normalizeNullableString(row.owner ?? row.ownerName ?? row.owner_name) ?? defaultOwner,
      region: normalizeNullableString(row.region),
      accountId: normalizeNullableString(row.accountId ?? row.account_id ?? row.account),
      inBoundary: normalizeBoolean(row.inBoundary ?? row.in_boundary, true),
      scannerRequired: normalizeBoolean(row.scannerRequired ?? row.scanner_required, true),
      logRequired: normalizeBoolean(row.logRequired ?? row.log_required, true),
      isPublic:
        normalizeBoolean(row.isPublic ?? row.is_public, false) ||
        publicIps.length > 0 ||
        normalizeBoolean(row.publiclyReachable ?? row.publicly_reachable, false),
      expectedPrivateIp: normalizeNullableString(row.expectedPrivateIp ?? row.expected_private_ip),
      expectedPublicIp:
        normalizeNullableString(row.expectedPublicIp ?? row.expected_public_ip) ?? publicIps[0] ?? null,
      metadata: toRecord(row.metadata),
    };
  });
}

function mapAssetRows(rows: unknown[], defaultOwner: string | null): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    const privateIps = normalizeStringArray(
      row.privateIps ?? row.private_ips ?? row.privateIpAddresses ?? row.private_ip_addresses ?? row.privateIpAddress,
    );
    const publicIps = normalizeStringArray(
      row.publicIps ?? row.public_ips ?? row.publicIpAddresses ?? row.public_ip_addresses ?? row.publicIpAddress,
    );
    return {
      assetId:
        normalizeString(row.assetId ?? row.asset_id ?? row.instanceId ?? row.instance_id ?? row.resourceId ?? row.resource_id ?? row.id) ||
        `asset-${index + 1}`,
      name:
        normalizeString(row.name ?? row.assetName ?? row.asset_name ?? row.hostname ?? row.resourceId ?? row.resource_id) ||
        `Discovered asset ${index + 1}`,
      assetType: normalizeString(row.assetType ?? row.asset_type ?? row.resourceType ?? row.resource_type, 'service'),
      environment: normalizeString(row.environment, 'production'),
      owner: normalizeNullableString(row.owner ?? row.ownerName ?? row.owner_name) ?? defaultOwner,
      region: normalizeNullableString(row.region),
      accountId: normalizeNullableString(row.accountId ?? row.account_id ?? row.account),
      inBoundary: normalizeBoolean(row.inBoundary ?? row.in_boundary, true),
      isPublic:
        normalizeBoolean(row.isPublic ?? row.is_public, false) ||
        publicIps.length > 0 ||
        normalizeBoolean(row.publiclyReachable ?? row.publicly_reachable, false),
      privateIps,
      publicIps,
      metadata: toRecord(row.metadata),
    };
  });
}

function mapAwsCloudTrailRows(rows: unknown[], provider: string): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    const detail = toRecord(row.detail);
    const userIdentity = toRecord(detail.userIdentity);
    const requestParameters = toRecord(detail.requestParameters);
    const eventId =
      normalizeString(detail.eventID ?? row.eventID ?? row.eventId) ||
      stableId('cloudtrail', [detail.eventName as string, String(index + 1)]);
    const assetId =
      normalizeNullableString(requestParameters.instanceId ?? requestParameters.resourceId ?? row.resourceId) ??
      normalizeNullableString(toRecord(row.resource).uid ?? toRecord(row.resource).id);
    const eventName = normalizeString(detail.eventName ?? row.eventName, 'CloudTrail Event');
    const semanticType = eventSemanticType({
      eventName,
      title: row.title,
    });
    return {
      eventId,
      assetId,
      semanticType,
      severity:
        semanticType.startsWith('identity.') || semanticType.startsWith('network.public')
          ? 'high'
          : semanticType === 'logging.audit_disabled'
            ? 'critical'
            : 'moderate',
      status: 'open',
      centralEventRef: normalizeNullableString(row.centralEventRef ?? row.central_event_ref),
      localEventRef: normalizeNullableString(row.eventID ?? row.eventId ?? row.id) ?? eventId,
      title: normalizeString(row.title, eventName),
      metadata: {
        provider,
        actor:
          normalizeNullableString(userIdentity.userName ?? userIdentity.arn ?? userIdentity.principalId) ?? 'unknown',
        eventSource: normalizeNullableString(detail.eventSource),
      },
    };
  });
}

function mapOcsfRows(rows: unknown[], provider: string): {
  findings: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
} {
  const findings = rows.map((item, index) => {
    const row = toRecord(item);
    const metadata = toRecord(row.metadata);
    const findingInfo = toRecord(row.finding_info);
    const resource = toRecord(row.resource);
    const findingId =
      normalizeString(metadata.uid ?? findingInfo.uid ?? row.uuid ?? row.id) || `ocsf-finding-${index + 1}`;
    const assetId =
      normalizeNullableString(resource.uid ?? resource.id ?? resource.name) ??
      normalizeNullableString(row.assetId ?? row.asset_id);
    return {
      findingId: stableId('ocsf', [findingId]),
      assetId,
      severity: normalizeSeverity(row.severity ?? row.severity_id, 'high'),
      status: normalizeStatus(row.status ?? row.status_code, 'open'),
      title: normalizeString(findingInfo.title ?? findingInfo.desc ?? row.title, `OCSF finding ${index + 1}`),
      cveIds: normalizeStringArray(findingInfo.cves ?? row.cves),
      linkedTicketIds: normalizeStringArray(row.linkedTicketIds ?? row.linked_ticket_ids),
      exploitationReview: {
        logReviewPerformed: normalizeBoolean(
          toRecord(row.remediation).logReviewPerformed ??
            toRecord(row.evidence).logReviewPerformed ??
            row.logReviewPerformed,
          false,
        ),
      },
      metadata: {
        provider,
        source_format: 'ocsf',
        resource,
      },
    };
  });

  const events = rows.map((item, index) => {
    const row = toRecord(item);
    const metadata = toRecord(row.metadata);
    const resource = toRecord(row.resource);
    const eventId =
      normalizeString(metadata.uid ?? row.uuid ?? row.id) || `ocsf-event-${index + 1}`;
    const semanticType = eventSemanticType(row);
    return {
      eventId: stableId('ocsf-event', [eventId]),
      assetId:
        normalizeNullableString(resource.uid ?? resource.id ?? resource.name) ??
        normalizeNullableString(row.assetId ?? row.asset_id),
      semanticType,
      severity: normalizeSeverity(row.severity ?? row.severity_id, 'moderate'),
      status: normalizeStatus(row.status ?? row.status_code, 'open'),
      centralEventRef: normalizeNullableString(metadata.uid ?? row.uuid),
      localEventRef: normalizeNullableString(row.id),
      title:
        normalizeString(toRecord(row.finding_info).title ?? toRecord(row.finding_info).desc ?? row.message) ||
        `OCSF event ${index + 1}`,
      metadata: {
        provider,
        source_format: 'ocsf',
      },
    };
  });

  return {
    findings,
    events,
  };
}

function mapScannerRows(rows: unknown[], provider: string): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    const assetId =
      normalizeNullableString(row.assetId ?? row.asset_id ?? row.host ?? row.hostname ?? row.resourceId ?? row.resource_id) ??
      null;
    return {
      findingId:
        normalizeString(row.findingId ?? row.finding_id ?? row.plugin_id ?? row.id) ||
        `scanner-finding-${index + 1}`,
      assetId,
      severity: normalizeSeverity(row.severity ?? row.risk, 'moderate'),
      status: normalizeStatus(row.status, 'open'),
      title: normalizeString(row.title ?? row.name ?? row.summary, `Scanner finding ${index + 1}`),
      cveIds: normalizeStringArray(row.cveIds ?? row.cve_ids ?? row.cves ?? row.CVE),
      linkedTicketIds: normalizeStringArray(row.linkedTicketIds ?? row.linked_ticket_ids ?? row.ticketIds),
      exploitationReview: {
        logReviewPerformed: normalizeBoolean(
          toRecord(row.exploitationReview).logReviewPerformed ??
            row.logReviewPerformed ??
            row.exploitation_review_complete,
          false,
        ),
      },
      metadata: {
        provider,
        scannerName: normalizeString(row.scannerName ?? row.scanner_name ?? row.scanner ?? provider, provider),
        pluginId: normalizeNullableString(row.pluginId ?? row.plugin_id ?? row.plugin),
        targetId: normalizeNullableString(row.targetId ?? row.target_id ?? row.host ?? row.hostname),
      },
    };
  });
}

function mapTicketRows(rows: unknown[], provider: string): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    return {
      ticketId:
        normalizeString(row.ticketId ?? row.ticket_id ?? row.key ?? row.issue_key ?? row.number ?? row.id) ||
        `ticket-${index + 1}`,
      title: normalizeString(row.title ?? row.summary ?? row.short_description, `Ticket ${index + 1}`),
      status: normalizeStatus(row.status ?? row.state, 'open'),
      linkedAssetIds: normalizeStringArray(
        row.linkedAssetIds ?? row.linked_asset_ids ?? row.assets ?? row.asset_id ?? row.configuration_item,
      ),
      linkedEventIds: normalizeStringArray(row.linkedEventIds ?? row.linked_event_ids ?? row.events ?? row.event_id),
      linkedFindingIds: normalizeStringArray(
        row.linkedFindingIds ?? row.linked_finding_ids ?? row.findings ?? row.finding_id,
      ),
      hasSecurityImpactAnalysis: normalizeBoolean(
        row.hasSecurityImpactAnalysis ?? row.security_impact_analysis,
        false,
      ),
      hasTestingEvidence: normalizeBoolean(row.hasTestingEvidence ?? row.test_evidence, false),
      hasApproval: normalizeBoolean(row.hasApproval ?? row.approved, false),
      hasDeploymentEvidence: normalizeBoolean(row.hasDeploymentEvidence ?? row.deploy_evidence, false),
      hasVerificationEvidence: normalizeBoolean(
        row.hasVerificationEvidence ?? row.post_deploy_verification,
        false,
      ),
      metadata: {
        provider,
        system: normalizeString(row.system ?? row.source ?? row.tool, provider),
      },
    };
  });
}

function mapLogSourceRows(rows: unknown[], provider: string): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    return {
      sourceId:
        normalizeString(row.sourceId ?? row.source_id ?? row.id) || `log-source-${index + 1}`,
      assetId: normalizeNullableString(row.assetId ?? row.asset_id ?? row.resourceId ?? row.resource_id),
      sourceType: normalizeNullableString(row.sourceType ?? row.source_type ?? row.type),
      localSource: normalizeNullableString(row.localSource ?? row.local_source ?? row.local),
      centralDestination: normalizeNullableString(
        row.centralDestination ?? row.central_destination ?? row.destination,
      ),
      status: normalizeStatus(row.status, 'active'),
      sampleLocalEventRef: normalizeNullableString(row.sampleLocalEventRef ?? row.sample_local_event_ref),
      sampleCentralEventRef: normalizeNullableString(
        row.sampleCentralEventRef ?? row.sample_central_event_ref,
      ),
      lastSeen: normalizeNullableString(row.lastSeen ?? row.last_seen ?? row.updatedAt ?? row.updated_at),
      metadata: {
        provider,
      },
    };
  });
}

function mapAlertRuleRows(rows: unknown[], provider: string): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    return {
      ruleId: normalizeString(row.ruleId ?? row.rule_id ?? row.id) || `alert-rule-${index + 1}`,
      name: normalizeString(row.name ?? row.title, `Alert rule ${index + 1}`),
      enabled: normalizeBoolean(row.enabled ?? row.is_enabled, true),
      semanticTypes: normalizeStringArray(
        row.semanticTypes ?? row.semantic_types ?? row.eventTypes ?? row.event_types,
      ),
      recipients: normalizeStringArray(row.recipients ?? row.targets ?? row.owners),
      lastFired: normalizeNullableString(row.lastFired ?? row.last_fired),
      metadata: {
        provider,
      },
    };
  });
}

function mapPoamRows(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((item, index) => {
    const row = toRecord(item);
    return {
      poamId: normalizeString(row.poamId ?? row.poam_id ?? row.id) || `poam-${index + 1}`,
      title: normalizeString(row.title ?? row.name, `POA&M ${index + 1}`),
      status: normalizeStatus(row.status, 'open'),
      severity: normalizeSeverity(row.severity, 'moderate'),
      metadata: toRecord(row.metadata),
    };
  });
}

function mapSecurityGroupExposures(rows: unknown[]): {
  assets: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
} {
  const assets: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const findings: Array<Record<string, unknown>> = [];

  for (const item of rows) {
    const row = toRecord(item);
    const groupId = normalizeString(row.group_id ?? row.groupId ?? row.GroupId ?? row.id, 'sg');
    const permissions = toArray(row.IpPermissions ?? row.ip_permissions ?? row.permissions);
    for (const permission of permissions) {
      const permissionRecord = toRecord(permission);
      const protocol = normalizeString(permissionRecord.IpProtocol ?? permissionRecord.ip_protocol, 'tcp');
      const fromPort = Number(permissionRecord.FromPort ?? permissionRecord.from_port ?? permissionRecord.port ?? 0);
      const toPort = Number(permissionRecord.ToPort ?? permissionRecord.to_port ?? fromPort);
      const ipRanges = [
        ...toArray(permissionRecord.IpRanges ?? permissionRecord.ip_ranges),
        ...toArray(permissionRecord.Ipv6Ranges ?? permissionRecord.ipv6_ranges),
      ];
      for (const range of ipRanges) {
        const rangeRecord = toRecord(range);
        const cidr =
          normalizeString(rangeRecord.CidrIp ?? rangeRecord.cidr_ip) ||
          normalizeString(rangeRecord.CidrIpv6 ?? rangeRecord.cidr_ipv6);
        if (!PUBLIC_CIDRS.has(cidr)) {
          continue;
        }
        const ports = toPort >= fromPort ? Array.from({ length: Math.min(toPort - fromPort + 1, 10) }, (_, offset) => fromPort + offset) : [fromPort];
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
            region: null,
            accountId: null,
            inBoundary: true,
            isPublic: true,
            privateIps: [],
            publicIps: [cidr],
            metadata: {
              groupId,
              port,
              protocol,
            },
          });
          events.push({
            eventId: stableId('sg-event', [groupId, String(port), cidr]),
            assetId,
            semanticType,
            severity: ADMIN_PORTS.has(port) ? 'critical' : 'high',
            status: 'open',
            centralEventRef: null,
            localEventRef: stableId('sg-local', [groupId, String(port)]),
            title: `Public exposure detected on ${groupId}:${port}`,
            metadata: {
              cidr,
              groupId,
              port,
              protocol,
            },
          });
          findings.push({
            findingId: stableId('sg-finding', [groupId, String(port), cidr]),
            assetId,
            severity: ADMIN_PORTS.has(port) ? 'critical' : 'high',
            status: 'open',
            title: `Security group ${groupId} exposes port ${port} publicly`,
            cveIds: [],
            linkedTicketIds: [],
            exploitationReview: {},
            metadata: {
              cidr,
              groupId,
              port,
              protocol,
            },
          });
        }
      }
    }
  }

  return {
    assets,
    events,
    findings,
  };
}

export function resolveLiveAdapterBundle(args: {
  provider: string;
  sourceName: string;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  sourceConfig: Record<string, unknown>;
  adapterHints: Record<string, unknown>;
}): LiveAdapterResolvedBundle | null {
  const merged = mergeRecords(
    args.sourceConfig.liveCollection,
    args.sourceConfig.liveInput,
    args.adapterHints.liveCollection,
    args.adapterHints.liveInput,
  );

  const inventoryRows = pickFirstArray(
    merged.declaredInventory,
    merged.declared_inventory,
    merged.inventory,
    merged.authoritative_inventory,
  );
  const assetRows = pickFirstArray(
    merged.discoveredAssets,
    merged.discovered_assets,
    merged.assets,
    merged.instances,
    merged.ec2Instances,
  );
  const cloudTrailRows = pickFirstArray(
    merged.cloudTrail,
    merged.cloudtrail,
    merged.cloudEvents,
    merged.cloud_events,
  );
  const securityGroupRows = pickFirstArray(
    merged.securityGroups,
    merged.security_groups,
  );
  const ocsfRows = pickFirstArray(
    merged.ocsfDetections,
    merged.ocsf,
    merged.findings,
  );
  const scannerRows = pickFirstArray(
    merged.scannerFindings,
    merged.scanner_findings,
    merged.vulnerabilities,
    merged.scannerRows,
  );
  const ticketRows = pickFirstArray(
    merged.tickets,
    merged.issues,
    merged.ticketExport,
  );
  const logSourceRows = pickFirstArray(
    merged.logSources,
    merged.log_sources,
    merged.centralLogSources,
    merged.central_log_sources,
  );
  const alertRuleRows = pickFirstArray(
    merged.alertRules,
    merged.alert_rules,
    merged.rules,
  );
  const poamRows = pickFirstArray(
    merged.seededPoam,
    merged.seeded_poam,
    merged.poam,
  );

  const adapterSources: string[] = [];
  const defaultOwner = normalizeNullableString(args.sourceConfig.owner ?? args.adapterHints.owner);
  const declaredInventory = mapInventoryRows(inventoryRows, defaultOwner);
  const discoveredAssets = mapAssetRows(assetRows, defaultOwner);
  const cloudEvents: Array<Record<string, unknown>> = [];
  const scannerFindings: Array<Record<string, unknown>> = [];

  if (declaredInventory.length > 0 || discoveredAssets.length > 0) {
    adapterSources.push('inventory');
  }

  if (cloudTrailRows.length > 0) {
    adapterSources.push('cloudtrail');
    cloudEvents.push(...mapAwsCloudTrailRows(cloudTrailRows, args.provider));
  }

  if (securityGroupRows.length > 0) {
    adapterSources.push('security-groups');
    const exposures = mapSecurityGroupExposures(securityGroupRows);
    discoveredAssets.push(...exposures.assets);
    cloudEvents.push(...exposures.events);
    scannerFindings.push(...exposures.findings);
  }

  if (ocsfRows.length > 0) {
    adapterSources.push('ocsf');
    const ocsfArtifacts = mapOcsfRows(ocsfRows, args.provider);
    scannerFindings.push(...ocsfArtifacts.findings);
    cloudEvents.push(...ocsfArtifacts.events);
  }

  if (scannerRows.length > 0) {
    adapterSources.push('scanner');
    scannerFindings.push(...mapScannerRows(scannerRows, args.provider));
  }

  const tickets = mapTicketRows(ticketRows, args.provider);
  if (tickets.length > 0) {
    adapterSources.push('tickets');
  }

  const centralLogSources = mapLogSourceRows(logSourceRows, args.provider);
  if (centralLogSources.length > 0) {
    adapterSources.push('logs');
  }

  const alertRules = mapAlertRuleRows(alertRuleRows, args.provider);
  if (alertRules.length > 0) {
    adapterSources.push('alerts');
  }

  const seededPoam = mapPoamRows(poamRows);
  if (seededPoam.length > 0) {
    adapterSources.push('poam');
  }

  const rawBundle: Record<string, unknown> = {
    declaredInventory,
    discoveredAssets,
    cloudEvents,
    scannerTargets: discoveredAssets.map((asset, index) => ({
      targetId: stableId('target', [normalizeString(asset.assetId), String(index + 1)]),
      assetId: normalizeString(asset.assetId),
      scannerName: normalizeString(args.provider, 'adapter'),
      hostname: normalizeNullableString(asset.name),
      ipAddress: normalizeStringArray(asset.privateIps)[0] ?? normalizeStringArray(asset.publicIps)[0] ?? null,
      credentialed: args.provider !== 'github',
      lastScanTime: nowIso(),
      metadata: {
        generatedFrom: 'live-adapter',
      },
    })),
    scannerFindings,
    centralLogSources,
    alertRules,
    tickets,
    seededPoam,
    collectedAt: normalizeString(merged.collectedAt ?? merged.generatedAt, nowIso()),
    schemaVersion: normalizeString(merged.schemaVersion ?? merged.schema_version, 'v1-live'),
    metadata: {
      generatedFrom: 'live-adapter',
      adapterSources,
      provider: args.provider,
      sourceName: args.sourceName,
      inputMode: args.inputMode,
      bundleKind: args.bundleKind,
    },
  };

  const hasMeaningfulPayload =
    declaredInventory.length > 0 ||
    discoveredAssets.length > 0 ||
    cloudEvents.length > 0 ||
    scannerFindings.length > 0 ||
    centralLogSources.length > 0 ||
    alertRules.length > 0 ||
    tickets.length > 0 ||
    seededPoam.length > 0;

  return hasMeaningfulPayload
    ? {
        rawBundle,
        adapterSources,
      }
    : null;
}

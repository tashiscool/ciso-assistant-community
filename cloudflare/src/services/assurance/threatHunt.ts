import type {
  AssuranceSeverity,
  EvaluationArtifacts,
  NormalizedEvidenceBundle,
} from './types';

export type ThreatHuntFinding = {
  id: string;
  findingType: string;
  status: 'suspected' | 'confirmed_gap' | 'requires_review';
  severity: AssuranceSeverity;
  confidence: 'low' | 'medium' | 'high';
  title: string;
  hypothesis: string;
  detail: string;
  evidenceRefs: string[];
  recommendedActions: string[];
};

export type ThreatHuntTimelineEntry = {
  id: string;
  observedAt: string;
  sourceType: string;
  severity: AssuranceSeverity;
  title: string;
  detail: string;
  evidenceRef: string;
};

export type ThreatHuntArtifacts = {
  generatedAt: string;
  findingCount: number;
  findings: ThreatHuntFinding[];
  timeline: ThreatHuntTimelineEntry[];
};

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function asSeverityRank(value: AssuranceSeverity): number {
  switch (value) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
  }
}

function timelineTimestamp(
  event: NormalizedEvidenceBundle['cloudEvents'][number],
  fallback: string,
): string {
  const metadata = event.metadata ?? {};
  const explicit =
    typeof metadata.timestamp === 'string'
      ? metadata.timestamp
      : typeof metadata.observedAt === 'string'
        ? metadata.observedAt
        : typeof metadata.time === 'string'
          ? metadata.time
          : null;
  return explicit?.trim() || fallback;
}

export function buildThreatHuntArtifacts(args: {
  bundle: NormalizedEvidenceBundle;
  artifacts: EvaluationArtifacts;
}): ThreatHuntArtifacts {
  const findings: ThreatHuntFinding[] = [];
  const timeline: ThreatHuntTimelineEntry[] = [];

  const exposedAssets = new Set(
    args.artifacts.gaps
      .filter((item) => item.gapType === 'public_exposure_open')
      .map((item) => item.affectedObjectId)
      .filter((item): item is string => Boolean(item)),
  );

  const missingTicketCoverage = new Set(
    args.artifacts.gaps
      .filter((item) => item.gapType === 'change_ticket_linkage_missing')
      .map((item) => item.affectedObjectId)
      .filter((item): item is string => Boolean(item)),
  );

  const missingCorrelationEvents = new Set(
    args.artifacts.gaps
      .filter((item) => item.gapType === 'event_correlation_missing')
      .map((item) => item.affectedObjectId)
      .filter((item): item is string => Boolean(item)),
  );

  const findingsMissingReview = new Set(
    args.artifacts.gaps
      .filter((item) => item.gapType === 'exploitation_review_missing')
      .map((item) => item.affectedObjectId)
      .filter((item): item is string => Boolean(item)),
  );

  for (const event of args.bundle.cloudEvents) {
    timeline.push({
      id: crypto.randomUUID(),
      observedAt: timelineTimestamp(event, args.bundle.collectedAt),
      sourceType: event.semanticType,
      severity: event.severity,
      title: event.title,
      detail: event.centralEventRef
        ? `Central evidence ref: ${event.centralEventRef}`
        : 'No centralized evidence ref was attached to this event.',
      evidenceRef: event.eventId,
    });
  }

  for (const finding of args.bundle.scannerFindings) {
    timeline.push({
      id: crypto.randomUUID(),
      observedAt:
        typeof finding.metadata?.lastSeen === 'string'
          ? finding.metadata.lastSeen
          : args.bundle.collectedAt,
      sourceType: 'scanner_finding',
      severity: finding.severity,
      title: finding.title,
      detail: `Scanner finding ${finding.findingId} remains ${finding.status}.`,
      evidenceRef: finding.findingId,
    });
  }

  for (const event of args.bundle.cloudEvents) {
    const isExposureSignal =
      event.semanticType.includes('public') || (event.assetId !== null && exposedAssets.has(event.assetId ?? ''));
    if (isExposureSignal) {
      findings.push({
        id: crypto.randomUUID(),
        findingType: 'public_exposure_chain',
        status: 'confirmed_gap',
        severity: 'critical',
        confidence: 'high',
        title: `Public exposure chain remains open for ${event.title}`,
        hypothesis:
          'A publicly reachable asset or service remains in scope without complete exception, mitigation, or closure evidence.',
        detail:
          event.assetId && exposedAssets.has(event.assetId)
            ? `The event ${event.eventId} aligns to a public-exposure evidence gap for asset ${event.assetId}.`
            : `The event ${event.eventId} describes an exposure-oriented semantic type (${event.semanticType}).`,
        evidenceRefs: [event.eventId, ...(event.assetId ? [event.assetId] : [])],
        recommendedActions: [
          'Confirm the exposure has been mitigated, exceptioned, or removed from scope.',
          'Attach firewall, service, or ticket closure evidence before marking the package authorize-ready.',
        ],
      });
    }
  }

  for (const finding of args.bundle.scannerFindings) {
    if (!missingTicketCoverage.has(finding.findingId)) {
      continue;
    }
    findings.push({
      id: crypto.randomUUID(),
      findingType: 'remediation_chain_break',
      status: 'confirmed_gap',
      severity: finding.severity === 'critical' ? 'critical' : 'high',
      confidence: 'high',
      title: `Remediation chain is incomplete for ${finding.title}`,
      hypothesis:
        'A high-severity finding remains open without a complete change-management and closure-evidence chain.',
      detail: `The finding ${finding.findingId} does not show full ticket, approval, testing, deployment, and verification evidence.`,
      evidenceRefs: [finding.findingId, ...finding.linkedTicketIds],
      recommendedActions: [
        'Link the finding to a ticket with SIA, approval, testing, deployment, and verification evidence.',
        'Preserve one machine-readable export that proves the ticket chain is complete.',
      ],
    });
  }

  for (const event of args.bundle.cloudEvents) {
    if (!missingCorrelationEvents.has(event.eventId)) {
      continue;
    }
    findings.push({
      id: crypto.randomUUID(),
      findingType: 'telemetry_blind_spot',
      status: 'requires_review',
      severity: event.severity === 'critical' ? 'critical' : 'high',
      confidence: 'medium',
      title: `Telemetry blind spot around ${event.title}`,
      hypothesis:
        'Security-relevant activity was observed locally, but the package cannot prove centralized correlation or retained observability.',
      detail: `The event ${event.eventId} lacks centralized correlation evidence in the current bundle.`,
      evidenceRefs: [event.eventId],
      recommendedActions: [
        'Prove the local event reached the expected centralized logging destination.',
        'Attach the query, event reference, or log-source export needed to close the correlation gap.',
      ],
    });
  }

  for (const finding of args.bundle.scannerFindings) {
    if (!findingsMissingReview.has(finding.findingId)) {
      continue;
    }
    findings.push({
      id: crypto.randomUUID(),
      findingType: 'exploitation_review_gap',
      status: 'requires_review',
      severity: finding.severity === 'critical' ? 'critical' : 'high',
      confidence: 'medium',
      title: `Exploitation review is missing for ${finding.title}`,
      hypothesis:
        'The package shows a high-severity exposure or vulnerability, but exploitation review evidence has not been preserved.',
      detail: `Finding ${finding.findingId} remains open without exploitation-review proof in the current bundle.`,
      evidenceRefs: [finding.findingId],
      recommendedActions: [
        'Attach the exploitation review query, analyst note, or linked ticket evidence.',
        'Do not represent the finding as triaged until the review artifact is attached.',
      ],
    });
  }

  timeline.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  findings.sort((left, right) => asSeverityRank(right.severity) - asSeverityRank(left.severity));

  return {
    generatedAt: nowIso(),
    findingCount: findings.length,
    findings,
    timeline,
  };
}

export function buildThreatHuntTimelineMarkdown(artifacts: ThreatHuntArtifacts): string {
  return [
    '# Threat Hunt Timeline',
    '',
    `Generated: ${artifacts.generatedAt}`,
    `Findings: ${artifacts.findingCount}`,
    '',
    '## Timeline',
    ...(artifacts.timeline.length > 0
      ? artifacts.timeline.map(
          (item) =>
            `- ${item.observedAt} [${item.severity.toUpperCase()}] ${item.title} (${item.sourceType}) — ${item.detail}`,
        )
      : ['- No threat-hunt timeline events were generated for this bundle.']),
    '',
    '## Findings',
    ...(artifacts.findings.length > 0
      ? artifacts.findings.map(
          (item) =>
            `- ${item.severity.toUpperCase()} ${item.title}: ${item.hypothesis} Recommended actions: ${item.recommendedActions.join(' ')}`,
        )
      : ['- No threat-hunt findings were generated for this bundle.']),
  ].join('\n');
}

export function buildThreatHuntQueryMarkdown(args: {
  bundle: NormalizedEvidenceBundle;
  artifacts: ThreatHuntArtifacts;
}): string {
  const semanticTypes = unique(args.bundle.cloudEvents.map((item) => item.semanticType)).slice(0, 6);
  const assetTerms = unique(
    [
      ...args.bundle.declaredInventory.filter((item) => item.isPublic).map((item) => item.assetId),
      ...args.bundle.discoveredAssets.filter((item) => item.isPublic).map((item) => item.assetId),
    ],
  ).slice(0, 6);
  const findingTypes = unique(args.artifacts.findings.map((item) => item.findingType)).slice(0, 6);
  const evidenceRefs = unique(args.artifacts.findings.flatMap((item) => item.evidenceRefs)).slice(0, 8);

  const splunkSearch = [
    'index=security sourcetype=regovise:assurance',
    semanticTypes.length > 0
      ? `| search (${semanticTypes.map((item) => `semantic_type="${item}"`).join(' OR ')})`
      : '| search severity=*',
    assetTerms.length > 0
      ? `| search (${assetTerms.map((item) => `asset_id="${item}"`).join(' OR ')})`
      : '| search asset_id=*',
    evidenceRefs.length > 0
      ? `| search (${evidenceRefs.map((item) => `evidence_ref="${item}"`).join(' OR ')})`
      : '| stats count by semantic_type, asset_id, severity',
    '| stats count by semantic_type, asset_id, severity, status',
  ];

  const sentinelQuery = [
    'AssuranceEvidence_CL',
    semanticTypes.length > 0
      ? `| where SemanticType_s in (${semanticTypes.map((item) => `"${item}"`).join(', ')})`
      : '| where isnotempty(SemanticType_s)',
    assetTerms.length > 0
      ? `| where AssetId_s in (${assetTerms.map((item) => `"${item}"`).join(', ')})`
      : '| where isnotempty(AssetId_s)',
    '| summarize Events=count() by SemanticType_s, AssetId_s, Severity_s, Status_s',
  ];

  const awsQuery = [
    'fields @timestamp, semantic_type, asset_id, severity, status, evidence_ref',
    semanticTypes.length > 0
      ? `| filter semantic_type in [${semanticTypes.map((item) => `"${item}"`).join(', ')}]`
      : '| filter ispresent(semantic_type)',
    assetTerms.length > 0
      ? `| filter asset_id in [${assetTerms.map((item) => `"${item}"`).join(', ')}]`
      : '| filter ispresent(asset_id)',
    '| stats count() by semantic_type, asset_id, severity, status',
  ];

  const gcpQuery = [
    'resource.type="regovise_assurance_evidence"',
    semanticTypes.length > 0
      ? `jsonPayload.semanticType=(${semanticTypes.map((item) => `"${item}"`).join(' OR ')})`
      : 'jsonPayload.semanticType:*',
    assetTerms.length > 0
      ? `jsonPayload.assetId=(${assetTerms.map((item) => `"${item}"`).join(' OR ')})`
      : 'jsonPayload.assetId:*',
  ];

  return [
    '# Threat Hunt Queries',
    '',
    `Generated: ${args.artifacts.generatedAt}`,
    `Threat-hunt findings: ${args.artifacts.findingCount}`,
    '',
    '## Hunt Focus',
    ...(findingTypes.length > 0
      ? findingTypes.map((item) => `- ${item}`)
      : ['- No specific finding types were generated; fall back to high-severity event review.']),
    '',
    '## Splunk',
    '```spl',
    ...splunkSearch,
    '```',
    '',
    '## Sentinel (KQL)',
    '```kusto',
    ...sentinelQuery,
    '```',
    '',
    '## AWS CloudWatch Logs Insights',
    '```sql',
    ...awsQuery,
    '```',
    '',
    '## GCP Cloud Logging',
    '```text',
    ...gcpQuery,
    '```',
    '',
    '## Evidence References',
    ...(evidenceRefs.length > 0
      ? evidenceRefs.map((item) => `- ${item}`)
      : ['- No explicit evidence references were attached to the current threat-hunt findings.']),
  ].join('\n');
}

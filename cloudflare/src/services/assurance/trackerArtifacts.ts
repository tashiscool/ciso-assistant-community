export type TrackerArtifactFamily =
  | 'tracker_diagnostics'
  | 'tracker_gap_report'
  | 'tracker_gap_matrix'
  | 'tracker_instrumentation_plan';

export type TrackerArtifactDiagnostic = {
  rowIndex: number;
  rowKey: string | null;
  rowStatus: string;
  category: string | null;
  ownerName: string | null;
  gapType: string | null;
  severity: string | null;
  detail: string;
  controlRefs: string[];
  rawRow: Record<string, unknown>;
};

const TRACKER_ARTIFACT_EXTENSIONS: Record<TrackerArtifactFamily, 'json' | 'md' | 'csv'> = {
  tracker_diagnostics: 'json',
  tracker_gap_report: 'md',
  tracker_gap_matrix: 'csv',
  tracker_instrumentation_plan: 'md',
};

const TRACKER_ARTIFACT_CONTENT_TYPES: Record<TrackerArtifactFamily, string> = {
  tracker_diagnostics: 'application/json',
  tracker_gap_report: 'text/markdown; charset=utf-8',
  tracker_gap_matrix: 'text/csv; charset=utf-8',
  tracker_instrumentation_plan: 'text/markdown; charset=utf-8',
};

function nowIso(): string {
  return new Date().toISOString();
}

function severityRank(value: string | null | undefined): number {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function csvRow(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
}

function distinct(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function topDiagnostics(diagnostics: TrackerArtifactDiagnostic[], limit = 5): TrackerArtifactDiagnostic[] {
  return [...diagnostics]
    .sort(
      (left, right) =>
        severityRank(right.severity) - severityRank(left.severity) ||
        left.rowIndex - right.rowIndex,
    )
    .slice(0, limit);
}

export function trackerImportArtifactKey(
  tenantId: string,
  importJobId: string,
  family: TrackerArtifactFamily,
): string {
  return `${tenantId}/assurance/tracker-imports/${importJobId}/${family}.${TRACKER_ARTIFACT_EXTENSIONS[family]}`;
}

export function trackerImportManifestKey(tenantId: string, importJobId: string): string {
  return `${tenantId}/assurance/tracker-imports/${importJobId}/manifest.json`;
}

export function trackerArtifactContentType(family: TrackerArtifactFamily): string {
  return TRACKER_ARTIFACT_CONTENT_TYPES[family];
}

export function buildTrackerGapReportMarkdown(args: {
  importJobId: string;
  diagnostics: TrackerArtifactDiagnostic[];
}): string {
  const openRows = args.diagnostics.filter((item) => item.rowStatus !== 'closed');
  const severeRows = topDiagnostics(
    args.diagnostics.filter((item) => severityRank(item.severity) >= 2),
    6,
  );
  const categoryCounts = args.diagnostics.reduce<Record<string, number>>((counts, item) => {
    const key = item.category ?? 'general';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const ownerCounts = args.diagnostics.reduce<Record<string, number>>((counts, item) => {
    const key = item.ownerName ?? 'Unassigned';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return [
    '# Tracker Gap Report',
    '',
    `Tracker import: ${args.importJobId}`,
    `Generated: ${nowIso()}`,
    '',
    '## Import Summary',
    `- Parsed tracker rows: ${args.diagnostics.length}`,
    `- Open rows: ${openRows.length}`,
    `- Closed rows: ${args.diagnostics.length - openRows.length}`,
    '',
    '## Category Distribution',
    ...Object.entries(categoryCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([category, count]) => `- ${category}: ${count}`),
    '',
    '## Owner Distribution',
    ...Object.entries(ownerCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([owner, count]) => `- ${owner}: ${count}`),
    '',
    '## Highest-Priority Rows',
    ...(severeRows.length > 0
      ? severeRows.map(
          (item) =>
            `- Row ${item.rowIndex}${item.rowKey ? ` (${item.rowKey})` : ''} [${(item.severity ?? item.rowStatus).toUpperCase()}] ${item.detail}`,
        )
      : ['- No high-severity tracker rows were found in this import.']),
    '',
    '## Recommended Follow-Up',
    '- Confirm control and KSI mappings before promoting tracker rows into a 20x package.',
    '- Resolve high-severity open rows first and attach evidence notes where lineage is incomplete.',
    '- Use the review queue after tracker-to-20x conversion to accept or reject generated remediation recommendations.',
  ].join('\n');
}

export function buildTrackerGapMatrixCsv(diagnostics: TrackerArtifactDiagnostic[]): string {
  const headers = [
    'row_index',
    'row_key',
    'row_status',
    'category',
    'gap_type',
    'severity',
    'owner_name',
    'control_refs',
    'detail',
  ];
  const lines = [csvRow(headers)];
  for (const item of diagnostics) {
    lines.push(
      csvRow([
        String(item.rowIndex),
        item.rowKey ?? '',
        item.rowStatus,
        item.category ?? 'general',
        item.gapType ?? 'evidence_gap',
        item.severity ?? 'moderate',
        item.ownerName ?? '',
        item.controlRefs.join('|'),
        item.detail,
      ]),
    );
  }
  return lines.join('\n');
}

export function buildTrackerInstrumentationPlanMarkdown(args: {
  importJobId: string;
  diagnostics: TrackerArtifactDiagnostic[];
}): string {
  const categories = distinct(args.diagnostics.map((item) => item.category));
  const owners = distinct(args.diagnostics.map((item) => item.ownerName));
  const controls = distinct(args.diagnostics.flatMap((item) => item.controlRefs));
  const severeRows = topDiagnostics(args.diagnostics, 5);
  const splunkLines = [
    'index=security sourcetype=regovise:assurance:tracker',
    `| search import_job_id="${args.importJobId}"`,
    categories.length > 0
      ? `| search (${categories.map((item) => `category="${item}"`).join(' OR ')})`
      : '| eval category="general"',
    '| stats count by row_status, category, severity, owner_name',
  ];
  const sentinelLines = [
    'AssuranceTracker_CL',
    `| where ImportJobId_s == "${args.importJobId}"`,
    owners.length > 0
      ? `| where OwnerName_s in (${owners.map((item) => `"${item}"`).join(', ')})`
      : '| extend OwnerName_s="Unassigned"',
    '| summarize Rows=count() by RowStatus_s, Category_s, Severity_s, OwnerName_s',
  ];

  return [
    '# Tracker Instrumentation Plan',
    '',
    `Tracker import: ${args.importJobId}`,
    `Generated: ${nowIso()}`,
    '',
    '## Detection Objectives',
    '- Track open tracker rows by owner, category, and severity until they are either closed or promoted into assurance evidence.',
    '- Preserve clear lineage between raw tracker rows, mapped controls, and the downstream tracker-to-20x package.',
    '- Highlight high-severity tracker rows that are still open before a reviewer approves package-ready status.',
    '',
    '## Scope Signals',
    `- Categories in scope: ${categories.join(', ') || 'general'}`,
    `- Owners in scope: ${owners.join(', ') || 'Unassigned'}`,
    `- Control refs in scope: ${controls.join(', ') || 'none recorded'}`,
    '',
    '## Splunk',
    ['```spl', ...splunkLines, '```'].join('\n'),
    '',
    '## Sentinel (KQL)',
    ['```kusto', ...sentinelLines, '```'].join('\n'),
    '',
    '## Review Priority',
    ...(severeRows.length > 0
      ? severeRows.map(
          (item) =>
            `- Row ${item.rowIndex}${item.rowKey ? ` (${item.rowKey})` : ''}: ${item.detail}`,
        )
      : ['- No tracker rows were available for prioritization.']),
  ].join('\n');
}

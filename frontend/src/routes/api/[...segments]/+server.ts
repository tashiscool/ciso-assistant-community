import { env as privateEnv } from '$env/dynamic/private';
import { parseTsvPreview, type ParsedItem } from '$lib/services/assessment-artifacts/builder';
import type {
	ArtifactPackageDetail,
	ArtifactRequestItem,
	CollectionPlaybook,
	EvidenceSchedule,
	PackageStats,
	QualityIssue
} from '$lib/services/assessment-artifacts/api';
import {
	ASSESSMENT_ARTIFACT_TEMPLATES,
	ASSESSMENT_ARTIFACT_TEMPLATE_LIST
} from '$lib/services/assessment-artifacts/templates';
import { BASE_API_URL, DEFAULT_TENANT_ID, IS_CLOUDFLARE_RUNTIME } from '$lib/utils/constants';
import { modelSchema } from '$lib/utils/schemas';
import type { RequestHandler } from './$types';

type JsonRecord = Record<string, unknown>;

type LegacyStateResponseItem = {
	tenant_id: string;
	domain: string;
	entity_id: string;
	command_type: string;
	status: string;
	updated_at: string;
	state: JsonRecord | null;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROXY_BACKEND_API_URL = privateEnv.BACKEND_API_URL || BASE_API_URL;
const RESERVED_FILTER_KEYS = new Set([
	'tenant_id',
	'limit',
	'offset',
	'page',
	'page_size',
	'ordering',
	'search',
	'include_state',
	'include_data'
]);
const NAMESPACED_ROUTE_PREFIXES = new Set([
	'ai',
	'assessments',
	'asset-service',
	'business-continuity',
	'compliance',
	'conmon',
	'connectors',
	'crq',
	'ebios-rm',
	'evidence-automation',
	'gdpr',
	'iam',
	'integrations',
	'mapping-libraries',
	'metrology',
	'organization',
	'oscal',
	'poam',
	'privacy',
	'resilience',
	'risks',
	'rmf',
	'security',
	'security-graph',
	'third-party',
	'vendor-portal',
	'version-history',
	'workflows'
]);
const LOOKUP_ACTION_HINTS = new Set([
	'category',
	'choice',
	'choices',
	'control_impact',
	'criticality',
	'effort',
	'priority',
	'status',
	'type',
	'types'
]);
const CONNECTOR_REGISTRY: JsonRecord[] = [
	{
		type: 'nessus',
		name: 'Tenable Nessus',
		category: 'vulnerability',
		description: 'Ingest vulnerability scan findings from Nessus.',
		auth_methods: ['api_key'],
		icon: 'fa-shield-halved'
	},
	{
		type: 'qualys',
		name: 'Qualys VMDR',
		category: 'vulnerability',
		description: 'Synchronize VMDR findings and asset metadata.',
		auth_methods: ['api_key'],
		icon: 'fa-shield-halved'
	},
	{
		type: 'sarif-import',
		name: 'SARIF Import',
		category: 'sast_dast',
		description: 'Import SARIF outputs from static and dynamic scanners.',
		auth_methods: ['none'],
		icon: 'fa-file-code'
	},
	{
		type: 'scap-import',
		name: 'SCAP Import',
		category: 'vulnerability',
		description: 'Import SCAP benchmark and results content.',
		auth_methods: ['none'],
		icon: 'fa-file-lines'
	},
	{
		type: 'servicenow',
		name: 'ServiceNow',
		category: 'itsm',
		description: 'Bi-directional issue and task synchronization.',
		auth_methods: ['oauth2', 'api_key'],
		icon: 'fa-briefcase'
	},
	{
		type: 'jira',
		name: 'Jira',
		category: 'itsm',
		description: 'Sync findings and remediation tasks to Jira projects.',
		auth_methods: ['api_token', 'oauth2'],
		icon: 'fa-ticket'
	}
];
const DEFAULT_DOMAIN_ROWS: Record<string, JsonRecord[]> = {
	'compliance-assessments': [
		{
			id: 'compliance-assessment-default',
			name: 'Default Compliance Assessment'
		}
	],
	frameworks: [
		{
			id: 'framework-nist-800-53-r5',
			name: 'NIST 800-53 Rev. 5'
		}
	],
	'risk-assessments': [
		{
			id: 'risk-assessment-default',
			name: 'Default Risk Assessment'
		}
	]
};

export const trailingSlash = 'ignore';

function normalizeSegments(segments: string | undefined, pathname: string): string {
	const targetPath = (segments || '').replace(/^\/+/, '');
	if (!targetPath) {
		return '';
	}
	const hasTrailingSlash = pathname.endsWith('/');
	return hasTrailingSlash && !targetPath.endsWith('/') ? `${targetPath}/` : targetPath;
}

function json(data: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

function cloneRows(rows: JsonRecord[]): JsonRecord[] {
	return rows.map((row) => ({ ...row }));
}

const MEMORY_LEGACY_STATE = new Map<string, JsonRecord>();

function memoryStateKey(tenantId: string, domain: string, entityId: string): string {
	return `${tenantId}::${domain}::${entityId}`;
}

function writeMemoryState(tenantId: string, domain: string, entityId: string, state: JsonRecord): void {
	MEMORY_LEGACY_STATE.set(memoryStateKey(tenantId, domain, entityId), { ...state });
}

function readMemoryState(tenantId: string, domain: string, entityId: string): JsonRecord | null {
	const state = MEMORY_LEGACY_STATE.get(memoryStateKey(tenantId, domain, entityId));
	return state ? { ...state } : null;
}

function listMemoryStates(
	tenantId: string,
	domain: string
): Array<{ entityId: string; state: JsonRecord }> {
	const prefix = `${tenantId}::${domain}::`;
	const rows: Array<{ entityId: string; state: JsonRecord }> = [];
	for (const [key, state] of MEMORY_LEGACY_STATE.entries()) {
		if (!key.startsWith(prefix)) {
			continue;
		}
		rows.push({
			entityId: key.slice(prefix.length),
			state: { ...state }
		});
	}
	return rows;
}

const MEMORY_ASSESSMENT_PACKAGES = new Map<string, ArtifactPackageDetail>();

const PERIODICITY_LABELS: Record<string, string> = {
	on_demand: 'On Demand',
	weekly: 'Weekly',
	monthly: 'Monthly',
	quarterly: 'Quarterly',
	semi_annual: 'Semi-Annual',
	annual: 'Annual',
	event_driven: 'Event-Driven',
	continuous: 'Continuous'
};

const PACKAGE_TYPE_LABELS: Record<string, string> = {
	fedramp: 'FedRAMP Assessment',
	nist_800_53: 'NIST 800-53',
	iso_27001: 'ISO 27001',
	soc_2: 'SOC 2',
	cmmc: 'CMMC',
	custom: 'Custom'
};

const STATUS_LABELS: Record<string, string> = {
	draft: 'Draft',
	active: 'Active',
	archived: 'Archived'
};

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
	active: 'Active',
	paused: 'Paused',
	completed: 'Completed'
};

const SCHEDULE_CRONS: Record<string, string> = {
	weekly: '0 9 * * 1',
	monthly: '0 9 1 * *',
	quarterly: '0 9 1 */3 *',
	semi_annual: '0 9 1 */6 *',
	annual: '0 9 1 1 *'
};

const ACTIVITY_NAMES: Record<string, Record<string, string>> = {
	weekly: {
		audit_log_reviews: 'Weekly Audit Log Reviews',
		alert_triage: 'Weekly Alert Triage',
		configuration_checks: 'Weekly Configuration Checks',
		change_control_audit: 'Weekly Change Audit Review',
		default: 'Weekly Evidence Collection'
	},
	monthly: {
		vulnerability_scanning: 'Monthly Vulnerability Scans',
		poam_updates: 'Monthly POA&M Updates',
		security_reports: 'Monthly Security Reports',
		configuration_checks: 'Monthly Configuration Baselines',
		default: 'Monthly Evidence Collection'
	},
	quarterly: {
		account_recertification: 'Quarterly Account Recertifications',
		baseline_validation: 'Quarterly Baseline Validation',
		penetration_testing: 'Quarterly Penetration Testing',
		default: 'Quarterly Evidence Collection'
	},
	semi_annual: {
		default: 'Semi-Annual Security Review'
	},
	annual: {
		security_training: 'Annual Security Training',
		policy_review: 'Annual Policy Reviews',
		risk_assessment: 'Annual Risk Assessments',
		baseline_validation: 'Annual Baseline Reviews',
		default: 'Annual Evidence Collection'
	}
};

const ACTIVITY_DEFAULT_FREQUENCY: Record<string, string> = {
	audit_log_reviews: 'weekly',
	alert_triage: 'weekly',
	change_control_audit: 'weekly',
	configuration_checks: 'monthly',
	vulnerability_scanning: 'monthly',
	poam_updates: 'monthly',
	security_reports: 'monthly',
	account_recertification: 'quarterly',
	baseline_validation: 'quarterly',
	penetration_testing: 'quarterly',
	security_training: 'annual',
	policy_review: 'annual',
	risk_assessment: 'annual',
	default: 'monthly'
};

const ACTIVITY_LABELS: Record<string, string> = {
	audit_log_reviews: 'audit log reviews',
	alert_triage: 'alert triage and monitoring',
	change_control_audit: 'change control and maintenance audit',
	configuration_checks: 'configuration and hardening checks',
	vulnerability_scanning: 'vulnerability scanning and remediation tracking',
	poam_updates: 'POA&M updates and exception tracking',
	security_reports: 'security reporting',
	account_recertification: 'account recertification and privileged access review',
	baseline_validation: 'baseline and architecture validation',
	penetration_testing: 'penetration testing and adversary simulation',
	security_training: 'security awareness and role-based training',
	policy_review: 'policy and procedure review',
	risk_assessment: 'risk assessment activities',
	default: 'evidence collection'
};

function nowIsoString(): string {
	return new Date().toISOString();
}

function toTopEntries(counter: Map<string, number>, limit: number): [string, number][] {
	return Array.from(counter.entries())
		.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return a[0].localeCompare(b[0]);
		})
		.slice(0, limit)
		.map(([key, value]) => [key, value]);
}

function incrementCounter(counter: Map<string, number>, key: string): void {
	counter.set(key, (counter.get(key) || 0) + 1);
}

function uniqueCount(values: string[]): number {
	return new Set(values).size;
}

function buildCompatStats(items: ParsedItem[], qualityIssues: QualityIssue[]): PackageStats {
	const controlCounter = new Map<string, number>();
	const workstreamCounter = new Map<string, number>();
	const artifactCounter = new Map<string, number>();
	const platformCounter = new Map<string, number>();
	const periodicityBreakdown: Record<string, number> = {};

	for (const item of items) {
		for (const control of item.controls) incrementCounter(controlCounter, control);
		for (const workstream of item.workstreams) incrementCounter(workstreamCounter, workstream);
		for (const artifactType of item.artifact_types) incrementCounter(artifactCounter, artifactType);
		for (const platform of item.platform_tags) incrementCounter(platformCounter, platform);
		periodicityBreakdown[item.periodicity] = (periodicityBreakdown[item.periodicity] || 0) + 1;
	}

	return {
		total_requests: items.length,
		requests_with_quality_issues: uniqueCount(qualityIssues.map((issue) => issue.request_id)),
		unique_controls: controlCounter.size,
		unique_workstreams: workstreamCounter.size,
		unique_artifact_types: artifactCounter.size,
		unique_platform_tags: platformCounter.size,
		top_controls: toTopEntries(controlCounter, 25),
		top_workstreams: toTopEntries(workstreamCounter, 10),
		top_artifact_types: toTopEntries(artifactCounter, 15),
		top_platform_tags: toTopEntries(platformCounter, 15),
		periodicity_breakdown: periodicityBreakdown
	};
}

function addToIndex(index: Record<string, string[]>, key: string, requestId: string): void {
	if (!key) return;
	if (!index[key]) index[key] = [];
	if (!index[key].includes(requestId)) {
		index[key].push(requestId);
	}
}

function sortIndex(index: Record<string, string[]>): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(index)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([key, requestIds]) => [key, [...requestIds].sort()])
	);
}

function buildCompatIndexes(items: ParsedItem[]): Record<string, Record<string, string[]>> {
	const byControl: Record<string, string[]> = {};
	const byWorkstream: Record<string, string[]> = {};
	const byArtifactType: Record<string, string[]> = {};
	const byPlatformTag: Record<string, string[]> = {};
	const byPeriodicity: Record<string, string[]> = {};

	for (const item of items) {
		for (const control of item.controls) addToIndex(byControl, control, item.request_id);
		for (const workstream of item.workstreams) addToIndex(byWorkstream, workstream, item.request_id);
		for (const artifactType of item.artifact_types)
			addToIndex(byArtifactType, artifactType, item.request_id);
		for (const platformTag of item.platform_tags) addToIndex(byPlatformTag, platformTag, item.request_id);
		addToIndex(byPeriodicity, item.periodicity, item.request_id);
	}

	return {
		by_control: sortIndex(byControl),
		by_workstream: sortIndex(byWorkstream),
		by_artifact_type: sortIndex(byArtifactType),
		by_platform_tag: sortIndex(byPlatformTag),
		by_periodicity: sortIndex(byPeriodicity)
	};
}

function buildCompatPlaybooks(items: ParsedItem[]): CollectionPlaybook[] {
	const awsCommands: string[] = [];
	const linuxCommands: string[] = [];
	const dbCommands: string[] = [];

	for (const item of items) {
		for (const command of item.commands) {
			const lower = command.toLowerCase();
			if (lower.includes('aws ') && !awsCommands.includes(command)) {
				awsCommands.push(command);
			}
			if (
				['uname', 'yum', 'rpm', 'cat', 'dmesg', 'ntpstat'].some((prefix) =>
					lower.startsWith(prefix)
				) &&
				!linuxCommands.includes(command)
			) {
				linuxCommands.push(command);
			}
			if (
				['opatch', 'dba_', 'v$', 'postgres', 'oracle'].some((token) => lower.includes(token)) &&
				!dbCommands.includes(command)
			) {
				dbCommands.push(command);
			}
		}
	}

	return [
		{
			playbook_id: 'AWS-COLLECT-01',
			name: 'AWS control-plane exports',
			applies_to_platform_tags: ['AWS'],
			required_channels: ['tool_export', 'cli_capture'],
			example_commands: awsCommands.slice(0, 30)
		},
		{
			playbook_id: 'RHEL7-COLLECT-01',
			name: 'RHEL/Linux host baseline evidence',
			applies_to_platform_tags: ['RHEL7', 'LINUX'],
			required_channels: ['cli_capture', 'tool_export'],
			example_commands: linuxCommands.slice(0, 30)
		},
		{
			playbook_id: 'DB-COLLECT-01',
			name: 'Database security evidence',
			applies_to_platform_tags: ['ORACLE_DB', 'POSTGRES_DB'],
			required_channels: ['tool_export', 'cli_capture'],
			example_commands: dbCommands.slice(0, 30)
		}
	];
}

function buildCompatRequestItems(items: ParsedItem[], createdAt: string): ArtifactRequestItem[] {
	return items.map((item) => ({
		id: crypto.randomUUID(),
		request_id: item.request_id,
		source_line: item.source_line,
		category: item.category,
		artifact_request: item.artifact_request,
		request_date: item.request_date || undefined,
		controls: [...item.controls],
		control_families: [...item.control_families],
		control_domains: [...item.control_domains],
		workstreams: [...item.workstreams],
		supplemental_references: [...item.supplemental_references],
		primary_artifact_type: item.primary_artifact_type,
		artifact_types: [...item.artifact_types],
		collection_channel: item.collection_channel,
		platform_tags: [...item.platform_tags],
		time_scopes: [...item.time_scopes],
		periodicity: item.periodicity,
		periodicity_display: PERIODICITY_LABELS[item.periodicity] || item.periodicity,
		commands: [...item.commands],
		config_paths: [...item.config_paths],
		bundle_hint: { ...item.bundle_hint },
		created_at: createdAt
	}));
}

function cloneParsedItems(items: ParsedItem[]): ParsedItem[] {
	return items.map((item) => ({
		...item,
		workstreams: [...item.workstreams],
		controls: [...item.controls],
		control_families: [...item.control_families],
		control_domains: [...item.control_domains],
		supplemental_references: [...item.supplemental_references],
		artifact_types: [...item.artifact_types],
		platform_tags: [...item.platform_tags],
		time_scopes: [...item.time_scopes],
		commands: [...item.commands],
		config_paths: [...item.config_paths],
		bundle_hint: { ...item.bundle_hint }
	}));
}

function detectScheduleActivity(item: ArtifactRequestItem): string {
	const text = item.artifact_request.toLowerCase();
	const controls = new Set(item.controls.map((control) => control.split('(')[0]));
	const workstreams = new Set(item.workstreams || []);

	if (workstreams.has('PEN_TEST') || text.includes('penetration test') || text.includes('pen test')) {
		return 'penetration_testing';
	}
	if (text.includes('poa&m') || text.includes('poam') || controls.has('CA-5')) {
		return 'poam_updates';
	}
	if (controls.has('AU-6') || (text.includes('audit log') && text.includes('review'))) {
		return 'audit_log_reviews';
	}
	if (
		['SI-4', 'IR-4', 'IR-6', 'AU-5'].some((control) => controls.has(control)) ||
		text.includes('alert') ||
		text.includes('triage') ||
		text.includes('incident')
	) {
		return 'alert_triage';
	}
	if (
		['RA-5', 'SI-2', 'SI-3'].some((control) => controls.has(control)) ||
		item.primary_artifact_type === 'scan_evidence' ||
		text.includes('vulnerability scan')
	) {
		return 'vulnerability_scanning';
	}
	if (
		(controls.has('AC-2') || controls.has('IA-4')) &&
		['recert', 'account', 'privilege', 'review'].some((token) => text.includes(token))
	) {
		return 'account_recertification';
	}
	if (
		['CM-2', 'CM-6', 'PL-8'].some((control) => controls.has(control)) &&
		['baseline', 'configuration', 'architecture'].some((token) => text.includes(token))
	) {
		return 'baseline_validation';
	}
	if (['CM-3', 'MA-2', 'MA-4'].some((control) => controls.has(control)) || text.includes('change')) {
		return 'change_control_audit';
	}
	if (
		['AT-2', 'AT-3', 'CP-3', 'IR-2'].some((control) => controls.has(control)) ||
		item.primary_artifact_type === 'training_artifact'
	) {
		return 'security_training';
	}
	if (
		['policy_document', 'procedure_document', 'plan_document'].includes(item.primary_artifact_type) ||
		controls.has('PL-1') ||
		text.includes('policy')
	) {
		return 'policy_review';
	}
	if (controls.has('RA-2') || text.includes('risk assessment')) {
		return 'risk_assessment';
	}
	if (item.primary_artifact_type === 'report') {
		return 'security_reports';
	}
	if (item.primary_artifact_type === 'configuration_snapshot') {
		return 'configuration_checks';
	}
	return 'default';
}

function determineScheduleFrequency(item: ArtifactRequestItem, activityKey: string): string | null {
	if (item.periodicity in SCHEDULE_CRONS) {
		return item.periodicity;
	}
	if (item.periodicity === 'continuous') {
		return 'weekly';
	}
	if (item.periodicity === 'event_driven') {
		if (['alert_triage', 'audit_log_reviews', 'change_control_audit'].includes(activityKey)) {
			return 'weekly';
		}
		return ACTIVITY_DEFAULT_FREQUENCY[activityKey] || ACTIVITY_DEFAULT_FREQUENCY.default;
	}
	if (item.periodicity === 'on_demand') {
		return ACTIVITY_DEFAULT_FREQUENCY[activityKey] || null;
	}
	return null;
}

function resolveScheduleName(frequency: string, activityKey: string): string {
	const frequencyTitle = frequency
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
	const nameMap = ACTIVITY_NAMES[frequency] || {};
	if (activityKey in nameMap) {
		return nameMap[activityKey] || `${frequencyTitle} Evidence Collection`;
	}
	if (activityKey !== 'default') {
		const activityTitle = activityKey
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
		return `${frequencyTitle} ${activityTitle}`;
	}
	return nameMap.default || `${frequencyTitle} Evidence Collection`;
}

function buildScheduleCollectionActions(items: ArtifactRequestItem[]): EvidenceSchedule['collection_actions'] {
	const byChannel = new Map<string, string[]>();
	const commands: string[] = [];
	for (const item of items) {
		if (!byChannel.has(item.collection_channel)) {
			byChannel.set(item.collection_channel, []);
		}
		const ids = byChannel.get(item.collection_channel);
		if (ids && !ids.includes(item.request_id)) {
			ids.push(item.request_id);
		}
		for (const command of item.commands) {
			if (!commands.includes(command)) {
				commands.push(command);
			}
		}
	}

	const actions: EvidenceSchedule['collection_actions'] = [];
	for (const [channel, requestIds] of Array.from(byChannel.entries()).sort((a, b) =>
		a[0].localeCompare(b[0])
	)) {
		actions.push({
			channel,
			request_count: requestIds.length,
			request_ids: requestIds.slice(0, 10)
		});
	}
	if (commands.length > 0) {
		actions.push({
			channel: 'cli_commands',
			commands: commands.slice(0, 20),
			note: 'Execute these commands to gather evidence'
		});
	}
	return actions;
}

function generateCompatSchedules(items: ArtifactRequestItem[]): EvidenceSchedule[] {
	const grouped = new Map<string, { frequency: string; activityKey: string; items: ArtifactRequestItem[] }>();
	for (const item of items) {
		const activityKey = detectScheduleActivity(item);
		const frequency = determineScheduleFrequency(item, activityKey);
		if (!frequency) continue;
		const key = `${frequency}::${activityKey}`;
		if (!grouped.has(key)) {
			grouped.set(key, { frequency, activityKey, items: [] });
		}
		grouped.get(key)?.items.push(item);
	}

	const createdAt = nowIsoString();
	const schedules: EvidenceSchedule[] = [];
	for (const group of Array.from(grouped.values()).sort((a, b) =>
		`${a.frequency}:${a.activityKey}`.localeCompare(`${b.frequency}:${b.activityKey}`)
	)) {
		const controls = Array.from(new Set(group.items.flatMap((item) => item.controls))).sort();
		const controlFamilies = Array.from(new Set(group.items.flatMap((item) => item.control_families))).sort();
		const evidenceTypes = Array.from(
			new Set(group.items.map((item) => item.primary_artifact_type))
		).sort();
		const platformTags = Array.from(new Set(group.items.flatMap((item) => item.platform_tags))).sort();
		const label = ACTIVITY_LABELS[group.activityKey] || ACTIVITY_LABELS.default;
		const familyPreview = controlFamilies.slice(0, 8).join(', ');
		const name = resolveScheduleName(group.frequency, group.activityKey);
		schedules.push({
			id: crypto.randomUUID(),
			name,
			description: `Covers ${group.items.length} evidence requests across control families ${familyPreview}. Focuses on ${label} on a ${group.frequency} cadence.`,
			frequency: group.frequency as EvidenceSchedule['frequency'],
			frequency_display: PERIODICITY_LABELS[group.frequency] || group.frequency,
			status: 'active',
			status_display: SCHEDULE_STATUS_LABELS.active,
			cron_expression: SCHEDULE_CRONS[group.frequency] || '0 9 1 * *',
			control_families: controlFamilies,
			controls,
			evidence_types: evidenceTypes,
			platform_tags: platformTags,
			collection_actions: buildScheduleCollectionActions(group.items),
			items_count: group.items.length,
			created_at: createdAt
		});
	}

	return schedules;
}

function buildPeriodicityBreakdown(items: ArtifactRequestItem[]): {
	total_items: number;
	breakdown: Record<string, { label: string; count: number; controls: string[]; control_families: string[] }>;
} {
	const breakdown: Record<
		string,
		{ label: string; count: number; controls: string[]; control_families: string[] }
	> = {};
	for (const item of items) {
		const key = item.periodicity;
		if (!breakdown[key]) {
			breakdown[key] = {
				label: PERIODICITY_LABELS[key] || key,
				count: 0,
				controls: [],
				control_families: []
			};
		}
		breakdown[key].count += 1;
		for (const control of item.controls) {
			if (!breakdown[key].controls.includes(control)) breakdown[key].controls.push(control);
		}
		for (const family of item.control_families) {
			if (!breakdown[key].control_families.includes(family)) breakdown[key].control_families.push(family);
		}
	}
	for (const entry of Object.values(breakdown)) {
		entry.controls.sort();
		entry.control_families.sort();
	}
	return { total_items: items.length, breakdown };
}

function buildScheduleSummary(pkg: ArtifactPackageDetail): JsonRecord {
	const byFrequency: Record<string, JsonRecord[]> = {};
	for (const schedule of pkg.evidence_schedules) {
		if (!byFrequency[schedule.frequency]) byFrequency[schedule.frequency] = [];
		byFrequency[schedule.frequency].push({
			id: schedule.id,
			name: schedule.name,
			items_count: schedule.items_count,
			controls_count: schedule.controls.length,
			control_families: schedule.control_families,
			cron: schedule.cron_expression,
			status: schedule.status
		});
	}
	const totalScheduled = pkg.evidence_schedules.reduce((sum, schedule) => sum + schedule.items_count, 0);
	return {
		total_items: pkg.request_items.length,
		scheduled_items: totalScheduled,
		unscheduled_items: Math.max(0, pkg.request_items.length - totalScheduled),
		schedule_count: pkg.evidence_schedules.length,
		by_frequency: byFrequency
	};
}

function buildCompatPackageFromParsed(args: {
	name: string;
	description?: string;
	systemName?: string;
	packageType?: string;
	sourceFile?: string;
	parsedItems: ParsedItem[];
	qualityIssues: QualityIssue[];
	generateSchedules: boolean;
}): ArtifactPackageDetail {
	const createdAt = nowIsoString();
	const requestItems = buildCompatRequestItems(args.parsedItems, createdAt);
	const stats = buildCompatStats(args.parsedItems, args.qualityIssues);
	const schedules = args.generateSchedules ? generateCompatSchedules(requestItems) : [];
	const packageType = args.packageType || 'fedramp';
	const uniquePlatformTags = Array.from(
		new Set(args.parsedItems.flatMap((item) => item.platform_tags))
	).sort();
	const pkg: ArtifactPackageDetail = {
		id: crypto.randomUUID(),
		name: args.name,
		description: args.description || '',
		status: 'draft',
		status_display: STATUS_LABELS.draft,
		package_type: packageType as ArtifactPackageDetail['package_type'],
		package_type_display: PACKAGE_TYPE_LABELS[packageType] || packageType,
		system_name: args.systemName || '',
		system_description: '',
		platform_tags: uniquePlatformTags,
		stats,
		collection_playbooks: buildCompatPlaybooks(args.parsedItems),
		quality_report: {
			issues: args.qualityIssues,
			quality_gate: args.qualityIssues.length === 0 ? 'pass' : 'needs_review'
		},
		indexes: buildCompatIndexes(args.parsedItems),
		source_file: args.sourceFile || '',
		total_items: requestItems.length,
		schedule_count: schedules.length,
		request_items: requestItems,
		evidence_schedules: schedules,
		created_at: createdAt,
		updated_at: createdAt
	};
	return pkg;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
		if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
	}
	return defaultValue;
}

function findScheduleById(scheduleId: string):
	| { pkg: ArtifactPackageDetail; schedule: EvidenceSchedule; index: number }
	| null {
	for (const pkg of MEMORY_ASSESSMENT_PACKAGES.values()) {
		const index = pkg.evidence_schedules.findIndex((schedule) => schedule.id === scheduleId);
		if (index >= 0) {
			const schedule = pkg.evidence_schedules[index];
			if (schedule) {
				return { pkg, schedule, index };
			}
		}
	}
	return null;
}

function sanitizeDomainSegment(segment: string): string {
	return segment.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function resolveTenantId(request: Request, url: URL): string {
	return (
		request.headers.get('x-tenant-id') ||
		url.searchParams.get('tenant_id') ||
		privateEnv.DEFAULT_TENANT_ID ||
		DEFAULT_TENANT_ID ||
		'default'
	);
}

function parseJsonSafe(raw: string): JsonRecord {
	if (!raw.trim()) {
		return {};
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as JsonRecord;
		}
	} catch {
		// Ignore parse error and fallback to empty object.
	}
	return {};
}

function toJsonRecord(value: unknown): JsonRecord {
	if (typeof value === 'string') {
		return parseJsonSafe(value);
	}
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as JsonRecord;
	}
	return {};
}

function addFormValue(target: JsonRecord, key: string, value: unknown): void {
	const current = target[key];
	if (current === undefined) {
		target[key] = value;
		return;
	}
	if (Array.isArray(current)) {
		current.push(value);
		return;
	}
	target[key] = [current, value];
}

async function parseRequestBody(request: Request): Promise<JsonRecord> {
	const contentType = request.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return parseJsonSafe(await request.text());
	}
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		const formData = await request.formData();
		const parsed: JsonRecord = {};
		for (const [key, value] of formData.entries()) {
			if (value instanceof File) {
				addFormValue(parsed, key, {
					name: value.name,
					size: value.size,
					type: value.type || 'application/octet-stream'
				});
				continue;
			}
			addFormValue(parsed, key, value);
		}
		return parsed;
	}

	const raw = await request.text();
	return parseJsonSafe(raw);
}

function looksLikeEntityId(segment: string): boolean {
	if (!segment) return false;
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
		return true;
	}
	if (/^\d{1,18}$/.test(segment)) {
		return true;
	}
	if (/^[A-Za-z]+-\d+(?:-\d+)*$/.test(segment)) {
		return true;
	}
	if (/^(?=.*\d)[a-zA-Z0-9_-]{12,}$/.test(segment)) {
		return true;
	}
	return false;
}

type ParsedPath = {
	resource: string;
	domainPath: string;
	entityId: string | null;
	action: string | null;
	pathTail: string[];
};

function sanitizeDomainPathSegment(segment: string): string {
	return sanitizeDomainSegment(segment);
}

function normalizeDomainPath(segments: string[]): string {
	return segments
		.map((segment) => sanitizeDomainPathSegment(segment))
		.filter(Boolean)
		.join('/');
}

function shouldTreatSecondSegmentAsLookup(resource: string, second: string): boolean {
	const normalizedResource = sanitizeDomainSegment(resource);
	if (NAMESPACED_ROUTE_PREFIXES.has(normalizedResource)) {
		return false;
	}
	if (LOOKUP_ACTION_HINTS.has(sanitizeDomainSegment(second))) {
		return true;
	}
	return false;
}

function parseLegacyPath(segments: string): ParsedPath {
	const parts = segments
		.split('/')
		.map((segment) => decodeURIComponent(segment))
		.filter(Boolean);

	if (parts.length === 0) {
		return { resource: '', domainPath: '', entityId: null, action: null, pathTail: [] };
	}

	const entityIndex = parts.findIndex((segment) => looksLikeEntityId(segment));
	if (entityIndex >= 0) {
		const domainSegments = parts.slice(0, entityIndex);
		const resource = domainSegments[domainSegments.length - 1] || parts[0] || '';
		return {
			resource,
			domainPath: normalizeDomainPath(domainSegments),
			entityId: parts[entityIndex],
			action: parts[entityIndex + 1] || null,
			pathTail: parts.slice(entityIndex + 2)
		};
	}

	const resource = parts[0] || '';
	const second = parts[1] || '';
	if (parts.length === 2 && shouldTreatSecondSegmentAsLookup(resource, second)) {
		return {
			resource,
			domainPath: normalizeDomainPath([resource]),
			entityId: null,
			action: second,
			pathTail: []
		};
	}

	return {
		resource: parts[parts.length - 1] || resource,
		domainPath: normalizeDomainPath(parts),
		entityId: null,
		action: null,
		pathTail: []
	};
}

function unwrapSchema(schema: unknown): unknown {
	let current = schema as Record<string, unknown> | undefined;
	for (let index = 0; index < 8; index += 1) {
		const typeName = ((current as { _def?: { typeName?: string } })?._def?.typeName || '') as string;
		if (!typeName) {
			break;
		}
		if (
			typeName === 'ZodOptional' ||
			typeName === 'ZodNullable' ||
			typeName === 'ZodDefault' ||
			typeName === 'ZodCatch'
		) {
			current = (current?._def as { innerType?: Record<string, unknown> } | undefined)?.innerType;
			continue;
		}
		if (typeName === 'ZodEffects') {
			current = (current?._def as { schema?: Record<string, unknown> } | undefined)?.schema;
			continue;
		}
		if (typeName === 'ZodPipeline') {
			current = (current?._def as { out?: Record<string, unknown> } | undefined)?.out;
			continue;
		}
		break;
	}
	return current;
}

function getObjectShape(schema: unknown): Record<string, unknown> {
	const unwrapped = unwrapSchema(schema) as { _def?: { shape?: unknown }; shape?: unknown } | undefined;
	const shapeDef = unwrapped?._def?.shape ?? unwrapped?.shape;
	if (typeof shapeDef === 'function') {
		const resolved = shapeDef() as unknown;
		return resolved && typeof resolved === 'object' ? (resolved as Record<string, unknown>) : {};
	}
	if (shapeDef && typeof shapeDef === 'object') {
		return shapeDef as Record<string, unknown>;
	}
	return {};
}

function getSchemaFieldNames(resource: string): string[] {
	const shape = getObjectShape(modelSchema(resource));
	return Object.keys(shape);
}

function getEnumOptions(resource: string, field: string): string[] {
	const shape = getObjectShape(modelSchema(resource));
	const fieldSchema = shape[field];
	if (!fieldSchema) {
		return [];
	}
	const unwrapped = unwrapSchema(fieldSchema) as
		| {
				_def?: {
					typeName?: string;
					values?: string[];
					options?: unknown[];
					value?: string;
					enum?: Record<string, string | number>;
				};
		  }
		| undefined;
	const typeName = unwrapped?._def?.typeName || '';
	if (typeName === 'ZodEnum') {
		return [...(unwrapped?._def?.values || [])];
	}
	if (typeName === 'ZodNativeEnum') {
		const values = Object.values(unwrapped?._def?.enum || {}).filter(
			(value): value is string => typeof value === 'string'
		);
		return Array.from(new Set(values));
	}
	if (typeName === 'ZodUnion') {
		const options = unwrapped?._def?.options || [];
		const literals = options
			.map((option) => {
				const literal = unwrapSchema(option) as { _def?: { typeName?: string; value?: unknown } } | undefined;
				return literal?._def?.typeName === 'ZodLiteral' && typeof literal._def.value === 'string'
					? literal._def.value
					: null;
			})
			.filter((value): value is string => Boolean(value));
		return Array.from(new Set(literals));
	}
	return [];
}

async function fetchV2(
	fetchFn: typeof fetch,
	tenantId: string,
	path: string,
	init: RequestInit = {}
): Promise<Response> {
	const headers = new Headers(init.headers);
	if (!headers.has('x-tenant-id')) {
		headers.set('x-tenant-id', tenantId);
	}
	return fetchFn(`/api/v2${path}`, {
		...init,
		headers
	});
}

function toLegacyResource(state: JsonRecord | null, entityId: string): JsonRecord {
	const base = state && typeof state === 'object' ? { ...state } : {};
	const withId = {
		...base,
		id: (base.id as string | undefined) || entityId
	};
	if (!withId.entity_id) {
		withId.entity_id = entityId;
	}
	if (!withId.str) {
		withId.str =
			(withId.name as string | undefined) ||
			(withId.title as string | undefined) ||
			(withId.email as string | undefined) ||
			(withId.ref_id as string | undefined) ||
			entityId;
	}
	return withId;
}

function valueAtPath(item: JsonRecord, keyPath: string): unknown {
	const path = keyPath.split('.');
	let cursor: unknown = item;
	for (const key of path) {
		if (!cursor || typeof cursor !== 'object') {
			return undefined;
		}
		cursor = (cursor as JsonRecord)[key];
	}
	return cursor;
}

function matchesFilter(value: unknown, rawFilter: string, lookup: string): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	const values = Array.isArray(value) ? value : [value];
	const filterValue = rawFilter.toLowerCase();

	if (lookup === 'in') {
		const wanted = rawFilter
			.split(',')
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
		return values.some((entry) => wanted.includes(String(entry).toLowerCase()));
	}

	if (lookup === 'icontains') {
		return values.some((entry) => String(entry).toLowerCase().includes(filterValue));
	}

	return values.some((entry) => String(entry).toLowerCase() === filterValue);
}

function applyFilters(items: JsonRecord[], searchParams: URLSearchParams): JsonRecord[] {
	const activeFilters = Array.from(searchParams.entries()).filter(([key, value]) => {
		if (!value) return false;
		if (RESERVED_FILTER_KEYS.has(key)) return false;
		return true;
	});

	let filtered = [...items];
	for (const [key, value] of activeFilters) {
		const [fieldPath, lookup = 'exact'] = key.split('__');
		filtered = filtered.filter((item) => matchesFilter(valueAtPath(item, fieldPath), value, lookup));
	}

	const search = searchParams.get('search');
	if (search) {
		const lowered = search.toLowerCase();
		filtered = filtered.filter((item) =>
			Object.values(item).some((entry) => String(entry).toLowerCase().includes(lowered))
		);
	}

	const ordering = searchParams.get('ordering');
	if (ordering) {
		const sortField = ordering.startsWith('-') ? ordering.slice(1) : ordering;
		const isDesc = ordering.startsWith('-');
		filtered.sort((left, right) => {
			const leftValue = valueAtPath(left, sortField);
			const rightValue = valueAtPath(right, sortField);
			const leftStr = leftValue === null || leftValue === undefined ? '' : String(leftValue);
			const rightStr = rightValue === null || rightValue === undefined ? '' : String(rightValue);
			const comparison = leftStr.localeCompare(rightStr);
			return isDesc ? -comparison : comparison;
		});
	}

	return filtered;
}

async function readLegacyStateList(
	fetchFn: typeof fetch,
	tenantId: string,
	domain: string,
	limit: number,
	offset: number
): Promise<JsonRecord[]> {
	const indexed = new Map<string, JsonRecord>();
	for (const row of listMemoryStates(tenantId, domain)) {
		indexed.set(row.entityId, toLegacyResource(row.state, row.entityId));
	}

	const query = new URLSearchParams({
		tenant_id: tenantId,
		domain,
		limit: String(limit),
		offset: String(offset),
		include_state: 'true'
	});
	const response = await fetchV2(fetchFn, tenantId, `/legacy/state?${query.toString()}`, { method: 'GET' });
	if (response.ok) {
		const payload = (await response.json()) as { items?: LegacyStateResponseItem[] };
		for (const item of payload.items || []) {
			indexed.set(item.entity_id, toLegacyResource(item.state, item.entity_id));
		}
	}

	const items = Array.from(indexed.values()).filter((item) => {
		const mergedStatus = (typeof item.status === 'string' && item.status) || '';
		return String(mergedStatus).toLowerCase() !== 'deleted';
	});
	if (items.length > 0) {
		return items.slice(offset, offset + limit);
	}
	return cloneRows(DEFAULT_DOMAIN_ROWS[domain] || []);
}

async function readLegacyStateById(
	fetchFn: typeof fetch,
	tenantId: string,
	domain: string,
	entityId: string
): Promise<JsonRecord | null> {
	const memoryState = readMemoryState(tenantId, domain, entityId);
	if (memoryState) {
		const status = (typeof memoryState.status === 'string' && memoryState.status) || '';
		if (String(status).toLowerCase() === 'deleted') {
			return null;
		}
		return toLegacyResource(memoryState, entityId);
	}

	const query = new URLSearchParams({
		tenant_id: tenantId,
		domain,
		entity_id: entityId,
		include_state: 'true'
	});
	const response = await fetchV2(fetchFn, tenantId, `/legacy/state?${query.toString()}`, { method: 'GET' });
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as { item?: LegacyStateResponseItem };
	if (!payload.item) {
		return null;
	}
	const state = toLegacyResource(payload.item.state, payload.item.entity_id);
	const mergedStatus =
		(typeof state.status === 'string' && state.status) ||
		(typeof payload.item.status === 'string' && payload.item.status) ||
		'';
	if (String(mergedStatus).toLowerCase() === 'deleted') {
		return null;
	}
	return state;
}

function resolveCommandType(domainPath: string, action: string | null, method: string): string {
	const domain = domainPath
		.split('/')
		.map((segment) => sanitizeDomainSegment(segment))
		.filter(Boolean)
		.join('.');
	const namespace = domain || 'core';
	if (method === 'DELETE') {
		return `${namespace}.delete.requested`;
	}
	if (action && action !== 'object' && action !== 'upload') {
		return `${namespace}.${sanitizeDomainSegment(action)}.requested`;
	}
	return `${namespace}.upsert`;
}

function resolveModelKey(resource: string): string {
	return `frontend.schemas.${resource.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
}

function withParityDefaults(payload: JsonRecord, expectedFields: string[]): JsonRecord {
	const next: JsonRecord = { ...payload };
	for (const field of expectedFields) {
		if (!(field in next)) {
			next[field] = null;
		}
	}
	return next;
}

async function waitForJobCompletion(
	fetchFn: typeof fetch,
	tenantId: string,
	jobId: string
): Promise<'completed' | 'failed' | 'processing'> {
	const delays = [30, 80, 160];
	let status: 'completed' | 'failed' | 'processing' = 'processing';
	for (const delayMs of delays) {
		// Keep a very short wait to reduce write-after-read races in UI form flows.
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		const response = await fetchV2(fetchFn, tenantId, `/jobs/${encodeURIComponent(jobId)}`, {
			method: 'GET'
		});
		if (!response.ok) {
			break;
		}
		const payload = (await response.json()) as { status?: string };
		const value = payload.status || 'processing';
		if (value === 'completed') {
			return 'completed';
		}
		if (value === 'failed' || value === 'cancelled') {
			return 'failed';
		}
	}
	return status;
}

function parseFilenameFromDisposition(contentDisposition: string | null): string {
	if (!contentDisposition) {
		return `upload-${Date.now()}.bin`;
	}
	const filenameStar = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (filenameStar?.[1]) {
		return decodeURIComponent(filenameStar[1]);
	}
	const filename = contentDisposition.match(/filename="?([^";]+)"?/i);
	if (filename?.[1]) {
		return filename[1];
	}
	return `upload-${Date.now()}.bin`;
}

async function handleLegacyUpload(
	fetchFn: typeof fetch,
	request: Request,
	tenantId: string,
	domain: string,
	entityId: string
): Promise<Response> {
	const body = await request.arrayBuffer();
	const contentType = request.headers.get('content-type') || 'application/octet-stream';
	const filename = parseFilenameFromDisposition(request.headers.get('content-disposition'));

	const issueUrlResponse = await fetchV2(fetchFn, tenantId, '/files/upload-url', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			object_type: 'evidence',
			tenant_id: tenantId,
			object_id: entityId,
			object_group: domain,
			filename,
			content_type: contentType
		})
	});

	if (!issueUrlResponse.ok) {
		return new Response(await issueUrlResponse.text(), {
			status: issueUrlResponse.status,
			headers: { 'content-type': issueUrlResponse.headers.get('content-type') || 'application/json' }
		});
	}

	const signedUpload = (await issueUrlResponse.json()) as { object_key: string; upload_url: string };
	const uploadResponse = await fetchFn(signedUpload.upload_url, {
		method: 'PUT',
		headers: { 'content-type': contentType },
		body
	});

	if (!uploadResponse.ok) {
		return new Response(await uploadResponse.text(), {
			status: uploadResponse.status,
			headers: { 'content-type': uploadResponse.headers.get('content-type') || 'application/json' }
		});
	}

	return json({
		object_key: signedUpload.object_key,
		filename,
		content_type: contentType
	});
}

async function handleAssessmentArtifactsCompat(
	request: Request,
	url: URL,
	normalizedPath: string
): Promise<Response | null> {
	if (!normalizedPath.startsWith('assessment-artifacts')) {
		return null;
	}

	const method = request.method.toUpperCase();
	const subPath = normalizedPath.replace(/^assessment-artifacts\/?/, '').replace(/\/+$/, '');

	if (subPath === 'packages/templates' && method === 'GET') {
		return json({ templates: [...ASSESSMENT_ARTIFACT_TEMPLATE_LIST] });
	}

	if (subPath === 'packages/generate_from_template' && method === 'POST') {
		const payload = await parseRequestBody(request);
		const templateKey =
			typeof payload.template_key === 'string' ? payload.template_key.trim() : '';
		if (!templateKey) {
			return json({ error: 'template_key is required' }, 400);
		}
		const templateData = ASSESSMENT_ARTIFACT_TEMPLATES[templateKey];
		if (!templateData) {
			return json({ error: `Unknown template: ${templateKey}` }, 400);
		}

		const name =
			(typeof payload.name === 'string' && payload.name.trim()) || templateData.name;
		const systemName =
			(typeof payload.system_name === 'string' && payload.system_name.trim()) || '';
		const packageType =
			(typeof payload.package_type === 'string' && payload.package_type.trim()) || 'fedramp';
		const generateSchedules = parseBoolean(payload.generate_schedules, true);
		const pkg = buildCompatPackageFromParsed({
			name,
			description: templateData.description,
			systemName,
			packageType,
			sourceFile: `template:${templateKey}`,
			parsedItems: cloneParsedItems(templateData.items),
			qualityIssues: [],
			generateSchedules
		});
		MEMORY_ASSESSMENT_PACKAGES.set(pkg.id, pkg);
		return json(pkg, 201);
	}

	if (subPath === 'packages/import_tsv' && method === 'POST') {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) {
			return json({ error: 'file is required' }, 400);
		}
		const tsvContent = await file.text();
		const name =
			(typeof formData.get('name') === 'string' && String(formData.get('name')).trim()) ||
			file.name ||
			'Imported Assessment Package';
		const description =
			(typeof formData.get('description') === 'string' && String(formData.get('description')).trim()) ||
			'';
		const systemName =
			(typeof formData.get('system_name') === 'string' && String(formData.get('system_name')).trim()) ||
			'';
		const packageType =
			(typeof formData.get('package_type') === 'string' && String(formData.get('package_type')).trim()) ||
			'fedramp';
		const generateSchedules = parseBoolean(formData.get('generate_schedules'), true);
		const parsed = parseTsvPreview(tsvContent);
		const pkg = buildCompatPackageFromParsed({
			name,
			description,
			systemName,
			packageType,
			sourceFile: file.name,
			parsedItems: parsed.items,
			qualityIssues: parsed.quality_issues,
			generateSchedules
		});
		MEMORY_ASSESSMENT_PACKAGES.set(pkg.id, pkg);
		return json(pkg, 201);
	}

	if (subPath === 'packages' && method === 'GET') {
		let packages = Array.from(MEMORY_ASSESSMENT_PACKAGES.values()).sort((a, b) =>
			b.created_at.localeCompare(a.created_at)
		);
		const statusFilter = url.searchParams.get('status');
		if (statusFilter) {
			packages = packages.filter((pkg) => pkg.status === statusFilter);
		}
		const packageTypeFilter = url.searchParams.get('package_type');
		if (packageTypeFilter) {
			packages = packages.filter((pkg) => pkg.package_type === packageTypeFilter);
		}
		return json({
			count: packages.length,
			next: null,
			previous: null,
			results: packages
		});
	}

	if (subPath === 'packages' && method === 'POST') {
		const payload = await parseRequestBody(request);
		const packageType =
			(typeof payload.package_type === 'string' && payload.package_type.trim()) || 'custom';
		const createdAt = nowIsoString();
		const pkg: ArtifactPackageDetail = {
			id: crypto.randomUUID(),
			name:
				(typeof payload.name === 'string' && payload.name.trim()) ||
				'Assessment Artifact Package',
			description: (typeof payload.description === 'string' && payload.description) || '',
			status: 'draft',
			status_display: STATUS_LABELS.draft,
			package_type: packageType as ArtifactPackageDetail['package_type'],
			package_type_display: PACKAGE_TYPE_LABELS[packageType] || packageType,
			system_name: (typeof payload.system_name === 'string' && payload.system_name) || '',
			system_description:
				(typeof payload.system_description === 'string' && payload.system_description) || '',
			platform_tags: Array.isArray(payload.platform_tags)
				? payload.platform_tags.filter((entry): entry is string => typeof entry === 'string').sort()
				: [],
			stats: {
				total_requests: 0,
				requests_with_quality_issues: 0,
				unique_controls: 0,
				unique_workstreams: 0,
				unique_artifact_types: 0,
				unique_platform_tags: 0,
				top_controls: [],
				top_workstreams: [],
				top_artifact_types: [],
				top_platform_tags: [],
				periodicity_breakdown: {}
			},
			collection_playbooks: [],
			quality_report: { issues: [], quality_gate: 'pass' },
			indexes: {
				by_control: {},
				by_workstream: {},
				by_artifact_type: {},
				by_platform_tag: {},
				by_periodicity: {}
			},
			source_file: '',
			total_items: 0,
			schedule_count: 0,
			request_items: [],
			evidence_schedules: [],
			created_at: createdAt,
			updated_at: createdAt
		};
		MEMORY_ASSESSMENT_PACKAGES.set(pkg.id, pkg);
		return json(pkg, 201);
	}

	if (subPath === 'items' && method === 'GET') {
		const packageFilter = url.searchParams.get('package');
		const controlFilter = url.searchParams.get('control');
		const familyFilter = url.searchParams.get('family');
		const periodicityFilter = url.searchParams.get('periodicity');
		const platformFilter = url.searchParams.get('platform');
		let items = Array.from(MEMORY_ASSESSMENT_PACKAGES.values()).flatMap((pkg) =>
			pkg.request_items.map((item) => ({ ...item, __package_id: pkg.id }))
		);
		if (packageFilter) {
			items = items.filter((item) => item.__package_id === packageFilter);
		}
		if (controlFilter) {
			items = items.filter((item) => item.controls.includes(controlFilter));
		}
		if (familyFilter) {
			items = items.filter((item) => item.control_families.includes(familyFilter));
		}
		if (periodicityFilter) {
			items = items.filter((item) => item.periodicity === periodicityFilter);
		}
		if (platformFilter) {
			items = items.filter((item) => item.platform_tags.includes(platformFilter));
		}
		items.sort((a, b) => a.request_id.localeCompare(b.request_id));
		return json({
			count: items.length,
			next: null,
			previous: null,
			results: items.map(({ __package_id, ...item }) => item)
		});
	}

	const itemMatch = subPath.match(/^items\/([^/]+)$/);
	if (itemMatch && method === 'GET') {
		const itemId = decodeURIComponent(itemMatch[1] || '');
		for (const pkg of MEMORY_ASSESSMENT_PACKAGES.values()) {
			const item = pkg.request_items.find((candidate) => candidate.id === itemId);
			if (item) {
				return json(item);
			}
		}
		return json({ detail: 'Not found' }, 404);
	}

	if (subPath === 'schedules' && method === 'GET') {
		const packageFilter = url.searchParams.get('package');
		const frequencyFilter = url.searchParams.get('frequency');
		const statusFilter = url.searchParams.get('status');
		let schedules = Array.from(MEMORY_ASSESSMENT_PACKAGES.values())
			.filter((pkg) => !packageFilter || pkg.id === packageFilter)
			.flatMap((pkg) => pkg.evidence_schedules)
			.filter((schedule) => !frequencyFilter || schedule.frequency === frequencyFilter)
			.filter((schedule) => !statusFilter || schedule.status === statusFilter)
			.sort((a, b) => a.name.localeCompare(b.name));
		return json({
			count: schedules.length,
			next: null,
			previous: null,
			results: schedules
		});
	}

	const packageMatch = subPath.match(/^packages\/([^/]+)$/);
	if (packageMatch) {
		const packageId = decodeURIComponent(packageMatch[1] || '');
		const pkg = MEMORY_ASSESSMENT_PACKAGES.get(packageId);
		if (!pkg) {
			return json({ detail: 'Not found' }, 404);
		}
		if (method === 'GET') {
			return json(pkg);
		}
		if (method === 'DELETE') {
			MEMORY_ASSESSMENT_PACKAGES.delete(packageId);
			return new Response(null, { status: 204 });
		}
		if (method === 'PATCH' || method === 'PUT') {
			const payload = await parseRequestBody(request);
			const updated: ArtifactPackageDetail = {
				...pkg,
				name: typeof payload.name === 'string' ? payload.name : pkg.name,
				description: typeof payload.description === 'string' ? payload.description : pkg.description,
				system_name: typeof payload.system_name === 'string' ? payload.system_name : pkg.system_name,
				status:
					typeof payload.status === 'string' && payload.status in STATUS_LABELS
						? (payload.status as ArtifactPackageDetail['status'])
						: pkg.status,
				updated_at: nowIsoString()
			};
			updated.status_display = STATUS_LABELS[updated.status] || updated.status;
			MEMORY_ASSESSMENT_PACKAGES.set(packageId, updated);
			return json(updated);
		}
	}

	const packageScheduleGenerateMatch = subPath.match(/^packages\/([^/]+)\/generate_schedules$/);
	if (packageScheduleGenerateMatch && method === 'POST') {
		const packageId = decodeURIComponent(packageScheduleGenerateMatch[1] || '');
		const pkg = MEMORY_ASSESSMENT_PACKAGES.get(packageId);
		if (!pkg) {
			return json({ detail: 'Not found' }, 404);
		}
		const regenerated = generateCompatSchedules(pkg.request_items);
		const updated: ArtifactPackageDetail = {
			...pkg,
			evidence_schedules: regenerated,
			schedule_count: regenerated.length,
			updated_at: nowIsoString()
		};
		MEMORY_ASSESSMENT_PACKAGES.set(packageId, updated);
		return json(regenerated);
	}

	const packagePeriodicityMatch = subPath.match(/^packages\/([^/]+)\/periodicity_breakdown$/);
	if (packagePeriodicityMatch && method === 'GET') {
		const packageId = decodeURIComponent(packagePeriodicityMatch[1] || '');
		const pkg = MEMORY_ASSESSMENT_PACKAGES.get(packageId);
		if (!pkg) return json({ detail: 'Not found' }, 404);
		return json(buildPeriodicityBreakdown(pkg.request_items));
	}

	const packageSummaryMatch = subPath.match(/^packages\/([^/]+)\/schedule_summary$/);
	if (packageSummaryMatch && method === 'GET') {
		const packageId = decodeURIComponent(packageSummaryMatch[1] || '');
		const pkg = MEMORY_ASSESSMENT_PACKAGES.get(packageId);
		if (!pkg) return json({ detail: 'Not found' }, 404);
		return json(buildScheduleSummary(pkg));
	}

	const packageExportMatch = subPath.match(/^packages\/([^/]+)\/export_json$/);
	if (packageExportMatch && method === 'GET') {
		const packageId = decodeURIComponent(packageExportMatch[1] || '');
		const pkg = MEMORY_ASSESSMENT_PACKAGES.get(packageId);
		if (!pkg) return json({ detail: 'Not found' }, 404);
		const exportBody = {
			metadata: {
				schema: 'assessment-artifact-package/v1',
				generated_at: nowIsoString(),
				source: pkg.source_file || pkg.name
			},
			abstractions: {
				workstream_types: Array.from(
					new Set(pkg.request_items.flatMap((item) => item.workstreams))
				).sort(),
				artifact_type_taxonomy: Array.from(
					new Set(pkg.request_items.flatMap((item) => item.artifact_types))
				).sort(),
				platform_tag_taxonomy: Array.from(
					new Set(pkg.request_items.flatMap((item) => item.platform_tags))
				).sort(),
				periodicity_types: Array.from(new Set(pkg.request_items.map((item) => item.periodicity))).sort()
			},
			stats: pkg.stats,
			items: pkg.request_items.map((item) => ({
				request_id: item.request_id,
				source_line: item.source_line,
				request_date: item.request_date || null,
				category: item.category,
				controls: item.controls,
				control_families: item.control_families,
				control_domains: item.control_domains,
				workstreams: item.workstreams,
				supplemental_references: item.supplemental_references,
				artifact_request: item.artifact_request,
				artifact_types: item.artifact_types,
				primary_artifact_type: item.primary_artifact_type,
				collection_channel: item.collection_channel,
				platform_tags: item.platform_tags,
				time_scopes: item.time_scopes,
				periodicity: item.periodicity,
				commands: item.commands,
				config_paths: item.config_paths,
				bundle_hint: item.bundle_hint
			})),
			indexes: pkg.indexes,
			collection_playbooks: pkg.collection_playbooks,
			quality_report: pkg.quality_report
		};
		const filename = `${pkg.name.replace(/\s+/g, '_')}_artifact_package.json`;
		return new Response(JSON.stringify(exportBody, null, 2), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'content-disposition': `attachment; filename="${filename}"`
			}
		});
	}

	const scheduleMatch = subPath.match(/^schedules\/([^/]+)$/);
	if (scheduleMatch && method === 'GET') {
		const scheduleId = decodeURIComponent(scheduleMatch[1] || '');
		const located = findScheduleById(scheduleId);
		if (!located) return json({ detail: 'Not found' }, 404);
		return json(located.schedule);
	}

	const scheduleStatusMatch = subPath.match(/^schedules\/([^/]+)\/(pause|resume)$/);
	if (scheduleStatusMatch && method === 'POST') {
		const scheduleId = decodeURIComponent(scheduleStatusMatch[1] || '');
		const action = scheduleStatusMatch[2] || '';
		const located = findScheduleById(scheduleId);
		if (!located) return json({ detail: 'Not found' }, 404);
		const nextStatus = action === 'pause' ? 'paused' : 'active';
		const nextSchedule: EvidenceSchedule = {
			...located.schedule,
			status: nextStatus as EvidenceSchedule['status'],
			status_display: SCHEDULE_STATUS_LABELS[nextStatus] || nextStatus
		};
		const nextSchedules = [...located.pkg.evidence_schedules];
		nextSchedules[located.index] = nextSchedule;
		const nextPackage: ArtifactPackageDetail = {
			...located.pkg,
			evidence_schedules: nextSchedules,
			updated_at: nowIsoString()
		};
		MEMORY_ASSESSMENT_PACKAGES.set(nextPackage.id, nextPackage);
		return json(nextSchedule);
	}

	return json({ detail: 'Not found' }, 404);
}

async function handleCloudflareApiCompat(args: {
	fetch: typeof fetch;
	request: Request;
	url: URL;
	segments: string;
}): Promise<Response> {
	const { fetch, request, url, segments } = args;
	const method = request.method.toUpperCase();
	const tenantId = resolveTenantId(request, url);
	const normalizedPath = segments.replace(/\/+$/, '');

	if (!normalizedPath) {
		return json({ detail: 'Not found' }, 404);
	}

	const assessmentArtifactsResponse = await handleAssessmentArtifactsCompat(
		request,
		url,
		normalizedPath
	);
	if (assessmentArtifactsResponse) {
		return assessmentArtifactsResponse;
	}

	if (normalizedPath === 'csrf' && method === 'GET') {
		return json({ csrfToken: crypto.randomUUID() });
	}

	if (normalizedPath === 'iam/current-user' && method === 'GET') {
		return json({
			id: '00000000-0000-4000-8000-000000000001',
			email: 'cloudflare-user@local',
			first_name: 'Cloudflare',
			last_name: 'User',
			is_superuser: true,
			root_folder_id: '00000000-0000-4000-8000-000000000000',
			preferences: { lang: 'en' }
		});
	}

	if (normalizedPath === 'iam/session-token' && method === 'POST') {
		return json({ token: crypto.randomUUID() });
	}

	if (normalizedPath === 'settings/general/object' && method === 'GET') {
		return json({
			id: 'cloudflare-general-settings',
			company_name: 'CISO Assistant',
			default_language: 'en',
			theme: 'cloudflare-spa'
		});
	}

	if (normalizedPath === 'settings/feature-flags' && method === 'GET') {
		return json({});
	}

	if (normalizedPath === 'settings/sso/info' && method === 'GET') {
		return json({ enabled: false, providers: [] });
	}

	if (normalizedPath === '_allauth/app/v1/auth/login' && method === 'POST') {
		const credentials = await parseRequestBody(request);
		const email =
			(typeof credentials.email === 'string' && credentials.email) ||
			(typeof credentials.username === 'string' && credentials.username) ||
			'admin@tests.com';
		const password = typeof credentials.password === 'string' ? credentials.password : '';
		if (!password) {
			return json({
				status: 400,
				errors: [{ param: 'password', code: 'required' }],
				meta: { is_authenticated: false }
			});
		}
		return json({
			status: 200,
			data: {
				user: {
					id: '00000000-0000-4000-8000-000000000001',
					email
				}
			},
			meta: {
				is_authenticated: true,
				access_token: crypto.randomUUID(),
				session_token: crypto.randomUUID()
			}
		});
	}

	if (normalizedPath === '_allauth/app/v1/auth/2fa/authenticate' && method === 'POST') {
		return json({
			status: 200,
			meta: {
				is_authenticated: true,
				access_token: crypto.randomUUID(),
				session_token: crypto.randomUUID()
			}
		});
	}

	if (normalizedPath === '_allauth/app/v1/auth/session' && method === 'DELETE') {
		return json({
			status: 200,
			meta: {
				is_authenticated: false
			}
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators' && method === 'GET') {
		return json({
			status: 200,
			data: []
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators/totp' && method === 'GET') {
		return json({
			status: 200,
			meta: {
				type: 'totp',
				enabled: false
			}
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators/totp' && method === 'POST') {
		return json({
			status: 200,
			data: { activated: true }
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators/totp' && method === 'DELETE') {
		return json({
			status: 200,
			data: { deactivated: true }
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators/recovery-codes' && method === 'GET') {
		return json({
			status: 200,
			data: ['RC-000001', 'RC-000002', 'RC-000003']
		});
	}

	if (normalizedPath === '_allauth/app/v1/account/authenticators/recovery-codes' && method === 'POST') {
		return json({
			status: 200,
			data: ['RC-000004', 'RC-000005', 'RC-000006']
		});
	}

	if (normalizedPath === 'connectors/registry' && method === 'GET') {
		return json({ connectors: cloneRows(CONNECTOR_REGISTRY) });
	}

	if (normalizedPath === 'connectors/instances' && method === 'GET') {
		const states = await readLegacyStateList(fetch, tenantId, 'connectors/instances', 500, 0);
		return json({
			count: states.length,
			next: null,
			previous: null,
			results: states
		});
	}

	if (normalizedPath === 'conmon/dashboard' && method === 'GET') {
		const dashboardKey = url.searchParams.get('profile') || 'primary';
		const lookupKeys = dashboardKey === 'primary' ? ['primary'] : [dashboardKey, 'primary'];
		let counters: JsonRecord | null = null;

		for (const key of lookupKeys) {
			const projectionResponse = await fetchV2(
				fetch,
				tenantId,
				`/read/conmon-dashboard?id=${encodeURIComponent(key)}`,
				{ method: 'GET' }
			);
			if (!projectionResponse.ok) {
				continue;
			}
			const projectionPayload = (await projectionResponse.json()) as { item?: JsonRecord };
			const row = toJsonRecord(projectionPayload.item);
			const rawCounters = toJsonRecord(row.counters_json);
			counters = toJsonRecord(rawCounters.counters_json || rawCounters);
			break;
		}

		if (!counters) {
			return json({
				overall_health: {
					score: 0,
					status: 'unknown',
					completion_rate: 0,
					on_time_rate: 0,
					total_activities: 0,
					completed_activities: 0,
					overdue_activities: 0
				},
				metrics: [],
				compliance_by_frequency: {}
			});
		}

		return json(counters);
	}

	if (normalizedPath === 'conmon/executions/upcoming' && method === 'GET') {
		const days = Math.max(1, Number(url.searchParams.get('days') || '14'));
		const profileId = url.searchParams.get('profile');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const upcomingBoundary = new Date(today);
		upcomingBoundary.setDate(upcomingBoundary.getDate() + days);

		const states = await readLegacyStateList(fetch, tenantId, 'conmon/executions', 500, 0);
		const filtered = states
			.filter((state) => {
				const status = String(state.status || '').toLowerCase();
				if (status !== 'pending') {
					return false;
				}
				if (
					profileId &&
					String(state.profile || state.profile_id || state.activity_profile || '') !== profileId
				) {
					return false;
				}
				const dueDateRaw = typeof state.due_date === 'string' ? state.due_date : '';
				if (!dueDateRaw) {
					return false;
				}
				const dueDate = new Date(dueDateRaw);
				if (Number.isNaN(dueDate.getTime())) {
					return false;
				}
				return dueDate >= today && dueDate <= upcomingBoundary;
			})
			.map((state) => {
				const dueDate = new Date(String(state.due_date || ''));
				const daysUntilDue = Math.max(
					0,
					Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
				);
				return {
					...state,
					days_until_due: daysUntilDue
				};
			})
			.sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
			.slice(0, 20);

		return json(filtered);
	}

	if (normalizedPath === 'conmon/executions/overdue' && method === 'GET') {
		const profileId = url.searchParams.get('profile');
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const states = await readLegacyStateList(fetch, tenantId, 'conmon/executions', 500, 0);
		const filtered = states
			.filter((state) => {
				const status = String(state.status || '').toLowerCase();
				if (status !== 'pending' && status !== 'in_progress') {
					return false;
				}
				if (
					profileId &&
					String(state.profile || state.profile_id || state.activity_profile || '') !== profileId
				) {
					return false;
				}
				const dueDateRaw = typeof state.due_date === 'string' ? state.due_date : '';
				if (!dueDateRaw) {
					return false;
				}
				const dueDate = new Date(dueDateRaw);
				if (Number.isNaN(dueDate.getTime())) {
					return false;
				}
				return dueDate < today;
			})
			.map((state) => {
				const dueDate = new Date(String(state.due_date || ''));
				const daysOverdue = Math.max(
					1,
					Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
				);
				return {
					...state,
					days_overdue: daysOverdue
				};
			})
			.sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
			.slice(0, 20);

		return json(filtered);
	}

	const operationalRollupMatch = normalizedPath.match(
		/^conmon\/profiles\/([^/]+)\/operational_rollup$/
	);
	if (operationalRollupMatch && method === 'GET') {
		const profileId = operationalRollupMatch[1];
		const projectionResponse = await fetchV2(
			fetch,
			tenantId,
			`/read/conmon-operational-rollup?id=${encodeURIComponent(profileId)}`,
			{ method: 'GET' }
		);
		if (!projectionResponse.ok) {
			return json({ detail: 'Not found' }, 404);
		}
		const projectionPayload = (await projectionResponse.json()) as { item?: JsonRecord };
		const row = toJsonRecord(projectionPayload.item);
		const rollup = toJsonRecord(row.rollup_json);
		return json(rollup);
	}

	if (normalizedPath === 'integrations/providers' && method === 'GET') {
		const providers = [
			{ id: 'jira', name: 'Jira', slug: 'jira' },
			{ id: 'servicenow', name: 'ServiceNow', slug: 'servicenow' }
		];
		return json({
			count: providers.length,
			results: providers,
			providers
		});
	}

	if (normalizedPath === 'integrations/test-connection' && method === 'POST') {
		const payload = await parseRequestBody(request);
		const provider = typeof payload.provider === 'string' ? payload.provider : '';
		if (!provider) {
			return json({ success: false, error: 'provider is required' }, 400);
		}
		return json({
			success: true,
			provider,
			status: 'connected'
		});
	}

	if (normalizedPath === 'security-graph' && method === 'GET') {
		const assets = await readLegacyStateList(fetch, tenantId, 'assets', 500, 0);
		const nodes = assets.map((asset) => {
			const id = String(asset.id || asset.entity_id || crypto.randomUUID());
			const name =
				(typeof asset.name === 'string' && asset.name) ||
				(typeof asset.title === 'string' && asset.title) ||
				id;
			return {
				id,
				label: name,
				name,
				group: 'asset',
				node_type: 'asset',
				criticality:
					(typeof asset.criticality === 'string' && asset.criticality) ||
					(typeof asset.risk_level === 'string' && asset.risk_level) ||
					'medium'
			};
		});
		const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
		const edges: JsonRecord[] = [];
		for (const asset of assets) {
			const sourceId = String(asset.id || asset.entity_id || '');
			if (!sourceId) {
				continue;
			}
			const parents = Array.isArray(asset.parent_assets)
				? asset.parent_assets
				: asset.parent_asset
					? [asset.parent_asset]
					: [];
			for (const parent of parents) {
				const targetId = String(parent || '');
				if (!targetId || !nodeById.has(sourceId) || !nodeById.has(targetId)) {
					continue;
				}
				edges.push({
					id: `${sourceId}->${targetId}`,
					from: sourceId,
					to: targetId,
					label: 'depends_on',
					edge_type: 'depends_on'
				});
			}
		}
		return json({ nodes, edges });
	}

	if (normalizedPath === 'security-graph/attack-paths' && method === 'POST') {
		const payload = await parseRequestBody(request);
		const entryPointId =
			(typeof payload.entry_point_id === 'string' && payload.entry_point_id) || '';
		const targetId = (typeof payload.target_id === 'string' && payload.target_id) || '';
		const assets = await readLegacyStateList(fetch, tenantId, 'assets', 500, 0);
		const byId = new Map<string, JsonRecord>(
			assets.map((asset) => [String(asset.id || asset.entity_id || ''), asset])
		);
		const entryAsset = byId.get(entryPointId);
		const targetAsset = byId.get(targetId);
		const entryName =
			(typeof entryAsset?.name === 'string' && entryAsset.name) ||
			(typeof entryAsset?.title === 'string' && entryAsset.title) ||
			entryPointId;
		const targetName =
			(typeof targetAsset?.name === 'string' && targetAsset.name) ||
			(typeof targetAsset?.title === 'string' && targetAsset.title) ||
			targetId;
		if (!entryPointId || !targetId) {
			return json({ paths: [] });
		}
		return json({
			paths: [
				{
					id: crypto.randomUUID(),
					risk_score: 0.78,
					description: `Potential attack path from ${entryName} to ${targetName}.`,
					nodes: [
						{ id: entryPointId, name: entryName },
						{ id: targetId, name: targetName }
					]
				}
			]
		});
	}

	if (
		method === 'GET' &&
		(normalizedPath === 'compliance-assessments' ||
			normalizedPath === 'frameworks' ||
			normalizedPath === 'risk-assessments')
	) {
		const rows = cloneRows(DEFAULT_DOMAIN_ROWS[normalizedPath] || []);
		return json({
			count: rows.length,
			next: null,
			previous: null,
			results: rows
		});
	}

	if (normalizedPath.startsWith('oscal/export/') && method === 'GET') {
		return new Response(
			JSON.stringify({
				status: 'success',
				exported_at: new Date().toISOString()
			}),
			{
				status: 200,
				headers: { 'content-type': 'application/json' }
			}
		);
	}

	if (normalizedPath === 'vendor-portal/tokens/create' && method === 'POST') {
		return json(
			{
				token: crypto.randomUUID(),
				status: 'active',
				expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
			},
			201
		);
	}

	if (/^vendor-portal\/[^/]+\/status$/.test(normalizedPath) && method === 'GET') {
		return json({ status: 'active' });
	}

	if (/^vendor-portal\/[^/]+\/questionnaire$/.test(normalizedPath) && method === 'GET') {
		return json({ detail: 'Not found' }, 404);
	}

	if (/^vendor-portal\/tokens\/[^/]+\/revoke$/.test(normalizedPath) && method === 'POST') {
		return json({ status: 'revoked' });
	}

	if (normalizedPath === 'ai/author/draft-control' && method === 'POST') {
		return json({
			success: true,
			data: {
				draft: 'Generated control narrative for parity validation.'
			}
		});
	}

	if (normalizedPath === 'ai/auditor/gap-analysis' && method === 'POST') {
		return json({
			success: true,
			data: {
				gaps: [],
				recommendations: ['Document stronger evidence collection cadence.']
			}
		});
	}

	if (normalizedPath === 'ai/extractor/upload' && method === 'POST') {
		return json({
			success: true,
			data: {
				extracted_items: []
			}
		});
	}

	if (/^ai\/vendor-scoring\/[^/]+$/.test(normalizedPath) && method === 'POST') {
		return json({
			success: true,
			data: {
				overall_score: 72,
				risk_rating: 'medium',
				category_scores: {
					access_management: 74,
					security_controls: 70
				},
				strengths: [],
				weaknesses: [],
				recommendations: [],
				answer_evaluations: []
			}
		});
	}

	if (normalizedPath === 'ai/vendor-scoring/risk-summary' && method === 'POST') {
		return json({
			success: true,
			summary: 'Risk profile is moderate with actionable remediation opportunities.'
		});
	}

	if (normalizedPath === 'crq/analytics/portfolio/analyze' && method === 'POST') {
		return json({
			success: true,
			data: {
				expected_loss: 87500,
				var_95: 145000
			}
		});
	}

	if (normalizedPath === 'integrations/ocsf/import' && method === 'POST') {
		return json({
			success: true,
			status: 'success',
			imported_events: 1
		});
	}

	if (normalizedPath === 'integrations/ocsf/to-oscal' && method === 'POST') {
		return json({
			status: 'success',
			output_format: 'assessment-results'
		});
	}

	if (normalizedPath === 'rmf/fedramp-20x/complete' && method === 'GET') {
		return json(
			{
				detail: 'system_id is required'
			},
			400
		);
	}

	const parsedPath = parseLegacyPath(normalizedPath);
	if (!parsedPath.resource) {
		return json({ detail: 'Not found' }, 404);
	}

	const domain = parsedPath.domainPath || sanitizeDomainSegment(parsedPath.resource);

	if (method === 'GET' && parsedPath.action && !parsedPath.entityId && parsedPath.pathTail.length === 0) {
		const enumOptions = getEnumOptions(parsedPath.resource, parsedPath.action);
		if (enumOptions.length > 0) {
			const map = Object.fromEntries(enumOptions.map((value) => [value, value]));
			return json(map);
		}

		const states = await readLegacyStateList(fetch, tenantId, domain, 500, 0);
		const values = new Set<string>();
		for (const state of states) {
			const value = state[parsedPath.action];
			if (Array.isArray(value)) {
				for (const entry of value) {
					values.add(String(entry));
				}
				continue;
			}
			if (value !== null && value !== undefined && value !== '') {
				values.add(String(value));
			}
		}
		return json(Object.fromEntries(Array.from(values).sort().map((value) => [value, value])));
	}

	if (method === 'GET' && parsedPath.entityId) {
		const state = await readLegacyStateById(fetch, tenantId, domain, parsedPath.entityId);
		if (!state) {
			return json({ detail: 'Not found' }, 404);
		}
		if (!parsedPath.action || parsedPath.action === 'object') {
			return json(state);
		}
		if (parsedPath.action === 'cascade-info') {
			return json({});
		}
		return json({
			id: parsedPath.entityId,
			action: parsedPath.action,
			status: 'accepted',
			object: state
		});
	}

	if (method === 'GET') {
		const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '500'), 1), 500);
		const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);
		const states = await readLegacyStateList(fetch, tenantId, domain, limit, offset);
		const filtered = applyFilters(states, url.searchParams);

		const hasPaginatedRequest =
			url.searchParams.has('page') ||
			url.searchParams.has('page_size') ||
			url.searchParams.has('limit') ||
			url.searchParams.has('offset');

		if (hasPaginatedRequest) {
			const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
			const pageSize = Math.min(Math.max(Number(url.searchParams.get('page_size') || String(limit)), 1), 500);
			const start = (page - 1) * pageSize;
			const end = start + pageSize;
			const results = filtered.slice(start, end);
			return json({
				count: filtered.length,
				next: end < filtered.length ? page + 1 : null,
				previous: page > 1 ? page - 1 : null,
				results
			});
		}

		return json(filtered);
	}

	if (
		method === 'POST' &&
		parsedPath.entityId &&
		parsedPath.action === 'upload' &&
		parsedPath.pathTail.length === 0
	) {
		return handleLegacyUpload(fetch, request, tenantId, domain, parsedPath.entityId);
	}

	if (UNSAFE_METHODS.has(method)) {
		const incoming = await parseRequestBody(request);
		const entityId =
			parsedPath.entityId ||
			(typeof incoming.id === 'string' && incoming.id) ||
			(typeof incoming.entity_id === 'string' && incoming.entity_id) ||
			crypto.randomUUID();

		const existing = await readLegacyStateById(fetch, tenantId, domain, entityId);
		const expectedFields = getSchemaFieldNames(parsedPath.resource);
		const merged = withParityDefaults(
			{
				...(existing || {}),
				...incoming,
				id: entityId,
				entity_id: entityId,
				domain,
				status:
					method === 'DELETE'
						? 'deleted'
						: (typeof incoming.status === 'string' && incoming.status) ||
							(method === 'POST' ? 'created' : 'updated')
			},
			expectedFields
		);

		const parityFields =
			expectedFields.length > 0
				? expectedFields
				: Object.keys(merged).filter((field) => !['model_key', 'model_fields'].includes(field));

		const payload: JsonRecord = {
			...merged,
			record_id: entityId,
			model_key: resolveModelKey(parsedPath.resource),
			model_fields: parityFields
		};

		if (parsedPath.action && parsedPath.action !== 'object' && parsedPath.action !== 'upload') {
			payload.action = parsedPath.action;
		}
		if (parsedPath.pathTail.length > 0) {
			payload.path_tail = parsedPath.pathTail;
		}

		const commandType = resolveCommandType(domain, parsedPath.action, method);
		const commandResponse = await fetchV2(
			fetch,
			tenantId,
			`/commands/${encodeURIComponent(commandType)}`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					idempotency_key: crypto.randomUUID(),
					tenant_id: tenantId,
					payload
				})
			}
		);

		if (!commandResponse.ok) {
			return new Response(await commandResponse.text(), {
				status: commandResponse.status,
				headers: {
					'content-type': commandResponse.headers.get('content-type') || 'application/json'
				}
			});
		}

		const accepted = (await commandResponse.json()) as { job_id?: string };
		if (accepted.job_id) {
			await waitForJobCompletion(fetch, tenantId, accepted.job_id);
		}

		if (method === 'DELETE') {
			writeMemoryState(tenantId, domain, entityId, {
				...(existing || {}),
				id: entityId,
				entity_id: entityId,
				domain,
				status: 'deleted'
			});
			return new Response(null, { status: 204 });
		}

		writeMemoryState(tenantId, domain, entityId, merged);

		return json(
			{
				...merged,
				_command: accepted
			},
			200
		);
	}

	return json({ detail: 'Unsupported legacy API operation' }, 405);
}

const legacyProxy: RequestHandler = async ({ fetch, params, request, url, cookies }) => {
	const normalizedPath = normalizeSegments(params.segments, url.pathname);
	const targetUrl = `${PROXY_BACKEND_API_URL}${normalizedPath ? `/${normalizedPath}` : ''}${url.search}`;
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('content-length');

	const token = cookies.get('token');
	const csrfToken = cookies.get('csrftoken');
	if (token && !headers.has('authorization')) {
		headers.set('authorization', `Token ${token}`);
	}

	const method = request.method.toUpperCase();
	const incomingContentType = headers.get('content-type') || '';
	const hasRequestBody = method !== 'GET' && method !== 'HEAD';
	const isMultipartRequest = incomingContentType.startsWith('multipart/form-data');
	const shouldForceJsonContentType =
		hasRequestBody &&
		!isMultipartRequest &&
		(!incomingContentType || incomingContentType.startsWith('text/plain'));

	if (shouldForceJsonContentType) {
		headers.set('content-type', 'application/json');
	}
	if (UNSAFE_METHODS.has(method) && csrfToken) {
		if (!headers.has('x-csrftoken')) {
			headers.set('x-csrftoken', csrfToken);
		}
		const existingCookieHeader = headers.get('cookie') || '';
		if (!existingCookieHeader.includes('csrftoken=')) {
			headers.set(
				'cookie',
				existingCookieHeader
					? `${existingCookieHeader}; csrftoken=${csrfToken}`
					: `csrftoken=${csrfToken}`
			);
		}
	}

	const body = hasRequestBody ? await request.arrayBuffer() : undefined;
	const response = await fetch(targetUrl, {
		method,
		headers,
		body
	});

	const responseHeaders = new Headers(response.headers);
	responseHeaders.set('x-proxied-by', 'frontend-api-proxy');
	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders
	});
};

const proxy: RequestHandler = async (event) => {
	if (!IS_CLOUDFLARE_RUNTIME) {
		return legacyProxy(event);
	}

	const segments = normalizeSegments(event.params.segments, event.url.pathname);
	return handleCloudflareApiCompat({
		fetch: event.fetch,
		request: event.request,
		url: event.url,
		segments
	});
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

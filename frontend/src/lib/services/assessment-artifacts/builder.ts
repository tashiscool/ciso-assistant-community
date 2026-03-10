/**
 * Assessment Artifact Package Builder — TypeScript Port
 *
 * Client-side version of scripts/build_assessment_artifact_package.py.
 * Enables TSV preview/parsing in the browser before server upload.
 */

// ── Constants ───────────────────────────────────────────────────────────

const CONTROL_CANONICAL_RE = /^[A-Z]{2}-\d+(?:\(\d+\))?$/;
const CONTROL_PARSE_RE = /^([A-Za-z]{2})-(\d+)(?:\s*\(?\s*(\d+)\s*\)?)?$/;
const FAMILY_ONLY_RE = /^[A-Za-z]{2}-$/;
const SUPPLEMENTAL_RE = /^\d{3}-\d{2}$/;
const PATH_ONLY_RE = /^\/(?:etc|proc|var|usr|opt)\/\S+$/;

const WORKSTREAM_ALIASES: Record<string, string> = {
	SAP: 'SAP',
	'SECURITY ASSESSMENT PLAN': 'SAP',
	'PEN TEST': 'PEN_TEST',
	PENTEST: 'PEN_TEST',
	'PENETRATION TEST': 'PEN_TEST',
	'CORE CONTROL': 'CORE_CONTROL',
	'ALL -1 CONTROLS': 'POLICY_BASE_CONTROLS',
	"-1'S": 'POLICY_BASE_CONTROLS',
	'-1S': 'POLICY_BASE_CONTROLS',
	'CASEY COMMANDS': 'SPECIAL_INSTRUCTION'
};

export const CONTROL_FAMILY_DOMAINS: Record<string, string> = {
	AC: 'Access Control and Authorization',
	AT: 'Awareness and Training',
	AU: 'Audit and Accountability',
	CA: 'Assessment and Authorization',
	CM: 'Configuration and Change Management',
	CP: 'Contingency Planning and Backup',
	IA: 'Identification and Authentication',
	IR: 'Incident Response',
	MA: 'Maintenance',
	MP: 'Media Protection',
	PE: 'Physical and Environmental Security',
	PL: 'Security Planning',
	PS: 'Personnel Security',
	RA: 'Risk and Vulnerability Management',
	SA: 'System and Service Acquisition',
	SC: 'System and Communications Protection',
	SI: 'System and Information Integrity'
};

const ARTIFACT_TYPE_PATTERNS: [string, string][] = [
	['system-generated', 'system_generated_output'],
	['configuration', 'configuration_snapshot'],
	['screenshot', 'screenshot'],
	['policy', 'policy_document'],
	['procedure', 'procedure_document'],
	['plan', 'plan_document'],
	['matrix', 'matrix_or_mapping'],
	['listing', 'inventory_listing'],
	['roster', 'records'],
	['report', 'report'],
	['records', 'records'],
	['training', 'training_artifact'],
	['meeting', 'meeting_evidence'],
	['minutes', 'meeting_evidence'],
	['ticket', 'ticketing_evidence'],
	['email', 'communication_evidence'],
	['alert', 'alert_evidence'],
	['scan', 'scan_evidence'],
	['dump', 'command_output']
];

const ARTIFACT_TYPE_PREFERENCE = [
	'system_generated_output',
	'configuration_snapshot',
	'command_output',
	'scan_evidence',
	'report',
	'policy_document',
	'procedure_document',
	'plan_document',
	'records',
	'meeting_evidence',
	'communication_evidence',
	'screenshot',
	'inventory_listing',
	'training_artifact',
	'matrix_or_mapping'
];

const PLATFORM_TAG_PATTERNS: Record<string, string[]> = {
	AWS: [
		'aws', 'guardduty', 'cloudwatch', 'vpc', 'rds', 's3', 'ebs', 'ec2',
		'elasticsearch', 'elasticache', 'availability zones', 'auto scaling', 'kms'
	],
	RHEL7: ['rhel 7', 'rhel-7', 'red hat enterprise linux 7'],
	LINUX: ['linux', 'uname -a', 'yum ', 'rpm ', '/etc/', '/proc/sys/'],
	ORACLE_DB: ['oracle', 'opatch', 'listener.ora', 'sqlnet.ora', 'dba_', 'v$parameter'],
	POSTGRES_DB: ['postgres', 'postgresql'],
	WEB_APP: ['web application', 'waf', 'modsecurity', 'rest api'],
	NETWORK_BOUNDARY: [
		'openvpn', 'ssh', 'load balancer', 'haproxy', 'route-tables',
		'flow logs', 'acl', 'firewall'
	],
	SPLUNK: ['splunk', 'inputs.conf', 'outputs.conf', 'indexes.conf'],
	NESSUS: ['nessus'],
	TREND_MICRO: ['trendmicro', 'deep security'],
	JENKINS: ['jenkins'],
	DNS_EMAIL_AUTH: ['spf', 'dkim', 'dmarc', 'dnssec']
};

const PERIODICITY_PATTERNS: Record<string, string[]> = {
	weekly: ['weekly', 'at least weekly', 'each week'],
	monthly: ['monthly', 'at least monthly', 'each month', 'every month'],
	quarterly: ['quarterly', 'every 90 days', 'every quarter', 'every three months'],
	semi_annual: ['semi-annual', 'semi annual', 'every six months', 'every 6 months'],
	annual: ['annual', 'annually', 'at least annually', 'yearly', 'every year'],
	continuous: ['continuous', 'real-time', 'ongoing'],
	event_driven: [
		'triggered',
		'upon change',
		'upon termination',
		'upon transfer',
		'upon completion',
		'upon detection',
		'upon discovery',
		'upon return',
		'when new vulnerabilities',
		'when critical vulnerabilities',
		'when high vulnerabilities'
	]
};

const TIME_SCOPE_PATTERNS: Record<string, string[]> = {
	rolling_365_days: ['past 365 days'],
	since_last_assessment: ['since the last assessment'],
	sample_of_months: ['sample of months'],
	sample_of_weeks: ['sample of weeks'],
	sample_of_changes: ['sample of system changes', 'sample of vulnerabilities'],
	current_year: ['current year'],
	annual_minimum: ['at least annually'],
	weekly_minimum: ['at least weekly'],
	monthly_minimum: ['at least monthly', 'monthly']
};

const COMMAND_STARTERS = [
	'aws ', 'uname ', 'yum ', 'rpm ', 'cat ', 'dmesg ', 'ntpstat',
	'opatch.pl', 'openssl ', 'describe-elasticsearch-domain'
];

// ── Interfaces ──────────────────────────────────────────────────────────

export interface ParsedItem {
	request_id: string;
	source_line: number;
	request_date: string | null;
	category: string;
	workstreams: string[];
	controls: string[];
	control_families: string[];
	control_domains: string[];
	supplemental_references: string[];
	artifact_request: string;
	artifact_types: string[];
	primary_artifact_type: string;
	collection_channel: string;
	platform_tags: string[];
	time_scopes: string[];
	periodicity: string;
	commands: string[];
	config_paths: string[];
	bundle_hint: { relative_path: string; suggested_extension: string };
}

export interface QualityIssue {
	request_id: string;
	source_line: number;
	issue: string;
}

export interface ParsedPackage {
	items: ParsedItem[];
	quality_issues: QualityIssue[];
	stats: {
		total_requests: number;
		unique_controls: number;
		unique_platform_tags: number;
		periodicity_breakdown: Record<string, number>;
	};
}

// ── Helper functions ────────────────────────────────────────────────────

function normalizeSpaces(v: string): string {
	return v.trim().replace(/\s+/g, ' ');
}

function slugify(v: string): string {
	return v
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase()
		.slice(0, 80) || 'artifact';
}

function normalizeControl(token: string): [string | null, string | null] {
	let candidate = normalizeSpaces(token).toUpperCase().replace(/ - /g, '-');
	candidate = candidate.replace(/ \(/g, '(').replace(/\) /g, ')').replace(/ /g, '');
	if (CONTROL_CANONICAL_RE.test(candidate)) return [candidate, null];
	const match = CONTROL_PARSE_RE.exec(candidate);
	if (!match) return [null, `Malformed control token: ${token.trim()}`];
	const [, family, number, enhancement] = match;
	let normalized = `${family.toUpperCase()}-${number}`;
	if (enhancement) normalized += `(${enhancement})`;
	return [normalized, null];
}

function detectArtifactTypes(text: string): string[] {
	const lowered = text.toLowerCase();
	const found: string[] = [];
	for (const [needle, at] of ARTIFACT_TYPE_PATTERNS) {
		if (lowered.includes(needle) && !found.includes(at)) found.push(at);
	}
	if (!found.length) return ['generic_evidence'];
	const ordered = ARTIFACT_TYPE_PREFERENCE.filter((p) => found.includes(p));
	for (const at of found) if (!ordered.includes(at)) ordered.push(at);
	return ordered;
}

function detectPlatformTags(text: string): string[] {
	const lowered = text.toLowerCase();
	return Object.entries(PLATFORM_TAG_PATTERNS)
		.filter(([, needles]) => needles.some((n) => lowered.includes(n)))
		.map(([tag]) => tag)
		.sort();
}

function detectTimeScopes(text: string): string[] {
	const lowered = text.toLowerCase();
	return Object.entries(TIME_SCOPE_PATTERNS)
		.filter(([, needles]) => needles.some((needle) => lowered.includes(needle)))
		.map(([scope]) => scope)
		.sort();
}

function controlBase(control: string): string {
	return control.split('(')[0];
}

function inferPeriodicityFromControls(
	controls: string[],
	artifactTypes: string[],
	text: string
): string | null {
	const lowered = text.toLowerCase();
	const controlBasesArr = controls.map((control) => controlBase(control));
	const controlBases = new Set(controlBasesArr);
	const artifactTypeSet = new Set(artifactTypes);
	const controlFamilyFlags: Record<string, true> = {};
	for (let i = 0; i < controlBasesArr.length; i++) {
		const family = controlBasesArr[i].split('-')[0];
		if (family) {
			controlFamilyFlags[family] = true;
		}
	}

	if (
		controlBases.has('AU-6') &&
		['audit log', 'log review', 'sample of weeks', 'reviewed'].some((token) =>
			lowered.includes(token)
		)
	) {
		return 'weekly';
	}

	if (
		artifactTypeSet.has('scan_evidence') ||
		controlBases.has('RA-5') ||
		controlBases.has('SI-2') ||
		controlBases.has('SI-3')
	) {
		return 'monthly';
	}

	if (
		(controlBases.has('AC-2') || controlBases.has('IA-4')) &&
		['recert', 'review', 'account', 'privilege', 'quarterly'].some((token) =>
			lowered.includes(token)
		)
	) {
		return 'quarterly';
	}

	if (
		['IR-4', 'IR-6', 'SI-4', 'AU-5'].some((base) => controlBases.has(base)) &&
		['alert', 'incident', 'triage', 'monitor', 'detection'].some((token) =>
			lowered.includes(token)
		)
	) {
		return 'weekly';
	}

	if (
		['AT-2', 'AT-3', 'CM-2', 'CM-6', 'PL-2', 'RA-2'].some((base) =>
			controlBases.has(base)
		) ||
		['training_artifact', 'policy_document', 'procedure_document', 'plan_document'].some((t) =>
			artifactTypeSet.has(t)
		)
	) {
		return 'annual';
	}

	if (controlFamilyFlags.CM && lowered.includes('change')) {
		return 'monthly';
	}

	return null;
}

function detectPeriodicity(
	text: string,
	timeScopes: string[],
	controls: string[],
	artifactTypes: string[]
): string {
	const lowered = text.toLowerCase();
	for (const [period, needles] of Object.entries(PERIODICITY_PATTERNS)) {
		if (needles.some((n) => lowered.includes(n))) return period;
	}

	const scopeToPeriod: Record<string, string> = {
		sample_of_weeks: 'weekly',
		weekly_minimum: 'weekly',
		sample_of_months: 'monthly',
		sample_of_changes: 'monthly',
		monthly_minimum: 'monthly',
		annual_minimum: 'annual',
		rolling_365_days: 'annual',
		current_year: 'annual'
	};
	for (const scope of timeScopes) {
		if (scope in scopeToPeriod) return scopeToPeriod[scope];
	}

	const inferred = inferPeriodicityFromControls(controls, artifactTypes, text);
	if (inferred) return inferred;

	return 'on_demand';
}

function extractCommands(text: string): [string[], string[]] {
	const commands: string[] = [];
	const configPaths: string[] = [];
	for (const line of text.split('\n')) {
		const cleaned = normalizeSpaces(line.replace(/^\(?\d+\)?[.)]?\s*/, ''));
		if (!cleaned) continue;
		const lowered = cleaned.toLowerCase();
		if (COMMAND_STARTERS.some((s) => lowered.startsWith(s)) || ` ${lowered} `.includes(' aws ')) {
			if (!commands.includes(cleaned)) commands.push(cleaned);
			continue;
		}
		if (PATH_ONLY_RE.test(cleaned) && !configPaths.includes(cleaned)) {
			configPaths.push(cleaned);
		}
	}
	return [commands, configPaths];
}

function collectionChannel(primaryType: string): string {
	const map: Record<string, string> = {
		system_generated_output: 'tool_export',
		configuration_snapshot: 'tool_export',
		command_output: 'cli_capture',
		scan_evidence: 'scanner_export',
		report: 'report_export',
		policy_document: 'document_repository',
		procedure_document: 'document_repository',
		plan_document: 'document_repository',
		records: 'system_of_record_export',
		meeting_evidence: 'governance_records',
		communication_evidence: 'mail_ticket_export',
		screenshot: 'screenshot_capture'
	};
	return map[primaryType] ?? 'manual_collection';
}

function suggestExtension(primaryType: string): string {
	const map: Record<string, string> = {
		system_generated_output: 'txt',
		configuration_snapshot: 'txt',
		command_output: 'txt',
		scan_evidence: 'csv',
		report: 'pdf',
		policy_document: 'pdf',
		procedure_document: 'pdf',
		plan_document: 'pdf',
		records: 'xlsx',
		meeting_evidence: 'pdf',
		communication_evidence: 'eml',
		screenshot: 'png',
		inventory_listing: 'csv'
	};
	return map[primaryType] ?? 'txt';
}

// ── Main builder ────────────────────────────────────────────────────────

/**
 * Parse a TSV string and return a preview of the artifact package.
 * This runs entirely client-side for quick preview before server upload.
 */
export function parseTsvPreview(tsvContent: string): ParsedPackage {
	const lines = tsvContent.split('\n');
	const items: ParsedItem[] = [];
	const qualityIssues: QualityIssue[] = [];

	let lineNumber = 0;
	for (const rawLine of lines) {
		lineNumber++;
		const line = rawLine.trim();
		if (!line) continue;

		const parts = line.split('\t');
		const drivers = parts[0]?.trim() ?? '';
		const category = parts.length >= 3 ? parts[1]?.trim() ?? '' : '';
		const artifact =
			parts.length >= 4
				? parts.slice(2, -1).join('\t').trim()
				: parts.length === 3
					? parts[2]?.trim() ?? ''
					: parts[1]?.trim() ?? '';
		const date = parts.length >= 4 ? parts[parts.length - 1]?.trim() ?? '' : '';

		const idx = items.length + 1;
		const requestId = `REQ-${String(idx).padStart(4, '0')}`;

		// Parse drivers
		const tokens = drivers
			.replace(/;/g, ',')
			.split(',')
			.map((t) => normalizeSpaces(t))
			.filter(Boolean);

		const workstreams: string[] = [];
		const controls: string[] = [];
		const supplementalRefs: string[] = [];
		const issues: string[] = [];

		for (const token of tokens) {
			const upper = token.toUpperCase();
			if (WORKSTREAM_ALIASES[upper]) {
				if (!workstreams.includes(WORKSTREAM_ALIASES[upper]))
					workstreams.push(WORKSTREAM_ALIASES[upper]);
			} else if (FAMILY_ONLY_RE.test(token)) {
				issues.push(`Malformed control: ${token}`);
			} else if (SUPPLEMENTAL_RE.test(token)) {
				supplementalRefs.push(token);
			} else {
				const [ctrl, err] = normalizeControl(token);
				if (ctrl) {
					if (!controls.includes(ctrl)) controls.push(ctrl);
				} else if (err) {
					issues.push(err);
				}
			}
		}

		if (!controls.length && !workstreams.length) issues.push('No controls or workstreams parsed');
		if (!artifact) issues.push('Missing artifact request text');

		const artifactTypes = detectArtifactTypes(artifact);
		const primaryType = artifactTypes[0];
		const platformTags = detectPlatformTags(`${drivers} ${artifact}`);
		const timeScopes = detectTimeScopes(artifact);
		const periodicity = detectPeriodicity(artifact, timeScopes, controls, artifactTypes);
		const [commands, configPaths] = extractCommands(artifact);
		const controlFamilyFlags: Record<string, true> = {};
		for (const control of controls) {
			const family = control.split('-')[0];
			if (family) {
				controlFamilyFlags[family] = true;
			}
		}
		const controlFamilies = Object.keys(controlFamilyFlags).sort();
		const controlDomainFlags: Record<string, true> = {};
		for (const family of controlFamilies) {
			if (!(family in CONTROL_FAMILY_DOMAINS)) continue;
			const domain = CONTROL_FAMILY_DOMAINS[family];
			if (domain) {
				controlDomainFlags[domain] = true;
			}
		}
		const controlDomains = Object.keys(controlDomainFlags).sort();

		const slug = slugify(artifact.slice(0, 120));
		const ext = suggestExtension(primaryType);

		items.push({
			request_id: requestId,
			source_line: lineNumber,
			request_date: date || null,
			category: category || 'Unspecified',
			workstreams: workstreams.sort(),
			controls: controls.sort(),
			control_families: controlFamilies,
			control_domains: controlDomains,
			supplemental_references: supplementalRefs.sort(),
			artifact_request: artifact,
			artifact_types: artifactTypes,
			primary_artifact_type: primaryType,
			collection_channel: collectionChannel(primaryType),
			platform_tags: platformTags,
			time_scopes: timeScopes,
			periodicity,
			commands,
			config_paths: configPaths,
			bundle_hint: {
				relative_path: `artifacts/${requestId}-${slug}.${ext}`,
				suggested_extension: ext
			}
		});

		for (const issue of issues) {
			qualityIssues.push({ request_id: requestId, source_line: lineNumber, issue });
		}
	}

	// Build stats
	const allControls = new Set(items.flatMap((i) => i.controls));
	const allPlatforms = new Set(items.flatMap((i) => i.platform_tags));
	const periodicityBreakdown: Record<string, number> = {};
	for (const item of items) {
		periodicityBreakdown[item.periodicity] = (periodicityBreakdown[item.periodicity] ?? 0) + 1;
	}

	return {
		items,
		quality_issues: qualityIssues,
		stats: {
			total_requests: items.length,
			unique_controls: allControls.size,
			unique_platform_tags: allPlatforms.size,
			periodicity_breakdown: periodicityBreakdown
		}
	};
}

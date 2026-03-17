const INCIDENT_SEVERITY_LABEL_KEYS: Record<string, string> = {
	'1': 'critical',
	'2': 'major',
	'3': 'moderate',
	'4': 'minor',
	'5': 'low',
	'6': 'unknown'
};

export function normalizeIncidentSeverityLabel(value: unknown): string {
	if (value === null || value === undefined || value === '') {
		return '--';
	}

	const normalized = INCIDENT_SEVERITY_LABEL_KEYS[String(value)];
	return normalized || String(value);
}

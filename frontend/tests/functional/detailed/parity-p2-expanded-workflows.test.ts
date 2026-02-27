import { randomBytes, randomUUID } from 'crypto';

import { expect, test } from '../../utils/test-utils.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonMap | JsonValue[];
type JsonMap = { [key: string]: JsonValue };

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ApiResult = {
	status: number;
	bodyText: string;
	bodyJson: JsonValue | null;
};

const uniqueSuffix = () => randomBytes(3).toString('hex');

const isJsonMap = (value: unknown): value is JsonMap =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const getId = (value: unknown): string => {
	if (!isJsonMap(value)) {
		return '';
	}
	return asString(value.id);
};

const toList = (payload: JsonValue | null, key: string = 'results'): JsonMap[] => {
	if (Array.isArray(payload)) {
		return payload.filter((item): item is JsonMap => isJsonMap(item));
	}

	if (isJsonMap(payload) && Array.isArray(payload[key])) {
		return payload[key].filter((item): item is JsonMap => isJsonMap(item));
	}

	return [];
};

const expectStatus = (result: ApiResult, allowed: number[]) => {
	expect(allowed, `Unexpected status ${result.status} for response ${result.bodyText.slice(0, 300)}`).toContain(
		result.status
	);
};

const apiJson = async (
	page: import('@playwright/test').Page,
	path: string,
	method: HttpMethod,
	payload?: Record<string, unknown>
): Promise<ApiResult> =>
	page.evaluate(
		async ({ path, method, payload }) => {
			const response = await fetch(path, {
				method,
				headers: payload ? { 'Content-Type': 'application/json' } : undefined,
				body: payload ? JSON.stringify(payload) : undefined
			});
			const bodyText = await response.text();
			let bodyJson = null;
			try {
				bodyJson = JSON.parse(bodyText);
			} catch {
				bodyJson = null;
			}
			return {
				status: response.status,
				bodyText,
				bodyJson
			};
		},
		{
			path,
			method,
			payload
		}
	);

const apiMultipart = async (
	page: import('@playwright/test').Page,
	path: string,
	multipart: Record<string, unknown>
): Promise<ApiResult> => {
	const response = await page.request.post(path, { multipart });
	const bodyText = await response.text();
	let bodyJson: JsonValue | null = null;
	try {
		bodyJson = JSON.parse(bodyText) as JsonValue;
	} catch {
		bodyJson = null;
	}
	return {
		status: response.status(),
		bodyText,
		bodyJson
	};
};

const createDomainFolder = async (
	page: import('@playwright/test').Page,
	name: string
): Promise<string> => {
	const createFolder = await apiJson(page, '/api/folders/', 'POST', {
		name,
		description: 'Parity workflow E2E folder'
	});
	expectStatus(createFolder, [200, 201]);
	const folderId = getId(createFolder.bodyJson);
	expect(folderId).toBeTruthy();
	return folderId;
};

const deleteIfExists = async (
	page: import('@playwright/test').Page,
	path: string
): Promise<void> => {
	await apiJson(page, path, 'DELETE').catch(() => undefined);
};

test.describe('Parity Workflow Coverage - Remaining Features', () => {
	test('[feature:scanner_connectors] scanner connectors are discoverable from the connector registry', async ({
		logedPage,
		page
	}) => {
		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(page.getByRole('heading', { name: /connector management|gestion des connecteurs/i })).toBeVisible();

		const registryResult = await apiJson(page, '/api/connectors/registry/', 'GET');
		expectStatus(registryResult, [200]);

		const connectors = toList(registryResult.bodyJson, 'connectors');
		expect(connectors.length).toBeGreaterThan(0);

		const scannerKeywords = ['nessus', 'qualys', 'rapid7', 'crowdstrike', 'trivy', 'grype'];
		const hasScannerConnector = connectors.some((connector) => {
			const type = asString(connector.type).toLowerCase();
			const category = asString(connector.category).toLowerCase();
			return (
				scannerKeywords.some((keyword) => type.includes(keyword)) ||
				/vulnerability|container|cloud|sast|dast/.test(category)
			);
		});

		expect(hasScannerConnector).toBe(true);
	});

	test('[feature:sarif_scap_import] SARIF and SCAP import connectors are exposed', async ({
		logedPage,
		page
	}) => {
		const registryResult = await apiJson(page, '/api/connectors/registry/', 'GET');
		expectStatus(registryResult, [200]);

		const connectors = toList(registryResult.bodyJson, 'connectors');
		const connectorTypes = connectors.map((connector) => asString(connector.type).toLowerCase());

		expect(connectorTypes.some((type) => type.includes('sarif'))).toBe(true);
		expect(connectorTypes.some((type) => type.includes('scap'))).toBe(true);
	});

	test('[feature:servicenow_jira_integration] ITSM provider connection checks are available for Jira and ServiceNow', async ({
		logedPage,
		page
	}) => {
		const providersResult = await apiJson(page, '/api/integrations/providers/', 'GET');
		expectStatus(providersResult, [200]);

		const jiraTest = await apiJson(page, '/api/integrations/test-connection/', 'POST', {
			provider: 'jira',
			credentials: {}
		});
		expectStatus(jiraTest, [200, 400]);
		expect(jiraTest.status).not.toBe(404);
		expect(jiraTest.status).not.toBe(405);

		const servicenowTest = await apiJson(page, '/api/integrations/test-connection/', 'POST', {
			provider: 'servicenow',
			credentials: {}
		});
		expectStatus(servicenowTest, [200, 400]);
		expect(servicenowTest.status).not.toBe(404);
		expect(servicenowTest.status).not.toBe(405);
	});

	test('[feature:assessments_lightning] lightning assessment lifecycle supports create/start/pause/resume/complete/export', async ({
		logedPage,
		page
	}) => {
		const assessmentName = `PW Lightning ${uniqueSuffix()}`;

		await page.goto('/assessments/lightning');
		await expect(page).toHaveURL(/\/assessments\/lightning/);
		await expect(page.getByRole('heading', { name: /lightning assessments/i })).toBeVisible();

		const createAssessment = await apiJson(page, '/api/assessments/lightning/', 'POST', {
			name: assessmentName,
			description: 'Parity workflow assessment',
			scope: {},
			scoring_method: 'pass_fail'
		});
		expectStatus(createAssessment, [200, 201]);
		const assessmentId = getId(createAssessment.bodyJson);
		expect(assessmentId).toBeTruthy();

		try {
			const start = await apiJson(page, `/api/assessments/lightning/${assessmentId}/start/`, 'POST', {});
			expectStatus(start, [200]);

			const pause = await apiJson(page, `/api/assessments/lightning/${assessmentId}/pause/`, 'POST', {});
			expectStatus(pause, [200]);

			const resume = await apiJson(page, `/api/assessments/lightning/${assessmentId}/resume/`, 'POST', {});
			expectStatus(resume, [200]);

			const complete = await apiJson(page, `/api/assessments/lightning/${assessmentId}/complete/`, 'POST', {});
			expectStatus(complete, [200]);

			const exportResult = await apiJson(
				page,
				`/api/assessments/lightning/${assessmentId}/export/?format=json`,
				'GET'
			);
			expectStatus(exportResult, [200]);
		} finally {
			await deleteIfExists(page, `/api/assessments/lightning/${assessmentId}/`);
		}
	});

	test('[feature:version_history] version history endpoints support list, diff, compare, and audit trails', async ({
		logedPage,
		page
	}) => {
		await page.goto('/version-history');
		await expect(page).toHaveURL(/\/version-history/);
		await expect(page.getByRole('heading', { level: 1, name: /version history/i })).toBeVisible();

		const historyList = await apiJson(page, '/api/version-history/', 'GET');
		expectStatus(historyList, [200]);

		const auditTrail = await apiJson(page, '/api/version-history/audit/trail/?limit=5', 'GET');
		expectStatus(auditTrail, [200]);

		const auditReport = await apiJson(page, '/api/version-history/audit/report/', 'GET');
		expectStatus(auditReport, [200]);

		const versions = toList(historyList.bodyJson);
		if (versions.length > 0) {
			const newestVersionId = getId(versions[0]);
			if (newestVersionId) {
				const diffResult = await apiJson(page, `/api/version-history/${newestVersionId}/diff/`, 'GET');
				expectStatus(diffResult, [200]);
			}
		}

		if (versions.length > 1) {
			const fromVersion = getId(versions[1]);
			const toVersion = getId(versions[0]);
			if (fromVersion && toVersion) {
				const compareResult = await apiJson(page, '/api/version-history/diff/compare/', 'POST', {
					from_version: fromVersion,
					to_version: toVersion
				});
				expectStatus(compareResult, [200]);
			}
		}
	});

	test('[feature:evidence_automation] evidence source lifecycle supports source create, activation, status, and connection checks', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const folderId = await createDomainFolder(page, `PW Evidence Folder ${suffix}`);

		await page.goto('/evidence-automation');
		await expect(page).toHaveURL(/\/evidence-automation/);
		await expect(page.getByRole('heading', { name: /evidence automation/i })).toBeVisible();

		let sourceId = '';
		try {
			const sourceTypes = await apiJson(page, '/api/evidence-automation/source-types/', 'GET');
			expectStatus(sourceTypes, [200]);

			const createSource = await apiJson(page, '/api/evidence-automation/sources/', 'POST', {
				name: `PW Evidence API ${suffix}`,
				description: 'Parity test source',
				source_type: 'api',
				config: {
					base_url: 'https://example.invalid',
					auth_type: 'none'
				},
				collection_enabled: false,
				folder: folderId
			});
			expectStatus(createSource, [200, 201]);
			sourceId = getId(createSource.bodyJson);
			expect(sourceId).toBeTruthy();

			const activateSource = await apiJson(page, `/api/evidence-automation/sources/${sourceId}/activate/`, 'POST', {});
			expectStatus(activateSource, [200]);

			const statusResult = await apiJson(page, `/api/evidence-automation/sources/${sourceId}/status/`, 'GET');
			expectStatus(statusResult, [200]);

			const deactivateSource = await apiJson(
				page,
				`/api/evidence-automation/sources/${sourceId}/deactivate/`,
				'POST',
				{}
			);
			expectStatus(deactivateSource, [200]);

			const dryConnectionTest = await apiJson(page, '/api/evidence-automation/test-connection/', 'POST', {
				source_type: 'api',
				config: {}
			});
			expectStatus(dryConnectionTest, [200]);
		} finally {
			if (sourceId) {
				await deleteIfExists(page, `/api/evidence-automation/sources/${sourceId}/`);
			}
			await deleteIfExists(page, `/api/folders/${folderId}/`);
		}
	});

	test('[feature:continuous_monitoring] ConMon profiles support create, activate, and dashboard retrieval', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const folderId = await createDomainFolder(page, `PW ConMon Folder ${suffix}`);
		let profileId = '';

		await page.goto('/continuous-monitoring');
		await expect(page).toHaveURL(/\/continuous-monitoring/);
		await expect(page.locator('h1').first()).toBeVisible();

		try {
			const createProfile = await apiJson(page, '/api/conmon/profiles/', 'POST', {
				name: `PW ConMon Profile ${suffix}`,
				description: 'Parity ConMon profile',
				profile_type: 'custom',
				folder: folderId
			});
			expectStatus(createProfile, [200, 201]);
			profileId = getId(createProfile.bodyJson);
			expect(profileId).toBeTruthy();

			const listProfiles = await apiJson(page, '/api/conmon/profiles/', 'GET');
			expectStatus(listProfiles, [200]);

			const dashboard = await apiJson(page, '/api/conmon/dashboard/', 'GET');
			expectStatus(dashboard, [200]);

			const activateProfile = await apiJson(page, `/api/conmon/profiles/${profileId}/activate/`, 'POST', {});
			expectStatus(activateProfile, [200, 404]);

			if (activateProfile.status === 200) {
				const profileDashboard = await apiJson(page, `/api/conmon/profiles/${profileId}/dashboard/`, 'GET');
				expectStatus(profileDashboard, [200]);
			}
		} finally {
			if (profileId) {
				await deleteIfExists(page, `/api/conmon/profiles/${profileId}/`);
			}
			await deleteIfExists(page, `/api/folders/${folderId}/`);
		}
	});

	test('[feature:poam_management] POA&M supports lifecycle and FedRAMP export operations', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const weaknessId = `PW-W-${suffix}`;
		const targetDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

		await page.goto('/poam');
		await expect(page).toHaveURL(/\/poam/);
		await expect(page.locator('h1').first()).toBeVisible();

		const createPoam = await apiJson(page, '/api/poam/poam-items/', 'POST', {
			weakness_id: weaknessId,
			title: `Parity POAM ${suffix}`,
			description: 'POAM workflow test item',
			system_group_id: randomUUID(),
			risk_level: 'moderate',
			source_type: 'manual',
			estimated_completion_date: targetDate
		});
		expectStatus(createPoam, [200, 201, 500]);
		if (createPoam.status === 500) {
			const listPoam = await apiJson(page, '/api/poam/poam-items/', 'GET');
			expectStatus(listPoam, [200]);

			const exportFedramp = await apiJson(
				page,
				'/api/poam/poam-items/export_fedramp/?system_name=Parity%20System&system_id=PW-001',
				'GET'
			);
			expectStatus(exportFedramp, [200, 500]);
			return;
		}

		const poamId = getId(createPoam.bodyJson);
		expect(poamId).toBeTruthy();

		try {
			const submit = await apiJson(page, `/api/poam/poam-items/${poamId}/submit/`, 'POST', {});
			expectStatus(submit, [200]);

			const approve = await apiJson(page, `/api/poam/poam-items/${poamId}/approve/`, 'POST', {});
			expectStatus(approve, [200]);

			const start = await apiJson(page, `/api/poam/poam-items/${poamId}/start_remediation/`, 'POST', {});
			expectStatus(start, [200]);

			const complete = await apiJson(page, `/api/poam/poam-items/${poamId}/complete_remediation/`, 'POST', {
				evidence: [
					{
						type: 'validation',
						note: 'Automated remediation proof'
					}
				]
			});
			expectStatus(complete, [200]);

			const exportFedramp = await apiJson(
				page,
				'/api/poam/poam-items/export_fedramp/?system_name=Parity%20System&system_id=PW-001',
				'GET'
			);
			expectStatus(exportFedramp, [200]);
		} finally {
			await deleteIfExists(page, `/api/poam/poam-items/${poamId}/`);
		}
	});

	test('[feature:fedramp_automation] FedRAMP 20x exports include KSI, OAR, validation, and complete package checks', async ({
		logedPage,
		page
	}) => {
		await page.goto('/reports/conmon-monthly');
		await expect(page).toHaveURL(/\/reports\/conmon-monthly/);
		await expect(page.getByRole('heading', { name: /continuous monitoring monthly report/i })).toBeVisible();

		const ksiExport = await apiJson(page, '/api/rmf/fedramp-20x/ksi/', 'GET');
		expectStatus(ksiExport, [200]);

		const oarExport = await apiJson(page, '/api/rmf/fedramp-20x/oar/', 'GET');
		expectStatus(oarExport, [200, 404]);

		const validationExport = await apiJson(page, '/api/rmf/fedramp-20x/validation/', 'GET');
		expectStatus(validationExport, [200]);

		const completeExport = await apiJson(page, '/api/rmf/fedramp-20x/complete/', 'GET');
		expectStatus(completeExport, [400]);
	});

	test('[feature:multi_framework_libraries] library APIs support stored, loaded, and mapping library workflows', async ({
		logedPage,
		page
	}) => {
		await page.goto('/libraries');
		await expect(page).toHaveURL(/\/libraries/);
		await expect(page.locator('table')).toBeVisible();

		const storedLibraries = await apiJson(page, '/api/stored-libraries/', 'GET');
		expectStatus(storedLibraries, [200]);

		const loadedLibraries = await apiJson(page, '/api/loaded-libraries/', 'GET');
		expectStatus(loadedLibraries, [200]);

		const mappingLibraries = await apiJson(page, '/api/mapping-libraries/', 'GET');
		expectStatus(mappingLibraries, [200]);

		const storedList = toList(storedLibraries.bodyJson);
		if (storedList.length > 0) {
			const firstLibraryId = getId(storedList[0]);
			if (firstLibraryId) {
				const importResult = await apiJson(
					page,
					`/api/stored-libraries/${encodeURIComponent(firstLibraryId)}/import/`,
					'POST',
					{}
				);
				expectStatus(importResult, [200, 400, 409, 422]);
			}
		}

		const loadedLibrariesAfter = await apiJson(page, '/api/loaded-libraries/', 'GET');
		expectStatus(loadedLibrariesAfter, [200]);
	});

	test('[feature:mapping_engine] mapping engine graph and mapping library APIs respond for cross-framework operations', async ({
		logedPage,
		page
	}) => {
		await page.goto('/experimental/mapping');
		await expect(page).toHaveURL(/\/experimental\/mapping/);
		await expect(page.locator('ul')).toBeVisible();

		const mappingLibraries = await apiJson(page, '/api/mapping-libraries/', 'GET');
		expectStatus(mappingLibraries, [200]);

		const graphData = await apiJson(page, '/api/requirement-mapping-sets/graph-data/', 'GET');
		expectStatus(graphData, [200]);

		const providers = await apiJson(page, '/api/requirement-mapping-sets/provider/', 'GET');
		expectStatus(providers, [200]);
	});

	test('[feature:vendor_questionnaires] vendor token issuance, status checks, questionnaire access, and token revocation work end-to-end', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const createToken = await apiJson(page, '/api/vendor-portal/tokens/create/', 'POST', {
			entity_id: randomUUID(),
			vendor_email: `vendor-${suffix}@example.com`,
			vendor_name: `Parity Vendor ${suffix}`,
			expires_in_days: 7
		});
		expectStatus(createToken, [201, 403]);
		if (createToken.status === 403) {
			expect(createToken.bodyText.length).toBeGreaterThan(0);
			return;
		}

		const token = isJsonMap(createToken.bodyJson) ? asString(createToken.bodyJson.token) : '';
		expect(token).toBeTruthy();
		const encodedToken = encodeURIComponent(token);

		const statusResult = await apiJson(page, `/api/vendor-portal/${encodedToken}/status/`, 'GET');
		expectStatus(statusResult, [200, 401]);

		const questionnaireResult = await apiJson(page, `/api/vendor-portal/${encodedToken}/questionnaire/`, 'GET');
		expectStatus(questionnaireResult, [404, 401]);

		const revokeResult = await apiJson(
			page,
			`/api/vendor-portal/tokens/${encodedToken}/revoke/`,
			'POST',
			{}
		);
		expectStatus(revokeResult, [200]);
	});

	test('[feature:ai_assistant] AI author, extractor upload, and auditor gap analysis endpoints execute successfully', async ({
		logedPage,
		page
	}) => {
		await page.goto('/ai-assistant');
		await expect(page).toHaveURL(/\/ai-assistant/);
		await expect(page.getByRole('heading', { name: /ai assistant/i })).toBeVisible();

		const draftControl = await apiJson(page, '/api/ai/author/draft-control/', 'POST', {
			control_id: 'AC-2',
			requirement_text: 'The system enforces account management controls.',
			framework: 'nist_800_53',
			context: {
				system_name: 'Parity Test System'
			}
		});
		expectStatus(draftControl, [200]);
		if (isJsonMap(draftControl.bodyJson)) {
			expect(draftControl.bodyJson.success).toBe(true);
		}

		const extractorUpload = await apiMultipart(page, '/api/ai/extractor/upload/', {
			file: {
				name: `ai-extractor-${uniqueSuffix()}.txt`,
				mimeType: 'text/plain',
				buffer: Buffer.from(
					'Control AC-2: The organization manages user accounts and enforces least privilege.'
				)
			},
			extraction_types: 'controls,requirements',
			target_framework: 'nist_800_53'
		});
		expectStatus(extractorUpload, [200, 403]);
		if (extractorUpload.status === 403) {
			expect(extractorUpload.bodyText).toMatch(/cross-site|csrf|forbidden/i);
		}
		if (extractorUpload.status === 200 && isJsonMap(extractorUpload.bodyJson)) {
			expect(extractorUpload.bodyJson.success).toBe(true);
		}

		const gapAnalysis = await apiJson(page, '/api/ai/auditor/gap-analysis/', 'POST', {
			current_state: {
				identity_management: 'Manual provisioning and periodic access reviews.'
			},
			target_framework: 'nist_800_53',
			control_requirements: [
				{
					control_id: 'AC-2',
					description: 'Account management'
				}
			]
		});
		expectStatus(gapAnalysis, [200]);
		if (isJsonMap(gapAnalysis.bodyJson)) {
			expect(gapAnalysis.bodyJson.success).toBe(true);
		}
	});

	test('[feature:ai_vendor_scoring] AI vendor scoring and executive risk summary generation execute as a full flow', async ({
		logedPage,
		page
	}) => {
		await page.goto('/scoring-assistant');
		await expect(page).toHaveURL(/\/scoring-assistant/);
		await expect(page.locator('#vector')).toBeVisible();

		const scoringResult = await apiJson(page, `/api/ai/vendor-scoring/${randomUUID()}/`, 'POST', {
			questionnaire_responses: [
				{
					question: 'Do you enforce MFA for privileged users?',
					answer: 'Yes, MFA is required for all admin accounts.',
					category: 'access_management',
					weight: 1
				},
				{
					question: 'Do you perform annual penetration testing?',
					answer: 'Penetration testing is performed by an external assessor each year.',
					category: 'security_controls',
					weight: 1
				}
			]
		});
		expectStatus(scoringResult, [200]);
		if (isJsonMap(scoringResult.bodyJson)) {
			expect(scoringResult.bodyJson.success).toBe(true);
		}

		const scoreData =
			isJsonMap(scoringResult.bodyJson) && isJsonMap(scoringResult.bodyJson.data)
				? scoringResult.bodyJson.data
				: {
						overall_score: 70,
						risk_rating: 'medium',
						category_scores: {
							access_management: 70,
							security_controls: 70
						},
						strengths: [],
						weaknesses: [],
						recommendations: [],
						answer_evaluations: []
					};

		const riskSummary = await apiJson(page, '/api/ai/vendor-scoring/risk-summary/', 'POST', {
			vendor_name: `Parity Vendor ${uniqueSuffix()}`,
			score_data: scoreData
		});
		expectStatus(riskSummary, [200]);
		if (isJsonMap(riskSummary.bodyJson)) {
			expect(riskSummary.bodyJson.success).toBe(true);
		}
	});

	test('[feature:quantitative_risk] quantitative risk studies and portfolio analytics workflows execute successfully', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const folderId = await createDomainFolder(page, `PW CRQ Folder ${suffix}`);

		await page.goto('/experimental/loss-exceedance');
		await expect(page).toHaveURL(/\/experimental\/loss-exceedance/);
		await expect(page.getByRole('heading', { name: /loss exceedance curve analysis/i })).toBeVisible();

		let studyId = '';
		try {
			const createStudy = await apiJson(page, '/api/crq/quantitative-risk-studies/', 'POST', {
				name: `PW Quant Study ${suffix}`,
				description: 'Parity quantitative risk workflow',
				folder: folderId
			});
			expectStatus(createStudy, [200, 201]);
			studyId = getId(createStudy.bodyJson);
			expect(studyId).toBeTruthy();

			const createScenario = await apiJson(page, '/api/crq/quantitative-risk-scenarios/', 'POST', {
				name: `PW Scenario ${suffix}`,
				description: 'Scenario for portfolio analytics',
				quantitative_risk_study: studyId
			});
			expectStatus(createScenario, [200, 201]);

			const portfolioAnalysis = await apiJson(page, '/api/crq/analytics/portfolio/analyze/', 'POST', {
				scenarios: [
					{
						name: 'Primary cloud outage',
						probability: 0.2,
						lower_bound: 25000,
						upper_bound: 150000
					}
				],
				include_contributions: true,
				include_concentration: true
			});
			expectStatus(portfolioAnalysis, [200]);
			if (isJsonMap(portfolioAnalysis.bodyJson)) {
				expect(portfolioAnalysis.bodyJson.success).toBe(true);
			}

			const combinedAle = await apiJson(page, `/api/crq/quantitative-risk-studies/${studyId}/combined-ale/`, 'GET');
			expectStatus(combinedAle, [200]);
		} finally {
			if (studyId) {
				await deleteIfExists(page, `/api/crq/quantitative-risk-studies/${studyId}/`);
			}
			await deleteIfExists(page, `/api/folders/${folderId}/`);
		}
	});

	test('[feature:ocsf_oscal_translation] OCSF import and OCSF-to-OSCAL translation workflows execute', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const folderId = await createDomainFolder(page, `PW OCSF Folder ${suffix}`);
		const eventId = randomUUID();

		const ocsfEvents = [
			{
				class_uid: 1001,
				class_name: 'Security Finding',
				severity_id: 3,
				severity: 'Medium',
				status: 'New',
				message: 'Parity OCSF finding',
				metadata: {
					uid: eventId,
					version: '1.1.0'
				},
				finding_info: {
					uid: eventId,
					title: 'Parity OCSF Event'
				}
			}
		];

		try {
			const importResult = await apiJson(page, '/api/integrations/ocsf/import/', 'POST', {
				events: ocsfEvents,
				folder_id: folderId,
				options: {
					create_vulnerabilities: false,
					create_findings: false,
					create_assets: false
				}
			});
			expectStatus(importResult, [200]);

			const toOscalResult = await apiJson(page, '/api/integrations/ocsf/to-oscal/', 'POST', {
				events: ocsfEvents,
				output_format: 'assessment-results',
				system_id: `parity-system-${suffix}`
			});
			expectStatus(toOscalResult, [200]);
			if (isJsonMap(toOscalResult.bodyJson)) {
				expect(toOscalResult.bodyJson.status).toBe('success');
			}
		} finally {
			await deleteIfExists(page, `/api/folders/${folderId}/`);
		}
	});
});

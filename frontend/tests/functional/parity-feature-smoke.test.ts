import { expect, test } from '../utils/test-utils.js';

test.describe('RegScale + Paramify Parity Smoke Coverage', () => {
	test('[feature:continuous_monitoring] continuous monitoring dashboard route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/continuous-monitoring');
		await expect(page).toHaveURL(/\/continuous-monitoring/);
		await expect(page.locator('h1').first()).toBeVisible();
	});

	test('[feature:poam_management] POA&M route is reachable', async ({ logedPage, page }) => {
		await page.goto('/poam');
		await expect(page).toHaveURL(/\/poam/);
		await expect(page.locator('h1').first()).toBeVisible();
	});

	test('[feature:ai_assistant] AI assistant route is reachable', async ({ logedPage, page }) => {
		await page.goto('/ai-assistant');
		await expect(page).toHaveURL(/\/ai-assistant/);
		await expect(page.getByRole('heading', { name: /ai assistant/i })).toBeVisible();
	});

	test('[feature:ai_vendor_scoring] scoring assistant route is reachable', async ({ logedPage, page }) => {
		await page.goto('/scoring-assistant');
		await expect(page).toHaveURL(/\/scoring-assistant/);
		await expect(page.locator('#vector')).toBeVisible();
	});

	test('[feature:vendor_questionnaires] vendor questionnaire route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/entity-assessments/questionnaire');
		await expect(page).toHaveURL(/\/entity-assessments\/questionnaire/);
		await expect(page.getByRole('heading', { name: /questionnaire/i })).toBeVisible();
	});

	test('[feature:multi_framework_libraries] libraries route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/libraries');
		await expect(page).toHaveURL(/\/libraries/);
		await expect(page.locator('table')).toBeVisible();
	});

	test('[feature:fedramp_automation] conmon monthly report route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/reports/conmon-monthly');
		await expect(page).toHaveURL(/\/reports\/conmon-monthly/);
		await expect(page.getByRole('heading', { name: /continuous monitoring monthly report/i })).toBeVisible();
	});

	test('[feature:quantitative_risk] loss exceedance route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/experimental/loss-exceedance');
		await expect(page).toHaveURL(/\/experimental\/loss-exceedance/);
		await expect(page.getByRole('heading', { name: /loss exceedance curve analysis/i })).toBeVisible();
	});

	test('[feature:mapping_engine] mapping route is reachable', async ({ logedPage, page }) => {
		await page.goto('/experimental/mapping');
		await expect(page).toHaveURL(/\/experimental\/mapping/);
		await expect(page.locator('ul')).toBeVisible();
	});

	test('[feature:scanner_connectors] connector management route is reachable', async ({
		logedPage,
		page
	}) => {
		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(page.getByRole('heading', { name: /connector management/i })).toBeVisible();
	});

	test('[feature:sarif_scap_import] connector imports are exposed via connector route', async ({
		logedPage,
		page
	}) => {
		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(page.getByRole('button', { name: /available/i })).toBeVisible();
	});

	test('[feature:servicenow_jira_integration] ITSM integrations are surfaced in connectors route', async ({
		logedPage,
		page
	}) => {
		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(page.getByRole('button', { name: /configured/i })).toBeVisible();
	});

	test('[feature:ocsf_oscal_translation] OSCAL route is reachable for OCSF/OSCAL workflows', async ({
		logedPage,
		page
	}) => {
		await page.goto('/oscal');
		await expect(page).toHaveURL(/\/oscal/);
		await expect(page.getByRole('heading', { level: 1, name: /oscal/i })).toBeVisible();
	});
});

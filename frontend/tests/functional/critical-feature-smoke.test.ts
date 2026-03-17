import { expect, test } from '../utils/test-utils.js';

test.describe('Critical Feature Smoke Coverage', () => {
	test('[feature:connectors] connectors page renders and shows configured tab', async ({
		logedPage,
		page
	}) => {
		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(page.getByRole('heading', { name: /connector management/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /configured/i })).toBeVisible();
	});

	test('[feature:assessments_lightning] lightning assessments page renders', async ({
		logedPage,
		page
	}) => {
		await page.goto('/assessments/lightning');
		await expect(page).toHaveURL(/\/assessments\/lightning/);
		await expect(page.getByRole('heading', { name: /lightning assessments/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /new assessment/i })).toBeVisible();
	});

	test('[feature:version_history] version history page renders', async ({ logedPage, page }) => {
		await page.goto('/version-history');
		await expect(page).toHaveURL(/\/version-history/);
		await expect(
			page.getByRole('heading', { level: 1, name: /version history/i })
		).toBeVisible();
	});

	test('[feature:security_graph] security graph page renders', async ({ logedPage, page }) => {
		await page.goto('/security-graph');
		await expect(page).toHaveURL(/\/security-graph/);
		await expect(
			page.getByRole('heading', {
				level: 1,
				name: /security relationship graph|operational graph/i
			})
		).toBeVisible();
		await expect(page.getByRole('button', { name: /attack paths/i })).toBeVisible();
	});

	test('[feature:evidence_automation] evidence automation page renders', async ({
		logedPage,
		page
	}) => {
		await page.goto('/evidence-automation');
		await expect(page).toHaveURL(/\/evidence-automation/);
		await expect(page.getByRole('heading', { name: /evidence automation/i })).toBeVisible();
	});

	test('[feature:workflows] workflow automation page renders', async ({ logedPage, page }) => {
		await page.goto('/workflows');
		await expect(page).toHaveURL(/\/workflows/);
		await expect(page.getByRole('heading', { name: /workflow automation/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /create workflow/i }).first()).toBeVisible();
	});

	test('[feature:oscal] oscal page renders', async ({ logedPage, page }) => {
		await page.goto('/oscal');
		await expect(page).toHaveURL(/\/oscal/);
		await expect(page.getByRole('heading', { level: 1, name: /oscal/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /import/i }).first()).toBeVisible();
	});
});

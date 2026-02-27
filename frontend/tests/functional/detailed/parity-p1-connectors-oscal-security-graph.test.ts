import { randomBytes, randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { expect, test } from '../../utils/test-utils.js';

const uniqueSuffix = () => randomBytes(3).toString('hex');

const createOscalFixture = () => {
	const fixturePath = join(
		process.cwd(),
		'tests',
		'utils',
		`oscal-e2e-${Date.now()}-${uniqueSuffix()}.json`
	);

	const content = {
		'oscal-version': '1.1.2',
		metadata: {
			title: 'Playwright OSCAL E2E',
			version: '1.0.0',
			'last-modified': new Date().toISOString()
		},
		'system-security-plan': {
			uuid: randomUUID(),
			metadata: {
				title: 'Playwright OSCAL E2E SSP'
			},
			'system-characteristics': {
				'system-name': 'Playwright Test System'
			},
			'control-implementation': {
				'implemented-requirements': []
			}
		}
	};

	mkdirSync(dirname(fixturePath), { recursive: true });
	writeFileSync(fixturePath, JSON.stringify(content, null, 2), 'utf-8');
	return fixturePath;
};

const selectAnyExportDocument = async (page: import('@playwright/test').Page) => {
	const exportTypes = ['catalog', 'ssp', 'assessment_plan', 'assessment_results', 'poam'];

	for (const exportType of exportTypes) {
		await page.selectOption('#export-type', exportType);
		await page.waitForTimeout(250);

		const availableOptions = await page
			.locator('#export-document option')
			.evaluateAll((nodes) =>
				nodes
					.map((node) => {
						const option = node as HTMLOptionElement;
						return {
							value: option.value,
							label: option.textContent?.trim() || ''
						};
					})
					.filter((option) => option.value)
			);

		if (availableOptions.length > 0) {
			await page.selectOption('#export-document', availableOptions[0].value);
			return { exportType, documentLabel: availableOptions[0].label };
		}
	}

	return null;
};

const apiJson = async (
	page: import('@playwright/test').Page,
	path: string,
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
	payload?: Record<string, unknown>
) =>
	page.evaluate(
		async ({ path, method, payload }) => {
			const response = await fetch(path, {
				method,
				headers: payload ? { 'Content-Type': 'application/json' } : undefined,
				body: payload ? JSON.stringify(payload) : undefined
			});
			const bodyText = await response.text();
			let bodyJson: Record<string, unknown> | null = null;
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

test.describe('P1 Workflow Cluster - Connectors, OSCAL, Security Graph', () => {
	test('[feature:connectors] user can configure and remove a connector', async ({
		logedPage,
		page
	}) => {
		const connectorName = `PW Connector ${uniqueSuffix()}`;

		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await expect(
			page.getByRole('heading', {
				name: /connector management|gestion des connecteurs/i
			})
		).toBeVisible();

		const availableTabButton = page.getByRole('button', { name: /available|disponible/i }).first();
		await expect
			.poll(
				async () => {
					await availableTabButton.click();
					return page.getByTestId('connector-configure-button').count();
				},
				{ timeout: 30_000 }
			)
			.toBeGreaterThan(0);

		const configureButton = page.getByTestId('connector-configure-button').first();
		await expect(configureButton).toBeVisible();
		await configureButton.click();

		const modal = page.getByTestId('connector-configure-modal');
		await expect(modal).toBeVisible();
		await modal.getByTestId('connector-name-input').fill(connectorName);
		await modal.getByTestId('connector-api-key-input').fill(`token-${uniqueSuffix()}`);

		await modal.getByTestId('connector-save-button').click();
		await expect(modal).not.toBeVisible({ timeout: 20_000 });

		await expect
			.poll(
				async () => {
					const listResult = await apiJson(page, '/api/connectors/instances/', 'GET');
					if (!listResult.bodyJson) {
						return false;
					}
					const payload = listResult.bodyJson as { results?: Array<{ name?: string }> };
					const connectors = Array.isArray(payload.results) ? payload.results : [];
					return connectors.some((connector) => connector.name === connectorName);
				},
				{ timeout: 20_000 }
			)
			.toBe(true);

		await page.goto('/connectors');
		await expect(page).toHaveURL(/\/connectors/);
		await page.getByRole('button', { name: /configured|configuré/i }).first().click();
		const connectorCard = page
			.getByTestId('configured-connector-card')
			.filter({ hasText: connectorName })
			.first();
		await expect(connectorCard).toBeVisible({ timeout: 15_000 });

		const connectorStillExists = async () => {
			const listResult = await apiJson(page, '/api/connectors/instances/', 'GET');
			if (!listResult.bodyJson) {
				return false;
			}
			const payload = listResult.bodyJson as { results?: Array<{ name?: string }> };
			const connectors = Array.isArray(payload.results) ? payload.results : [];
			return connectors.some((connector) => connector.name === connectorName);
		};

		await expect
			.poll(
				async () => {
					if (!(await connectorStillExists())) {
						return true;
					}
					await page.evaluate(() => {
						window.confirm = () => true;
					});
					const deleteButton = connectorCard.getByTestId('connector-delete-button');
					if (await deleteButton.count()) {
						await deleteButton.click().catch(() => undefined);
					}
					await page.waitForTimeout(250);
					return !(await connectorStillExists());
				},
				{ timeout: 30_000 }
			)
			.toBe(true);
		await page.reload();
		await expect(page.getByTestId('configured-connector-card').filter({ hasText: connectorName })).toHaveCount(
			0
		);
	});

	test('[feature:oscal] user can validate, import, and export OSCAL content', async ({
		logedPage,
		page
	}) => {
		const fixturePath = createOscalFixture();

		try {
			await expect(async () => {
				await page.goto('/oscal', { timeout: 30_000 });
				await expect(page).toHaveURL(/\/oscal/);
			}).toPass({ timeout: 60_000, intervals: [500, 1000, 2000] });
			await expect(page.getByRole('heading', { level: 1, name: /oscal/i })).toBeVisible();
			const exportTabButton = page.getByRole('button', { name: /export oscal/i }).first();
			await expect
				.poll(
					async () => {
						await exportTabButton.click();
						return page.locator('#export-type').count();
					},
					{ timeout: 30_000 }
				)
				.toBeGreaterThan(0);
			await page.getByRole('button', { name: /import oscal/i }).first().click();
			await expect(page.getByTestId('oscal-import-file-input')).toBeVisible({ timeout: 20_000 });

			const importFileInput = page.getByTestId('oscal-import-file-input');
			await importFileInput.setInputFiles(fixturePath);
			await expect(importFileInput).toHaveValue(/oscal-e2e-/i);
			await importFileInput.dispatchEvent('change');

			const validateButton = page.getByTestId('oscal-import-validate-button');
			const importButton = page.getByTestId('oscal-import-submit-button');
			await expect(validateButton).toBeEnabled({ timeout: 10_000 });
			await expect(importButton).toBeEnabled({ timeout: 10_000 });

			await validateButton.click();
			await expect(page.locator('div.bg-green-50').first()).toBeVisible({ timeout: 15_000 });

			await importButton.click();
			await expect(page.locator('div.bg-green-50').first()).toBeVisible({ timeout: 15_000 });

			await page.getByRole('button', { name: /export|exporter/i }).first().click();

			const selectedExport = await selectAnyExportDocument(page);
			expect(selectedExport).not.toBeNull();
			if (!selectedExport) {
				return;
			}

			const exportResponsePromise = page.waitForResponse(
				(response) =>
					response.url().includes('/api/oscal/export/') &&
					response.request().method() === 'GET'
			);
			await page.getByTestId('oscal-export-submit-button').click();
			const exportResponse = await exportResponsePromise;
			expect(exportResponse.ok()).toBeTruthy();
		} finally {
			rmSync(fixturePath, { force: true });
		}
	});

	test('[feature:security_graph] user can find an attack path from graph data', async ({
		logedPage,
		page
	}) => {
		const suffix = uniqueSuffix();
		const folderName = `PW SG Domain ${suffix}`;
		const targetAssetName = `PW SG Target ${suffix}`;
		const entryAssetName = `PW SG Entry ${suffix}`;

		const folderCreate = await apiJson(page, '/api/folders/', 'POST', {
			name: folderName,
			description: 'Security graph E2E domain'
		});
		expect([200, 201]).toContain(folderCreate.status);
		const folderId = (folderCreate.bodyJson as { id?: string } | null)?.id || '';
		expect(folderId).toBeTruthy();

		const targetAssetCreate = await apiJson(page, '/api/assets/', 'POST', {
			name: targetAssetName,
			description: 'Target asset for attack-path test',
			folder: folderId,
			type: 'PR'
		});
		expect([200, 201]).toContain(targetAssetCreate.status);
		const targetAssetId = (targetAssetCreate.bodyJson as { id?: string } | null)?.id || '';
		expect(targetAssetId).toBeTruthy();

		const entryAssetCreate = await apiJson(page, '/api/assets/', 'POST', {
			name: entryAssetName,
			description: 'Entry asset for attack-path test',
			folder: folderId,
			type: 'PR',
			parent_assets: [targetAssetId]
		});
		expect([200, 201]).toContain(entryAssetCreate.status);
		const entryAssetId = (entryAssetCreate.bodyJson as { id?: string } | null)?.id || '';
		expect(entryAssetId).toBeTruthy();

		await page.goto('/security-graph');
		await expect(page).toHaveURL(/\/security-graph/);
		const attackPathsTabButton = page.getByRole('button', { name: /attack paths/i }).first();
		await expect
			.poll(
				async () => {
					await attackPathsTabButton.click();
					return page.locator('#entry-point-select').count();
				},
				{ timeout: 30_000 }
			)
			.toBeGreaterThan(0);
		await expect(page.locator('#entry-point-select')).toBeVisible();
		await expect(page.locator('#target-select')).toBeVisible();

		await expect
			.poll(async () => await page.locator(`#entry-point-select option[value="${entryAssetId}"]`).count(), {
				timeout: 20_000
			})
			.toBeGreaterThan(0);
		await expect
			.poll(async () => await page.locator(`#target-select option[value="${targetAssetId}"]`).count(), {
				timeout: 20_000
			})
			.toBeGreaterThan(0);

		await page.selectOption('#entry-point-select', entryAssetId);
		await page.selectOption('#target-select', targetAssetId);

		await page.getByRole('button', { name: /find attack paths/i }).click();

		const firstPathCard = page.locator('div.border.border-red-200').first();
		await expect(firstPathCard).toBeVisible({ timeout: 15_000 });
		await expect(firstPathCard).toContainText(entryAssetName);
		await expect(firstPathCard).toContainText(targetAssetName);
	});
});

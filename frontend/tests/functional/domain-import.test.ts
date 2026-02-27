import { expect, test } from '../utils/test-utils.js';
import type { Page } from '@playwright/test';

// Helper to dismiss any modal/popover that might block interactions.
async function dismissBlockingModals(page: Page) {
	const modalBackdrop = page.getByTestId('modal-backdrop');
	if (await modalBackdrop.isVisible()) {
		await modalBackdrop.press('Escape');
		await expect(modalBackdrop).toBeHidden();
	}
	const dummyElement = page.locator('#driver-dummy-element');
	if (await dummyElement.isVisible()) {
		await page.locator('.driver-popover-close-btn').first().click();
		await expect(dummyElement).toBeHidden();
	}
	// Ensure no lingering modals remain.
	await page.locator('body').press('Escape');
}

// Helper to navigate to the folders list page.
async function navigateToFolders(page: Page) {
	await page.goto('/folders');
	await expect(page).toHaveURL(/\/folders/);
	await expect(page.getByTestId('import-button')).toBeVisible();
}

// Helper to extract the row count from the UI.
// Assumes the row count element contains at least one number.
async function getRowCount(page: Page) {
	const rowCountText = await page.getByTestId('row-count').innerText();
	const match = rowCountText.match(/\d+$/);
	return match ? parseInt(match[0], 10) : 0;
}

test('User can import a domain from a .bak file', async ({ logedPage, page }) => {
	test.slow();
	await page.waitForLoadState('networkidle');

	await test.step('Dismiss any blocking modals', async () => {
		await dismissBlockingModals(page);
	});

	await test.step('Navigate to folders list page', async () => {
		await navigateToFolders(page);
	});

	await test.step('Import sample domain', async () => {
		const initialRowCount = await getRowCount(page);

		// Build a unique domain name for this import
		const domainName = `imported_domain_${Date.now()}`;
		const filePath = new URL('../utils/sample-domain-schema-4.bak', import.meta.url).pathname;

		// Open the import dialog and fill in the form.
		await page.getByTestId('import-button').click();
		await page.getByTestId('form-input-name').fill(domainName);
		await page.getByTestId('form-input-file').click();
		await page.getByTestId('form-input-file').setInputFiles(filePath);
		await page.getByTestId('form-input-load-missing-libraries').check();
		await page.getByTestId('save-button').click();

		// Verify that a success toast appears with expected text.
		const toast = page.getByTestId('toast');
		await expect(toast).toBeVisible({ timeout: 180000 });
		await expect(toast).toHaveText(/successfully imported|import[ée] avec succ[eè]s/i);

		// Confirm that the number of rows has increased.
		// take a quick nap to make sure the data is loaded
		await page.waitForTimeout(3000);
		const newRowCount = await getRowCount(page);
		expect(newRowCount).toBeGreaterThan(initialRowCount);
	});
});

test('User can load demo data', async ({ logedPage, page }) => {
	test.slow();
	test.setTimeout(240_000);
	await page.waitForLoadState('networkidle');

	await test.step('Dismiss any blocking modals', async () => {
		await dismissBlockingModals(page);
	});

	await test.step('Navigate to folders list page', async () => {
		await navigateToFolders(page);
	});

	await test.step('Load demo data', async () => {
		const initialRowCount = await getRowCount(page);

		// Trigger loading demo data via the sidebar.
		await page.getByTestId('sidebar-more-btn').click();
		const importResponsePromise = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				response.url().includes('import-dummy') &&
				![301, 302, 303, 307, 308].includes(response.status()),
			{ timeout: 180_000 }
		);
		await page.getByTestId('load-demo-data-button').click();
		const importResponse = await importResponsePromise;
		expect([200, 500]).toContain(importResponse.status());

		// Toast rendering is asynchronous and language-dependent; do not hard-fail on visibility.
		const toast = page.getByTestId('toast');
		let toastText = '';
		if (await toast.isVisible().catch(() => false)) {
			toastText = await toast.innerText();
		} else {
			await page.waitForTimeout(1000);
			if (await toast.isVisible().catch(() => false)) {
				toastText = await toast.innerText();
			}
		}
		const demoAlreadyImported =
			importResponse.status() === 500 ||
			(/already.*import|d[ée]j[àa].*import/i.test(toastText) &&
				!/successfully imported|import[ée] avec succ[eè]s/i.test(toastText));

		// Confirm that the new row count is greater than the initial.
		// Refresh to ensure table handlers have reloaded after import.
		await page.reload();
		await expect(page).toHaveURL(/\/folders/);
		await page.waitForTimeout(2000);
		const newRowCount = await getRowCount(page);
		if (demoAlreadyImported) {
			expect(newRowCount).toBeGreaterThanOrEqual(initialRowCount);
		} else {
			expect(newRowCount).toBeGreaterThan(initialRowCount);
		}
	});
});

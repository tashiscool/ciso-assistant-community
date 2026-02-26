import { expect, test } from '../utils/test-utils.js';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const gunzipAsync = promisify(gunzip);

test('Database export should generate valid backup file', async ({ logedPage, page }) => {
	await page.waitForLoadState('networkidle');
	const modalBackdrop = page.getByTestId('modal-backdrop');
	const exportCard = page.locator('div.card').filter({
		has: page.locator('h4 i.fa-download')
	});
	const importCard = page.locator('div.card').filter({
		has: page.locator('h4 i.fa-upload')
	});

	await test.step('Dismiss any blocking modals', async () => {
		if (await modalBackdrop.isVisible()) {
			await modalBackdrop.press('Escape');
			await expect(modalBackdrop).not.toBeVisible();
		}

		if (await page.locator('#driver-dummy-element').isVisible()) {
			await page.locator('.driver-popover-close-btn').first().click();
		}
	});

	// Attempt to close any remaining modals
	await page.locator('body').press('Escape');

	await test.step('Navigate to backup/restore section', async () => {
		await page.getByTestId('accordion-item-extra').click();
		await page.getByTestId('accordion-item-backup-restore').click();
		await expect(page).toHaveURL(/\/backup-restore$/);
		await expect(exportCard.locator('button').first()).toBeVisible();
	});

	await test.step('Initiate and verify database export', async () => {
		const downloadPromise = page.waitForEvent('download');
		await exportCard.locator('button').first().click();

		const download = await downloadPromise;
		const fileName = download.suggestedFilename();

		// Verify filename pattern
		await test.step('Verify download metadata', async () => {
			expect(fileName.endsWith('.bak')).toBeTruthy();
		});

		await test.step('Verify file contents', async () => {
			const stream = await download.createReadStream();
			if (!stream) {
				throw new Error('Failed to obtain download stream');
			}
			// Collect chunks from the stream into a buffer
			const chunks: Buffer[] = [];
			for await (const chunk of stream) {
				chunks.push(chunk as Buffer);
			}
			const buffer = Buffer.concat(chunks);
			expect(buffer.length).toBeGreaterThan(0);

			// Decompress the gzip content to extract the JSON file
			const decompressedBuffer = await gunzipAsync(buffer);
			const jsonString = decompressedBuffer.toString('utf-8');
			expect(jsonString.length).toBeGreaterThan(0);

			// Parse the JSON and assert that it is valid.
			let jsonData;
			try {
				jsonData = JSON.parse(jsonString);
			} catch (error) {
				throw new Error('Decompressed content is not valid JSON');
			}
			expect(jsonData).toBeDefined();
			// expect(jsonData).toHaveProperty('meta');
		});

		await test.step('Save downloaded file', async () => {
			await download.saveAs(`./${fileName}`);
		});

		await test.step('Check that export file can be imported back', async () => {
			await page.locator('#file').click();
			await page.locator('#file').setInputFiles(fileName);
			await importCard.locator('button[type="button"]').first().click();
			const modal = page.getByTestId('modal-component');
			await expect(modal).toBeVisible();
			const confirmInput = modal.getByTestId('delete-prompt-confirm-textfield');
			const confirmButton = modal.locator('footer button').last();
			await confirmInput.click();
			await confirmInput.fill('yes');
			if (await confirmButton.isDisabled()) {
				await confirmInput.fill('oui');
			}
			await expect(confirmButton).toBeEnabled();
			await confirmButton.click();

			// Depending on backend/session settings, import may either keep the session
			// or force a login refresh.
			await expect
				.poll(() => page.url(), { timeout: 30_000 })
				.toMatch(/\/(login\?next=\/backup-restore|backup-restore)$/);
		});
	});
});

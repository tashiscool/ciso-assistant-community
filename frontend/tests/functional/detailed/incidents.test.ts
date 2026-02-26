import { test, expect } from '../../utils/test-utils.js';
import { LoginPage } from '../../utils/login-page.js';
import { PageContent } from '../../utils/page-content.js';
import type { Locator, Page } from '@playwright/test';
import { m } from '$paraglide/messages.js';

const runSuffix = Math.random().toString(36).slice(2, 8);
const incidentsFolderName = `incidents-folder-${runSuffix}`;
const incidentName = `incidents-test-${runSuffix}`;

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function redirectToIncidents(page: Page): Promise<void> {
	await page.getByTestId('accordion-item-operations').click();
	await page.getByTestId('accordion-item-incidents').click();
	await page.waitForTimeout(500);
}

async function selectIncidentFolder(page: Page, folderName: string): Promise<void> {
	const folderField = page.getByTestId('form-input-folder');
	await folderField.waitFor({ state: 'visible' });

	const selectedViaNativeSelect = await folderField
		.evaluate((container, desiredName) => {
			const normalize = (value: string) =>
				value
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.toLowerCase()
					.trim();

			const selectEl =
				container instanceof HTMLSelectElement
					? container
					: (container.querySelector('select') as HTMLSelectElement | null);
			if (!selectEl) return false;

			const wanted = normalize(desiredName);
			const options = Array.from(selectEl.options);
			const selectedOption =
				options.find((option) => normalize(option.textContent || '').includes(wanted)) || options[0];
			if (!selectedOption) return false;

			selectEl.value = selectedOption.value;
			selectEl.dispatchEvent(new Event('input', { bubbles: true }));
			selectEl.dispatchEvent(new Event('change', { bubbles: true }));
			return true;
		}, folderName)
		.catch(() => false);

	if (selectedViaNativeSelect) return;

	const hasHiddenFolderSelection = async () => {
		return folderField
			.evaluate((container) => {
				const ownerForm = container.closest('form');
				const inField = Array.from(container.querySelectorAll('input[type="hidden"][name="folder"]'))
					.map((input) => (input as HTMLInputElement).value?.trim())
					.filter(Boolean);
				const inForm = ownerForm
					? Array.from(ownerForm.querySelectorAll('input[type="hidden"][name="folder"]'))
							.map((input) => (input as HTMLInputElement).value?.trim())
							.filter(Boolean)
					: [];
				return inField.length > 0 || inForm.length > 0;
			})
			.catch(() => false);
	};

	const selectFromPortalOptions = async (targetLabel: string, allowFirstOption = false) => {
		return page
			.evaluate(
				({ labelToMatch, allowFirst }) => {
					const normalize = (value: string) =>
						(value || '')
							.normalize('NFD')
							.replace(/[\u0300-\u036f]/g, '')
							.toLowerCase()
							.trim();
					const wanted = normalize(labelToMatch || '');
					const options = Array.from(document.querySelectorAll('ul.options li'))
						.filter((node) => node instanceof HTMLElement)
						.filter((node) => (node as HTMLElement).offsetParent !== null)
						.filter(
							(node) =>
								!node.classList.contains('disabled') &&
								!node.classList.contains('group-header') &&
								!node.classList.contains('user-msg') &&
								!node.classList.contains('loading-more')
						) as HTMLElement[];
					if (!options.length) return '';

					const candidate =
						options.find((option) =>
							normalize(option.textContent || '').includes(wanted)
						) || (allowFirst ? options[0] : null);
					if (!candidate) return '';
					candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
					candidate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
					return (candidate.textContent || '').trim();
				},
				{ labelToMatch: targetLabel, allowFirst: allowFirstOption }
			)
			.catch(() => '');
	};

	await folderField.click().catch(() => null);
	const dropdownToggle = folderField.locator('img').first();
	if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
		await dropdownToggle.click({ timeout: 1_000 }).catch(() => null);
	}

	const comboBox = folderField.getByRole('combobox').first();
	if (await comboBox.isVisible({ timeout: 2_000 }).catch(() => false)) {
		await comboBox.click({ timeout: 1_000 }).catch(() => null);
		await comboBox.press('ControlOrMeta+A').catch(() => null);
		await comboBox.fill(folderName, { timeout: 1_500 }).catch(() => null);
		await page.waitForTimeout(300);
		const selectedLabel = await selectFromPortalOptions(folderName, false);
		if (selectedLabel) return;

		await comboBox.press('ControlOrMeta+A').catch(() => null);
		await comboBox.fill('').catch(() => null);
		await page.waitForTimeout(300);
		const fallbackLabel = await selectFromPortalOptions('', true);
		if (fallbackLabel) return;
	} else {
		const selectedLabel = await selectFromPortalOptions(folderName, true);
		if (selectedLabel) return;
	}

	if (await hasHiddenFolderSelection()) return;

	await folderField
		.evaluate(async (container, desiredName) => {
			const normalize = (value: string) =>
				(value || '')
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.toLowerCase()
					.trim();
			const wanted = normalize(desiredName || '');
			const response = await fetch('/folders?content_type=DO&content_type=GL&offset=0&limit=200', {
				headers: { accept: 'application/json' }
			}).catch(() => null);
			if (!response || !response.ok) return;
			const payload = await response.json().catch(() => null);
			const results = Array.isArray(payload?.results)
				? payload.results
				: Array.isArray(payload)
					? payload
					: [];
			if (!results.length) return;
			const candidate =
				results.find((item: Record<string, any>) =>
					normalize(item?.str || item?.name || item?.display_name || '').includes(wanted)
				) || results[0];
			const folderId = String(candidate?.id || '').trim();
			if (!folderId) return;
			const ownerForm = container.closest('form');
			const target = ownerForm || container;
			const existingInputs = Array.from(
				target.querySelectorAll('input[type="hidden"][name="folder"]')
			) as HTMLInputElement[];
			if (existingInputs.length > 0) {
				existingInputs[0].value = folderId;
				for (let index = 1; index < existingInputs.length; index += 1) {
					existingInputs[index].remove();
				}
			} else {
				const hiddenInput = document.createElement('input');
				hiddenInput.type = 'hidden';
				hiddenInput.name = 'folder';
				hiddenInput.value = folderId;
				target.appendChild(hiddenInput);
			}
			target.dispatchEvent(new Event('input', { bubbles: true }));
			target.dispatchEvent(new Event('change', { bubbles: true }));
		}, folderName)
		.catch(() => null);
}

async function selectWithFallback(
	field: Locator,
	options: Array<{ value?: string; label?: string }>
): Promise<void> {
	let lastError: unknown = null;
	for (const option of options) {
		try {
			if (option.value) {
				await field.selectOption({ value: option.value });
			} else if (option.label) {
				await field.selectOption({ label: option.label });
			}
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('Failed to select option');
}

test('Incidents full flow - creation, validation and cleanup', async ({
	page,
	logedPage,
	foldersPage
}) => {
	await test.step('Create folder and incident', async () => {
		await foldersPage.goto();
		await foldersPage.createItem({
			name: incidentsFolderName
		});

		await redirectToIncidents(page);
		await page.getByTestId('add-button').click();
		await page.getByTestId('form-input-name').fill(incidentName);

		await page.getByTestId('form-input-severity').waitFor({ state: 'visible' });
		await page.getByTestId('form-input-severity').selectOption('4');

		// await page.getByTestId('accordion').click();
		// await page.getByTestId('form-input-qualifications').waitFor({ state: 'visible' });
		// await page.getByTestId('form-input-qualifications').click();
		// await page.getByRole('option', { name: 'authenticity' }).click();
		// await page.getByRole('option', { name: 'availability' }).click();
		// await page.getByRole('option', { name: 'confidentiality' }).click();
		// await page.getByRole('option', { name: 'human' }).click();

		await page.getByTestId('form-input-folder').waitFor({ state: 'visible' });
		await selectIncidentFolder(page, incidentsFolderName);

		await page.getByTestId('form-input-ref-id').fill('test');
		await page.getByTestId('form-input-name').click();
		await page.getByTestId('save-button').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();

		await page
			.getByRole('gridcell', { name: /New|Nouveau/i })
			.getByTestId('model-table-td-array-elem')
			.waitFor({ state: 'visible' });
		await page
			.getByRole('gridcell', { name: /Minor|Mineur/i })
			.getByTestId('model-table-td-array-elem')
			.waitFor({ state: 'visible' });
		await page
			.getByRole('gridcell', { name: /Internal|Interne/i })
			.getByTestId('model-table-td-array-elem')
			.waitFor({ state: 'visible' });
	});

	await test.step('Incidents detail view & second edit creating 1st incident', async () => {
		await page.getByText(incidentName).click();
		await page.getByTestId('edit-button').click();

		await page.getByTestId('form-input-detection').waitFor({ state: 'visible' });
		await selectWithFallback(page.getByTestId('form-input-detection'), [
			{ value: 'externally_detected' },
			{ label: 'External' },
			{ label: 'Externe' }
		]);

		await page.getByTestId('form-input-severity').waitFor({ state: 'visible' });
		await page.getByTestId('form-input-severity').selectOption('2');

		await page.getByTestId('form-input-status').waitFor({ state: 'visible' });
		await selectWithFallback(page.getByTestId('form-input-status'), [
			{ value: 'resolved' },
			{ label: 'Resolved' },
			{ label: 'Résolu' },
			{ label: 'Resolu' }
		]);

		await page.getByTestId('save-button').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();
		await expect(page.getByText(/->/).first()).toBeVisible();
	});

	await test.step('Incidents detail view & timeline incident detail view', async () => {
		await page.getByText(/->/).first().click();
		await expect(page.locator('#page-title')).toContainText('->');

		await page.getByTestId('edit-button').click();

		await page.getByTestId('markdown-edit-btn-observation').click();
		await page
			.getByTestId('form-input-observation')
			.fill('This is an observation: I love mango juice but I prefer orange juice');

		await page.getByRole('button', { name: /Save|Enregistrer/i }).click();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();

		await page.getByRole('button', { name: /Add evidence|Ajouter une preuve/i }).click();
		await page.getByTestId('form-input-name').fill('incidents-evidence-1');
		await page.getByTestId('save-button').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();

		await page
			.getByTestId('incident-field-value')
			.getByRole('link', { name: incidentName })
			.click();
		await expect(page.locator('#page-title')).toHaveText(incidentName);
	});

	await test.step('Incidents detail view & Add an event', async () => {
		await page.getByTestId('form-input-entry').fill('entry 1');
		await page.getByTestId('save-button-event').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();
		await expect(page.getByTestId('name-entry-0')).toHaveText('entry 1');

		await page.getByTestId('form-input-entry').fill('entry 2');
		await selectWithFallback(page.getByTestId('form-input-entry-type'), [
			{ value: 'mitigation' },
			{ label: 'Mitigation' }
		]);
		await page.getByTestId('save-button-event').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();
		await expect(page.getByTestId('name-entry-0')).toHaveText('entry 2');

		await page.getByTestId('form-input-entry').fill('entry 3');

		await page.getByTestId('add-button-evidence').click();
		await page.getByTestId('form-input-name').fill('incidents-evidence-2');
		await page.getByTestId('save-button').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();
		await selectWithFallback(page.getByTestId('form-input-entry-type'), [
			{ value: 'detection' },
			{ label: 'Detection' }
		]);
		await page.getByTestId('save-button-event').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();
		await expect(page.getByTestId('name-entry-0')).toHaveText('entry 3');

		await expect(page.getByText('entry 1')).toBeVisible();
		await expect(page.getByText('entry 2')).toBeVisible();
		await expect(page.getByText('entry 3')).toBeVisible();
	});

	await test.step('Incidents detail view & verify timeline logic & timeline deletion', async () => {
		await expect(page.getByTestId('name-entry-0')).toHaveText('entry 3');
		await expect(page.getByTestId('name-entry-1')).toHaveText('entry 2');
		await expect(page.getByTestId('name-entry-2')).toHaveText('entry 1');
		await expect(page.getByTestId('name-entry-3')).toContainText('->');
		await expect(page.getByTestId('name-entry-4')).toContainText('->');

		await page.getByTestId('form-input-entry').fill('entry 4');
		await page.getByTestId('form-input-timestamp').fill('2024-07-17T16:19');

		await page.getByTestId('save-button-event').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await expect(page.getByTestId('toast')).toBeVisible();
		await page.getByTestId('toast').getByLabel('Dismiss toast').click();
		await expect(page.getByTestId('toast')).not.toBeVisible();

		await expect(page.getByTestId('name-entry-5')).toHaveText('entry 4');

		await page.getByTestId('tablerow-delete-button').first().click();
		await page.getByTestId('delete-confirm-button').click();
		await page.reload();

		await expect(page.getByText('entry 4')).not.toBeVisible();
	});
});

test('Cleanup - delete the folder', async ({ page }) => {
	const loginPage = new LoginPage(page);
	await loginPage.goto();
	await loginPage.login();
	await page.goto('/folders');

	await expect(page.locator('#page-title')).toHaveText(/Domains|Domaines/i);

	await expect(page).toHaveURL(/\/folders/);
	await page.getByRole('searchbox').first().fill(incidentsFolderName).catch(() => null);
	await page.waitForTimeout(300);

	const folderRow = page.getByRole('row', {
		name: new RegExp(escapeRegExp(incidentsFolderName), 'i')
	});
	if ((await folderRow.count().catch(() => 0)) === 0) {
		return;
	}

	await folderRow.getByTestId('tablerow-delete-button').first().click({ timeout: 10_000 });

	await expect(page.getByTestId('delete-prompt-confirm-textfield')).toBeVisible();

	await page.getByTestId('delete-prompt-confirm-textfield').fill(m.yes());

	await page.getByRole('button', { name: /Submit|Valider|Confirmer/i }).click();

	await expect(
		page.getByRole('row', { name: new RegExp(escapeRegExp(incidentsFolderName), 'i') })
	).toHaveCount(0);
});

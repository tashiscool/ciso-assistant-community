import { expect, type Locator, type Page } from './test-utils.js';
import { FormContent, FormFieldType } from './form-content.js';
import { BasePage } from './base-page.js';
import { PageDetail } from './page-detail.js';

interface Filter {
	has?: Locator | undefined;
	hasNot?: Locator;
	hasNotText?: string | RegExp;
	hasText?: string | RegExp;
	visible?: boolean;
}

export class PageContent extends BasePage {
	readonly form: FormContent;
	readonly itemDetail: PageDetail;
	readonly addButton: Locator;
	readonly importButton: Locator;
	readonly editButton: Locator;
	readonly searchInput: Locator;
	readonly deleteModalTitle: Locator;
	readonly deleteModalConfirmButton: Locator;
	readonly deleteModalCancelButton: Locator;
	readonly deleteModalPromptConfirmButton: Locator;
	readonly deleteModalPromptConfirmText: Locator;
	private lastCreatedItemId: string | null;

	constructor(
		public readonly page: Page,
		url: string,
		name: string | RegExp,
		fields: { name: string; type: FormFieldType }[] = [
			{ name: 'name', type: FormFieldType.TEXT },
			{ name: 'description', type: FormFieldType.TEXT }
		]
	) {
		super(page, url, name);
		this.form =
			typeof name == 'string'
				? new FormContent(page, 'New ' + name.substring(0, name.length - 1), fields)
				: new FormContent(page, new RegExp(/New /.source + name.source), fields);
		this.itemDetail = new PageDetail(page, url, this.form, '');
		this.addButton = this.page.getByTestId('add-button');
		this.importButton = this.page.getByTestId('import-button');
		this.editButton = this.page.getByTestId('edit-button');
		this.searchInput = this.page.getByRole('searchbox').first();
		this.deleteModalTitle = this.page.getByTestId('modal-title');
		this.deleteModalConfirmButton = this.page.getByTestId('delete-confirm-button');
		this.deleteModalCancelButton = this.page.getByTestId('delete-cancel-button');
		this.deleteModalPromptConfirmButton = this.page.getByTestId('delete-prompt-confirm-button');
		this.deleteModalPromptConfirmText = this.page.getByTestId('delete-prompt-confirm-text');
		this.lastCreatedItemId = null;
	}

	async createItem(
		values: { [k: string]: any },
		dependency?: any,
		page?: Page,
		addButtonValue?: string
	) {
		this.lastCreatedItemId = null;
		if (dependency) {
			await this.page.goto('/libraries');
			await this.page.waitForURL('/libraries');

			await this.importLibrary(dependency.name, dependency.urn);
			await this.goto();
		}

		// Open creation modal with retries to absorb transient UI overlays/animation timing.
		let opened = false;
		for (let attempt = 0; attempt < 3; attempt++) {
			const addButtonLocator =
				addButtonValue === undefined
					? this.page.locator('[data-testid="add-button"]:visible').first()
					: this.page
							.locator('[data-testid="add-button"]:visible')
							.filter({ hasText: addButtonValue })
							.first();
			await expect(addButtonLocator).toBeVisible({ timeout: 10_000 });
			await addButtonLocator.click({ timeout: 10_000 });
			opened = await this.form.formTitle
				.waitFor({ state: 'visible', timeout: 5_000 })
				.then(() => true)
				.catch(() => false);
			if (!opened) {
				await this.page.keyboard.press('c').catch(() => null);
				opened = await this.form.formTitle
					.waitFor({ state: 'visible', timeout: 2_000 })
					.then(() => true)
					.catch(() => false);
			}
			if (opened) break;
			await this.page.locator('body').press('Escape').catch(() => null);
			await this.page.waitForTimeout(400);
		}
		if (!opened) {
			throw new Error(`Could not open create modal on ${this.url}`);
		}
		await this.form.hasTitle();
		if (page) {
			await page.waitForLoadState('networkidle');
		}

		await this.form.fill(values);

		// Ensure required folder selection is set for forms where autocomplete can stay empty.
		const folderField = this.page.getByTestId('form-input-folder');
		if (await folderField.isVisible({ timeout: 1_000 }).catch(() => false)) {
			const hasFolderSelection = await folderField
				.evaluate((container) => {
					const hiddenFolderValues = Array.from(
						container.querySelectorAll('input[type="hidden"][name="folder"]')
					)
						.map((input) => (input as HTMLInputElement).value?.trim())
						.filter((value) => Boolean(value));
					if (hiddenFolderValues.length > 0) return true;

					const selectedList = container.querySelector('[aria-label="selected options"]');
					if (!selectedList) return false;
					const selectedLabels = Array.from(selectedList.children)
						.filter((child) => child instanceof HTMLElement)
						.filter((child) => !child.querySelector('[role="combobox"], input, textarea'))
						.map((child) => child.textContent?.trim() ?? '')
						.filter((value) => value.length > 0);
					return selectedLabels.length > 0;
				})
				.catch(() => false);
			if (!hasFolderSelection) {
				await folderField.click();
				const desiredFolder =
					typeof values.folder === 'string'
						? values.folder
						: typeof values.folder === 'object' &&
							  values.folder &&
							  'value' in values.folder &&
							  typeof values.folder.value === 'string'
							? values.folder.value
							: '';
				const escapedDesiredFolder = desiredFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const desiredOption = desiredFolder
					? this.page.getByRole('option', { name: new RegExp(escapedDesiredFolder, 'i') }).first()
					: this.page.getByRole('option').first();
					if (await desiredOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
						await desiredOption.click();
					} else {
						const firstOption = this.page.getByRole('option').first();
						if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
							await firstOption.click();
						}
					}

					const hasFolderSelectionAfterFallback = await folderField
						.evaluate((container) => {
							const hiddenFolderValues = Array.from(
								container.querySelectorAll('input[type="hidden"][name="folder"]')
							)
								.map((input) => (input as HTMLInputElement).value?.trim())
								.filter((value) => Boolean(value));
							return hiddenFolderValues.length > 0;
						})
						.catch(() => false);
					if (!hasFolderSelectionAfterFallback) {
						throw new Error('Folder autocomplete remained empty after fallback selection');
					}
				}
			}

		// If parent_folder field is visible and enabled (enterprise edition) and not already provided, fill it with 'Global'
		const parentFolderField = this.page.getByTestId('form-input-parent-folder');
		if (
			!values.parent_folder &&
			(await parentFolderField.isVisible({ timeout: 1000 }).catch(() => false))
		) {
			const isDisabled = await parentFolderField
				.locator('.disabled')
				.first()
				.isVisible()
				.catch(() => false);
			if (!isDisabled) {
				await parentFolderField.click();
				await parentFolderField.getByRole('option', { name: 'Global' }).first().click();
			}
		}

		const createActionResponsePromise = this.page
			.waitForResponse(
				(response) =>
					response.request().method() === 'POST' && response.url().includes(`${this.url}?/create`),
				{ timeout: 20_000 }
			)
			.catch(() => null);

		await this.form.saveButton.click();

		const createActionResponse = await createActionResponsePromise;
		if (createActionResponse && createActionResponse.ok()) {
			const body = await createActionResponse.text().catch(() => '');
			const createdItemId = this.extractCreatedItemId(body);
			if (createdItemId) {
				this.lastCreatedItemId = createdItemId;
			}
		}
		await expect(this.form.formTitle).not.toBeVisible();
		const modelSpecificToastPattern =
			typeof this.name == 'string'
				? 'The ' +
					this.name.substring(0, this.name.length - 1).toLowerCase() +
					' object has been successfully created' +
					/.+/.source
				: 'The ' + this.name.source + ' object has been successfully created' + /.+/.source;
		const modelSpecificToastFlags = typeof this.name == 'string' ? undefined : 'i';
		await this.isToastVisible(modelSpecificToastPattern, modelSpecificToastFlags, {
			optional: true,
			timeout: 10_000
		});
		await this.isToastVisible('successfully created', 'i', {
			optional: true,
			timeout: 10_000
		});
	}

	async importLibrary(name: string, urn?: string, language = 'English') {
		await this.page.waitForTimeout(3000);
		await this.page.getByRole('searchbox').first().clear();
		await this.page.getByRole('searchbox').first().fill(name);
		await this.page.waitForTimeout(3000);

		const filters = [
			{ has: this.page.getByText(name, { exact: true }).first() },
			{ has: this.page.getByText(language).first() }
		];
		const row = this.getRow(name, filters);

		const isAlreadyLoaded = await row.getByTestId('tablerow-import-button').isHidden();
		if (isAlreadyLoaded) return;

		const importButton = row.getByTestId('tablerow-import-button');
		await importButton.click();

		await this.isToastVisible(`The library has been successfully loaded.+`, undefined, {
			timeout: 15000
		});
	}

	async viewItemDetail(value?: string) {
		if (value) {
			const rowByValue = this.getRow(value, [
				{ has: this.page.getByTestId('tablerow-detail-button').first() }
			]);
			if (await rowByValue.isHidden().catch(() => true)) {
				await this.searchInput.fill(value);
				await this.searchInput.press('Enter').catch(() => null);
				await this.page.waitForTimeout(1200);
			}

			const rowVisibleAfterSearch = await rowByValue
				.isVisible({ timeout: 2000 })
				.catch(() => false);
			if (rowVisibleAfterSearch) {
				await rowByValue.getByTestId('tablerow-detail-button').click();
				this.itemDetail.setItem(value);
			} else {
				const itemId = this.lastCreatedItemId ?? (await this.findItemIdByName(value));
				if (!itemId) {
					throw new Error(
						`Could not find "${value}" in table rows or via list API lookup on ${this.url}`
					);
				}
				await this.page.goto(`${this.url}/${itemId}`);
				this.itemDetail.setItem(value);
			}
		} else {
			await this.getRow().getByTestId('tablerow-detail-button').click();
			this.itemDetail.setItem(await this.getRow().innerText());
		}
		await this.page.waitForURL(new RegExp('^.*\\' + this.url + '/.+'));
	}

	private async findItemIdByName(value: string): Promise<string | null> {
		return this.page.evaluate(
			async ({ url, itemName }) => {
				const normalizedValue = itemName.toLowerCase();
				const limit = 100;
				const matches = (item: Record<string, any>) => {
					const candidates: unknown[] = [
						item?.name,
						item?.str,
						item?.display_name,
						item?.title,
						item?.ref_id,
						item?.perimeter?.str,
						item?.folder?.str
					];
					return candidates.some(
						(candidate) =>
							typeof candidate === 'string' &&
							candidate.toLowerCase().includes(normalizedValue)
					);
				};

				for (let offset = 0; offset < 10_000; offset += limit) {
					const response = await fetch(`${url}?offset=${offset}&limit=${limit}`, {
						headers: { accept: 'application/json' }
					}).catch(() => null);
					if (!response || !response.ok) return null;

					const payload = await response.json().catch(() => null);
					const results = Array.isArray(payload?.results) ? payload.results : [];
					const match = results.find((row) => matches(row));
					if (match?.id && typeof match.id === 'string') return match.id;

					const count = Number(payload?.count ?? 0);
					if (!Number.isFinite(count) || count <= 0 || offset + limit >= count) break;
				}
				return null;
			},
			{ url: this.url, itemName: value }
		);
	}

	private extractCreatedItemId(actionResponseBody: string): string | null {
		if (!actionResponseBody) return null;
		const escapedURL = this.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const match = actionResponseBody.match(new RegExp(`${escapedURL}/([0-9a-fA-F-]{36})`));
		return match?.[1] ?? null;
	}

	/**
	 * Get the first table row that matches the given substring and optional filters
	 *
	 * @param substring Substring to look for within the row (case-insensitive search).
	 * @param filters Extra filters passed to the locator with the `locator.filter` method.
	 * @returns The first matching row.
	 */
	getRow(substring?: string, filters: Filter[] = []): Locator {
		const substringSearch = { name: substring };
		let rowLocator = this.page.getByRole('row', substringSearch);

		for (const filterOptions of filters) {
			rowLocator = rowLocator.filter(filterOptions);
		}

		const firstMatchingFound = rowLocator.first();
		return firstMatchingFound;
	}

	collumnHeader(value: string) {
		return this.page.getByTestId('tableheader').filter({ hasText: value });
	}

	tab(value: string) {
		return this.page.getByTestId('tabs-control').filter({ hasText: value });
	}

	editItemButton(value: string) {
		return this.getRow(value).getByTestId('tablerow-edit-button');
	}

	deleteItemButton(value: string) {
		return this.getRow(value).getByTestId('tablerow-delete-button');
	}

	deletePromptConfirmTextField() {
		return this.page.getByTestId('delete-prompt-confirm-textfield');
	}

	deletePromptConfirmButton() {
		return this.page.getByTestId('delete-prompt-confirm-button');
	}
}

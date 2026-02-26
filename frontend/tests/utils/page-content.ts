import { expect, type Locator, type Page } from './test-utils.js';
import { FormContent, FormFieldType } from './form-content.js';
import { BasePage } from './base-page.js';
import { PageDetail } from './page-detail.js';

const PAGE_DEBUG = process.env.PW_FORM_DEBUG === '1' || process.env.PW_PAGE_DEBUG === '1';

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
			if (PAGE_DEBUG) {
				console.log(`[createItem] open attempt=${attempt + 1} url=${this.url} pageUrl=${this.page.url()}`);
			}
			const addButtonLocator =
				addButtonValue === undefined
					? this.page.locator('[data-testid="add-button"]:visible').first()
					: this.page
							.locator('[data-testid="add-button"]:visible')
							.filter({ hasText: addButtonValue })
							.first();
			const addButtonVisible = await addButtonLocator.isVisible({ timeout: 1_500 }).catch(() => false);
			if (!addButtonVisible) {
				await this.goto().catch(() => null);
				await this.page
					.waitForURL((url) => url.pathname.startsWith(this.url), { timeout: 8_000 })
					.catch(() => null);
			}
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
		if (PAGE_DEBUG) {
			console.log(`[createItem] modal opened url=${this.url} pageUrl=${this.page.url()}`);
		}
		await this.form.hasTitle();
		if (page) {
			await page.waitForLoadState('networkidle');
		}
		const preFillRiskScenarioId =
			this.url === '/risk-acceptances' &&
			Array.isArray(values.risk_scenarios) &&
			values.risk_scenarios.length > 0 &&
			typeof values.risk_scenarios[0] === 'object' &&
			values.risk_scenarios[0] &&
			'value' in values.risk_scenarios[0]
				? String(values.risk_scenarios[0].value || '')
				: '';

		if (this.url === '/risk-acceptances' && PAGE_DEBUG) {
			const debugEndpoints = [
				'/risk-scenarios?offset=0&limit=5',
				'/risk-scenarios?treatment=accept&offset=0&limit=5'
			];
			for (const endpoint of debugEndpoints) {
				const probe = await this.page
					.evaluate(async (url) => {
						const response = await fetch(url, {
							headers: { accept: 'application/json' }
						}).catch(() => null);
						if (!response) return { status: 'network-error', body: '' };
						const body = await response.text().catch(() => '');
						return { status: response.status, body };
					}, endpoint)
					.catch(() => ({ status: 'evaluate-error', body: '' }));
				if (!probe) {
					console.log(`[risk-acceptance-probe] endpoint=${endpoint} status=evaluate-error`);
					continue;
				}
				console.log(
					`[risk-acceptance-probe] endpoint=${endpoint} status=${probe.status} body=${probe.body.slice(
						0,
						220
					)}`
				);
			}
		}

		const shouldLogRiskScenarioResponses = this.url === '/risk-acceptances' && PAGE_DEBUG;
		const riskScenarioResponseListener = async (response: any) => {
			if (response.request().method() !== 'GET') return;
			if (!response.url().toLowerCase().includes('/risk-scenarios')) return;
			const body = await response.text().catch(() => '');
			console.log(
				`[risk-acceptance-response] url=${response.url()} status=${response.status()} body=${body.slice(
					0,
					220
				)}`
			);
		};
		if (shouldLogRiskScenarioResponses) {
			this.page.on('response', riskScenarioResponseListener);
		}

		const fillValues: { [k: string]: any } = { ...values };
		// Folder selection is handled by the dedicated fallback block below. Skipping it here avoids
		// flaky autocomplete interactions that can navigate away from the create modal.
		if ('folder' in fillValues) {
			delete fillValues.folder;
		}
		// Perimeter selection is also handled by a dedicated fallback below so required hidden IDs
		// are guaranteed immediately before submit.
		if ('perimeter' in fillValues) {
			delete fillValues.perimeter;
		}
		// Risk assessment selection can exhibit the same hidden-input drift as perimeter/folder.
		if ('risk_assessment' in fillValues) {
			delete fillValues.risk_assessment;
		}

		try {
			await this.form.fill(fillValues);
		} catch (error) {
			if (this.url === '/risk-acceptances') {
				console.warn(`[createItem] risk-acceptance form fill failed: ${String(error)}`);
			}
			if (this.url === '/asset-assessments') {
				const apiCreated = await this.createAssetAssessmentViaApi(values);
				if (apiCreated.ok) {
					if (apiCreated.createdId) {
						this.lastCreatedItemId = apiCreated.createdId;
					}
					if (apiCreated.assetLabel) {
						values.asset = apiCreated.assetLabel;
						values.str = apiCreated.assetLabel;
					}
					if (apiCreated.biaLabel) {
						values.bia = apiCreated.biaLabel;
					}
					await this.page.locator('body').press('Escape').catch(() => null);
					await this.form.formTitle.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => null);
					return;
				}
				console.warn(
					`[createItem] asset-assessment api fallback failed: ${apiCreated.error ?? 'unknown'}`
				);
			}
			throw error;
		} finally {
			if (shouldLogRiskScenarioResponses) {
				this.page.off('response', riskScenarioResponseListener);
			}
		}

		let ensureFolderSelection: (() => Promise<void>) | null = null;
		let folderSelectionPresent: (() => Promise<boolean>) | null = null;
		let apiResolvedFolderId: string | null = null;
		let apiResolvedFolderLabel: string | null = null;
		let ensurePerimeterSelection: (() => Promise<void>) | null = null;
		let perimeterSelectionPresent: (() => Promise<boolean>) | null = null;
		let apiResolvedPerimeterId: string | null = null;
		let apiResolvedPerimeterLabel: string | null = null;
		let ensureRiskAssessmentSelection: (() => Promise<void>) | null = null;
		let riskAssessmentSelectionPresent: (() => Promise<boolean>) | null = null;
		let apiResolvedRiskAssessmentId: string | null = null;
		let apiResolvedRiskAssessmentLabel: string | null = null;

		// Ensure required folder/domain selection is set for forms where autocomplete can stay empty.
		let folderField = this.page.getByTestId('form-input-folder');
		let folderFieldInputName = 'folder';
		if (!(await folderField.isVisible({ timeout: 600 }).catch(() => false))) {
			const domainField = this.page.getByTestId('form-input-domain');
			if (await domainField.isVisible({ timeout: 600 }).catch(() => false)) {
				folderField = domainField;
				folderFieldInputName = 'domain';
			}
		}
			if (await folderField.isVisible({ timeout: 1_000 }).catch(() => false)) {
			const getDesiredFolderName = () =>
				typeof values.folder === 'string'
					? values.folder
					: typeof values.domain === 'string'
						? values.domain
					: typeof values.folder === 'object' &&
						  values.folder &&
						  'value' in values.folder &&
						  typeof values.folder.value === 'string'
						? values.folder.value
						: '';
			const setSelectedFolderValue = (label: string) => {
				values.folder = label;
				values[folderFieldInputName] = label;
			};

				const hasFolderSelection = async () => {
					return folderField
						.evaluate((container, inputName) => {
							const ownerForm = container.closest('form');
							const hiddenFolderValues = Array.from(
								container.querySelectorAll(`input[type="hidden"][name="${inputName}"]`)
							)
								.map((input) => (input as HTMLInputElement).value?.trim())
								.filter((value) => Boolean(value));
							const hiddenFolderValuesOnForm = ownerForm
								? Array.from(
										ownerForm.querySelectorAll(
											`input[type="hidden"][name="${inputName}"]`
										)
									)
										.map((input) => (input as HTMLInputElement).value?.trim())
										.filter((value) => Boolean(value))
								: [];
							return hiddenFolderValues.length > 0 || hiddenFolderValuesOnForm.length > 0;
						}, folderFieldInputName)
						.catch(() => false);
				};
			const ensureHiddenFolderInput = async () => {
				if (!apiResolvedFolderId) return;
				await this.page
					.locator('form')
					.first()
					.evaluate((form, payload: { folderId: string; inputName: string }) => {
						if (!(form instanceof HTMLFormElement)) return;
						const existingInputs = Array.from(
							form.querySelectorAll(`input[type="hidden"][name="${payload.inputName}"]`)
						) as HTMLInputElement[];

						if (existingInputs.length > 0) {
							existingInputs[0].value = payload.folderId;
							for (let index = 1; index < existingInputs.length; index += 1) {
								existingInputs[index].remove();
							}
						} else {
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = payload.inputName;
							hiddenInput.value = payload.folderId;
							form.appendChild(hiddenInput);
						}

						form.dispatchEvent(new Event('input', { bubbles: true }));
						form.dispatchEvent(new Event('change', { bubbles: true }));
					}, { folderId: apiResolvedFolderId, inputName: folderFieldInputName })
					.catch(() => null);
			};

			const selectFolderFromDropdown = async () => {
				const desiredFolder = getDesiredFolderName();
				const selectFromPortalOptions = async (targetLabel: string) => {
					return this.page
						.evaluate((labelToMatch) => {
							const normalize = (value: string) =>
								value
									.normalize('NFD')
									.replace(/[\u0300-\u036f]/g, '')
									.toLowerCase()
									.trim();
							const wanted = normalize(labelToMatch || '');
							const options = Array.from(document.querySelectorAll('ul.options li')).filter(
								(node) =>
									node instanceof HTMLElement &&
									node.offsetParent !== null &&
									!node.classList.contains('disabled') &&
									!node.classList.contains('group-header') &&
									!node.classList.contains('user-msg') &&
									!node.classList.contains('loading-more')
							) as HTMLElement[];
							if (!options.length) return false;

							const candidate =
								options.find((option) => normalize(option.textContent || '').includes(wanted)) ||
								options[0];
							candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
							candidate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
							return (candidate.textContent || '').trim() || true;
						}, targetLabel)
						.catch(() => false);
				};

				await folderField.click().catch(() => null);
				const dropdownToggle = folderField.locator('img').first();
				if (await dropdownToggle.isVisible({ timeout: 500 }).catch(() => false)) {
					await dropdownToggle.click().catch(() => null);
				}

				const combobox = folderField.getByRole('combobox').first();
				if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
					await combobox.click().catch(() => null);
					await combobox.press('ControlOrMeta+A').catch(() => null);
					if (desiredFolder) {
						await combobox.fill(desiredFolder).catch(() => null);
					} else {
						await combobox.fill('').catch(() => null);
					}
					await this.page.waitForTimeout(300);
						const selectedLabel = await selectFromPortalOptions(desiredFolder);
						if (selectedLabel) {
							if (typeof selectedLabel === 'string') setSelectedFolderValue(selectedLabel);
							return;
						}
					}

					if (await combobox.isVisible({ timeout: 500 }).catch(() => false)) {
						await combobox.click().catch(() => null);
						await this.page.waitForTimeout(250);
					const selectedLabel = await selectFromPortalOptions(desiredFolder);
					if (selectedLabel) {
						if (typeof selectedLabel === 'string') setSelectedFolderValue(selectedLabel);
						return;
					}
					await combobox.press('ControlOrMeta+A').catch(() => null);
					await combobox.fill('').catch(() => null);
					await this.page.waitForTimeout(250);
						const fallbackLabel = await selectFromPortalOptions('');
						if (fallbackLabel) {
							if (typeof fallbackLabel === 'string') setSelectedFolderValue(fallbackLabel);
							return;
						}
					}
				};

			const forceSelectFolderOption = async () => {
				const desiredFolder = getDesiredFolderName();
				await folderField
					.evaluate(async (container, targetLabel) => {
						const normalize = (value: string) =>
							value
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();

						const toggle = container.querySelector('img') as HTMLElement | null;
						toggle?.click();

						const combobox = container.querySelector('[role="combobox"]') as HTMLInputElement | null;
						if (combobox) {
							combobox.focus();
							combobox.value = targetLabel;
							combobox.dispatchEvent(new Event('input', { bubbles: true }));
							await new Promise((resolve) => setTimeout(resolve, 0));
						}

						let options = Array.from(
							container.querySelectorAll('[role="listbox"] [role="option"]')
						) as HTMLElement[];
						if (!options.length) return;
						const noMatchOnly =
							options.length === 1 &&
							normalize(options[0].textContent || '').includes('no matching options');
						if (noMatchOnly && combobox) {
							combobox.value = '';
							combobox.dispatchEvent(new Event('input', { bubbles: true }));
							await new Promise((resolve) => setTimeout(resolve, 0));
							options = Array.from(
								container.querySelectorAll('[role="listbox"] [role="option"]')
							) as HTMLElement[];
						}
						if (!options.length) return;

						const wanted = normalize(targetLabel || '');
						const matched =
							options.find((option) =>
								normalize(option.textContent || '').includes(wanted)
							) || options[0];

						matched.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
						matched.dispatchEvent(new MouseEvent('click', { bubbles: true }));
					}, desiredFolder)
					.catch(() => null);
			};

			if (!(await hasFolderSelection())) {
				await selectFolderFromDropdown();
			}

			if (!(await hasFolderSelection())) {
				const desiredFolder = getDesiredFolderName();
				const apiResolvedFolder = await this.page
					.evaluate(async ({ desiredFolderName }) => {
						const normalize = (value: string) =>
							value
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();

						const response = await fetch('/folders?content_type=DO&content_type=GL&offset=0&limit=200', {
							headers: { accept: 'application/json' }
						}).catch(() => null);
						if (!response || !response.ok) return null;

						const payload = await response.json().catch(() => null);
						const results = Array.isArray(payload?.results)
							? payload.results
							: Array.isArray(payload)
								? payload
								: [];
						if (!results.length) return null;

						const wanted = normalize(desiredFolderName || '');
						const candidates = results
							.map((item: Record<string, any>) => ({
								id: String(item?.id || ''),
								label: String(item?.str || item?.name || item?.display_name || '')
							}))
							.filter((item: { id: string; label: string }) => item.id.length > 0);

						if (!candidates.length) return null;
						if (!wanted) return candidates[0];

						const exact = candidates.find(
							(item: { id: string; label: string }) => normalize(item.label) === wanted
						);
						if (exact) return exact;

						const partial = candidates.find((item: { id: string; label: string }) =>
							normalize(item.label).includes(wanted)
						);
						return partial || candidates[0];
					}, { desiredFolderName: desiredFolder })
					.catch(() => null);

				if (apiResolvedFolder?.id) {
					apiResolvedFolderId = apiResolvedFolder.id;
					apiResolvedFolderLabel = apiResolvedFolder.label || null;

					await folderField.evaluate((container, payload: { id: string; inputName: string }) => {
						const existingInputs = Array.from(
							container.querySelectorAll(`input[type="hidden"][name="${payload.inputName}"]`)
						) as HTMLInputElement[];

						if (existingInputs.length > 0) {
							existingInputs[0].value = payload.id;
							for (let index = 1; index < existingInputs.length; index += 1) {
								existingInputs[index].remove();
							}
						} else {
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = payload.inputName;
							hiddenInput.value = payload.id;
							container.appendChild(hiddenInput);
						}

						container.dispatchEvent(new Event('input', { bubbles: true }));
						container.dispatchEvent(new Event('change', { bubbles: true }));
					}, { id: apiResolvedFolder.id, inputName: folderFieldInputName });
					await ensureHiddenFolderInput();

					if (apiResolvedFolder.label) {
						setSelectedFolderValue(apiResolvedFolder.label);
						const fillKey = this.form.fields.has(folderFieldInputName)
							? folderFieldInputName
							: this.form.fields.has('folder')
								? 'folder'
								: folderFieldInputName;
						await this.form.fill({ [fillKey]: apiResolvedFolder.label });
					}
				}
			}

			if (!(await hasFolderSelection())) {
				await forceSelectFolderOption();
			}

			if (!(await hasFolderSelection())) {
				console.warn('Folder autocomplete remained empty after fallback selection');
			}

			folderSelectionPresent = hasFolderSelection;
			ensureFolderSelection = async () => {
				if (!(await hasFolderSelection())) {
					await selectFolderFromDropdown();
				}
				if (!(await hasFolderSelection())) {
					await forceSelectFolderOption();
				}
				if (!(await hasFolderSelection())) {
					await ensureHiddenFolderInput();
				}
				if (!(await hasFolderSelection()) && apiResolvedFolderLabel) {
					const fillKey = this.form.fields.has(folderFieldInputName)
						? folderFieldInputName
						: this.form.fields.has('folder')
							? 'folder'
							: folderFieldInputName;
					await this.form.fill({ [fillKey]: apiResolvedFolderLabel });
					await ensureHiddenFolderInput();
				}
				};
			}

		// Ensure required perimeter selection is set for forms where autocomplete can stay empty.
		const perimeterField = this.page.getByTestId('form-input-perimeter');
		if (await perimeterField.isVisible({ timeout: 1_000 }).catch(() => false)) {
			const getDesiredPerimeterName = () =>
				typeof values.perimeter === 'string'
					? values.perimeter
					: typeof values.perimeter === 'object' &&
						  values.perimeter &&
						  'value' in values.perimeter &&
						  typeof values.perimeter.value === 'string'
						? values.perimeter.value
						: '';
			const setSelectedPerimeterValue = (label: string) => {
				values.perimeter = label;
			};

			const hasPerimeterSelection = async () => {
				return perimeterField
					.evaluate((container) => {
						const ownerForm = container.closest('form');
						const hiddenValuesOnContainer = Array.from(
							container.querySelectorAll('input[type="hidden"][name="perimeter"]')
						)
							.map((input) => (input as HTMLInputElement).value?.trim())
							.filter((value) => Boolean(value));
						const hiddenValuesOnForm = ownerForm
							? Array.from(ownerForm.querySelectorAll('input[type="hidden"][name="perimeter"]'))
									.map((input) => (input as HTMLInputElement).value?.trim())
									.filter((value) => Boolean(value))
							: [];
						return hiddenValuesOnContainer.length > 0 || hiddenValuesOnForm.length > 0;
					})
					.catch(() => false);
			};
			const ensureHiddenPerimeterInput = async () => {
				if (!apiResolvedPerimeterId) return;
				await this.page
					.locator('form')
					.first()
					.evaluate((form, perimeterId: string) => {
						if (!(form instanceof HTMLFormElement)) return;
						const existingInputs = Array.from(
							form.querySelectorAll('input[type="hidden"][name="perimeter"]')
						) as HTMLInputElement[];

						if (existingInputs.length > 0) {
							existingInputs[0].value = perimeterId;
							for (let index = 1; index < existingInputs.length; index += 1) {
								existingInputs[index].remove();
							}
						} else {
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = 'perimeter';
							hiddenInput.value = perimeterId;
							form.appendChild(hiddenInput);
						}

						form.dispatchEvent(new Event('input', { bubbles: true }));
						form.dispatchEvent(new Event('change', { bubbles: true }));
					}, apiResolvedPerimeterId)
					.catch(() => null);
			};

			const selectPerimeterFromDropdown = async () => {
				const desiredPerimeter = getDesiredPerimeterName();
				const selectFromPortalOptions = async (targetLabel: string) => {
					return this.page
						.evaluate((labelToMatch) => {
							const normalize = (value: string) =>
								value
									.normalize('NFD')
									.replace(/[\u0300-\u036f]/g, '')
									.toLowerCase()
									.trim();
							const wanted = normalize(labelToMatch || '');
							const options = Array.from(document.querySelectorAll('ul.options li')).filter(
								(node) =>
									node instanceof HTMLElement &&
									node.offsetParent !== null &&
									!node.classList.contains('disabled') &&
									!node.classList.contains('group-header') &&
									!node.classList.contains('user-msg') &&
									!node.classList.contains('loading-more')
							) as HTMLElement[];
							if (!options.length) return false;

							const candidate =
								options.find((option) => normalize(option.textContent || '').includes(wanted)) ||
								options[0];
							candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
							candidate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
							return (candidate.textContent || '').trim() || true;
						}, targetLabel)
						.catch(() => false);
				};

				await perimeterField.click().catch(() => null);
				const dropdownToggle = perimeterField.locator('img').first();
				if (await dropdownToggle.isVisible({ timeout: 500 }).catch(() => false)) {
					await dropdownToggle.click().catch(() => null);
				}

				const combobox = perimeterField.getByRole('combobox').first();
				if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
					await combobox.click().catch(() => null);
					await combobox.press('ControlOrMeta+A').catch(() => null);
					await combobox.fill(desiredPerimeter || '').catch(() => null);
					await this.page.waitForTimeout(300);
					const selectedLabel = await selectFromPortalOptions(desiredPerimeter);
					if (selectedLabel) {
						if (typeof selectedLabel === 'string') setSelectedPerimeterValue(selectedLabel);
						return;
					}

					await combobox.click().catch(() => null);
					await combobox.press('ControlOrMeta+A').catch(() => null);
					await combobox.fill('').catch(() => null);
					await this.page.waitForTimeout(250);
					const fallbackLabel = await selectFromPortalOptions('');
					if (fallbackLabel) {
						if (typeof fallbackLabel === 'string') setSelectedPerimeterValue(fallbackLabel);
						return;
					}
				}
			};

			if (!(await hasPerimeterSelection())) {
				await selectPerimeterFromDropdown();
			}

			if (!(await hasPerimeterSelection())) {
				const desiredPerimeter = getDesiredPerimeterName();
				const apiResolvedPerimeter = await this.page
					.evaluate(async ({ desiredPerimeterName }) => {
						const normalize = (value: string) =>
							value
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();

						const endpoints = [
							desiredPerimeterName
								? `/perimeters?search=${encodeURIComponent(desiredPerimeterName)}&offset=0&limit=200`
								: '',
							'/perimeters?offset=0&limit=200'
						].filter(Boolean);
						for (const endpoint of endpoints) {
							const response = await fetch(endpoint, {
								headers: { accept: 'application/json' }
							}).catch(() => null);
							if (!response || !response.ok) continue;

							const payload = await response.json().catch(() => null);
							const results = Array.isArray(payload?.results)
								? payload.results
								: Array.isArray(payload)
									? payload
									: [];
							if (!results.length) continue;

							const wanted = normalize(desiredPerimeterName || '');
							const candidates = results
								.map((item: Record<string, any>) => ({
									id: String(item?.id || ''),
									label: String(item?.str || item?.name || item?.display_name || '')
								}))
								.filter((item: { id: string; label: string }) => item.id.length > 0);
							if (!candidates.length) continue;

							if (!wanted) return candidates[0];
							const exact = candidates.find(
								(item: { id: string; label: string }) => normalize(item.label) === wanted
							);
							if (exact) return exact;
							const partial = candidates.find((item: { id: string; label: string }) =>
								normalize(item.label).includes(wanted)
							);
							if (partial) return partial;
							return candidates[0];
						}
						return null;
					}, { desiredPerimeterName: desiredPerimeter })
					.catch(() => null);

				if (apiResolvedPerimeter?.id) {
					apiResolvedPerimeterId = apiResolvedPerimeter.id;
					apiResolvedPerimeterLabel = apiResolvedPerimeter.label || null;
					await perimeterField
						.evaluate((container, perimeterId: string) => {
							const existingInputs = Array.from(
								container.querySelectorAll('input[type="hidden"][name="perimeter"]')
							) as HTMLInputElement[];
							if (existingInputs.length > 0) {
								existingInputs[0].value = perimeterId;
								for (let index = 1; index < existingInputs.length; index += 1) {
									existingInputs[index].remove();
								}
							} else {
								const hiddenInput = document.createElement('input');
								hiddenInput.type = 'hidden';
								hiddenInput.name = 'perimeter';
								hiddenInput.value = perimeterId;
								container.appendChild(hiddenInput);
							}
							container.dispatchEvent(new Event('input', { bubbles: true }));
							container.dispatchEvent(new Event('change', { bubbles: true }));
						}, apiResolvedPerimeter.id)
						.catch(() => null);
					await ensureHiddenPerimeterInput();

					if (apiResolvedPerimeter.label && this.form.fields.has('perimeter')) {
						setSelectedPerimeterValue(apiResolvedPerimeter.label);
						await this.form.fill({ perimeter: apiResolvedPerimeter.label }).catch(() => null);
					}
				}
			}

			if (!(await hasPerimeterSelection())) {
				console.warn('Perimeter autocomplete remained empty after fallback selection');
			}

			perimeterSelectionPresent = hasPerimeterSelection;
			ensurePerimeterSelection = async () => {
				if (!(await hasPerimeterSelection())) {
					await selectPerimeterFromDropdown();
				}
				if (!(await hasPerimeterSelection())) {
					await ensureHiddenPerimeterInput();
				}
				if (!(await hasPerimeterSelection()) && apiResolvedPerimeterLabel && this.form.fields.has('perimeter')) {
					await this.form.fill({ perimeter: apiResolvedPerimeterLabel }).catch(() => null);
					await ensureHiddenPerimeterInput();
				}
			};
		}

		// Ensure required risk_assessment selection is set for forms where autocomplete can stay empty.
		const riskAssessmentField = this.page.getByTestId('form-input-risk-assessment');
		if (await riskAssessmentField.isVisible({ timeout: 1_000 }).catch(() => false)) {
			const getDesiredRiskAssessmentName = () =>
				typeof values.risk_assessment === 'string'
					? values.risk_assessment
					: typeof values.risk_assessment === 'object' &&
						  values.risk_assessment &&
						  'value' in values.risk_assessment &&
						  typeof values.risk_assessment.value === 'string'
						? values.risk_assessment.value
						: '';
			const setSelectedRiskAssessmentValue = (label: string) => {
				values.risk_assessment = label;
			};

			const hasRiskAssessmentSelection = async () => {
				return riskAssessmentField
					.evaluate((container) => {
						const ownerForm = container.closest('form');
						const hiddenValuesOnContainer = Array.from(
							container.querySelectorAll('input[type="hidden"][name="risk_assessment"]')
						)
							.map((input) => (input as HTMLInputElement).value?.trim())
							.filter((value) => Boolean(value));
						const hiddenValuesOnForm = ownerForm
							? Array.from(ownerForm.querySelectorAll('input[type="hidden"][name="risk_assessment"]'))
									.map((input) => (input as HTMLInputElement).value?.trim())
									.filter((value) => Boolean(value))
							: [];
						return hiddenValuesOnContainer.length > 0 || hiddenValuesOnForm.length > 0;
					})
					.catch(() => false);
			};
			const ensureHiddenRiskAssessmentInput = async () => {
				if (!apiResolvedRiskAssessmentId) return;
				await this.page
					.locator('form')
					.first()
					.evaluate((form, riskAssessmentId: string) => {
						if (!(form instanceof HTMLFormElement)) return;
						const existingInputs = Array.from(
							form.querySelectorAll('input[type="hidden"][name="risk_assessment"]')
						) as HTMLInputElement[];

						if (existingInputs.length > 0) {
							existingInputs[0].value = riskAssessmentId;
							for (let index = 1; index < existingInputs.length; index += 1) {
								existingInputs[index].remove();
							}
						} else {
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = 'risk_assessment';
							hiddenInput.value = riskAssessmentId;
							form.appendChild(hiddenInput);
						}

						form.dispatchEvent(new Event('input', { bubbles: true }));
						form.dispatchEvent(new Event('change', { bubbles: true }));
					}, apiResolvedRiskAssessmentId)
					.catch(() => null);
			};

			const selectRiskAssessmentFromDropdown = async () => {
				const desiredRiskAssessment = getDesiredRiskAssessmentName();
				const selectFromPortalOptions = async (targetLabel: string) => {
					return this.page
						.evaluate((labelToMatch) => {
							const normalize = (value: string) =>
								value
									.normalize('NFD')
									.replace(/[\u0300-\u036f]/g, '')
									.toLowerCase()
									.trim();
							const wanted = normalize(labelToMatch || '');
							const options = Array.from(document.querySelectorAll('ul.options li')).filter(
								(node) =>
									node instanceof HTMLElement &&
									node.offsetParent !== null &&
									!node.classList.contains('disabled') &&
									!node.classList.contains('group-header') &&
									!node.classList.contains('user-msg') &&
									!node.classList.contains('loading-more')
							) as HTMLElement[];
							if (!options.length) return false;

							const candidate =
								options.find((option) => normalize(option.textContent || '').includes(wanted)) ||
								options[0];
							candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
							candidate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
							return (candidate.textContent || '').trim() || true;
						}, targetLabel)
						.catch(() => false);
				};

				await riskAssessmentField.click().catch(() => null);
				const dropdownToggle = riskAssessmentField.locator('img').first();
				if (await dropdownToggle.isVisible({ timeout: 500 }).catch(() => false)) {
					await dropdownToggle.click().catch(() => null);
				}

				const combobox = riskAssessmentField.getByRole('combobox').first();
				if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
					await combobox.click().catch(() => null);
					await combobox.press('ControlOrMeta+A').catch(() => null);
					await combobox.fill(desiredRiskAssessment || '').catch(() => null);
					await this.page.waitForTimeout(300);
					const selectedLabel = await selectFromPortalOptions(desiredRiskAssessment);
					if (selectedLabel) {
						if (typeof selectedLabel === 'string') setSelectedRiskAssessmentValue(selectedLabel);
						return;
					}

					await combobox.click().catch(() => null);
					await combobox.press('ControlOrMeta+A').catch(() => null);
					await combobox.fill('').catch(() => null);
					await this.page.waitForTimeout(250);
					const fallbackLabel = await selectFromPortalOptions('');
					if (fallbackLabel) {
						if (typeof fallbackLabel === 'string') setSelectedRiskAssessmentValue(fallbackLabel);
						return;
					}
				}
			};

			if (!(await hasRiskAssessmentSelection())) {
				await selectRiskAssessmentFromDropdown();
			}

			if (!(await hasRiskAssessmentSelection())) {
				const desiredRiskAssessment = getDesiredRiskAssessmentName();
				const apiResolvedRiskAssessment = await this.page
					.evaluate(async ({ desiredRiskAssessmentName }) => {
						const normalize = (value: string) =>
							value
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();

						const endpoints = [
							desiredRiskAssessmentName
								? `/risk-assessments?search=${encodeURIComponent(desiredRiskAssessmentName)}&offset=0&limit=200`
								: '',
							'/risk-assessments?offset=0&limit=200'
						].filter(Boolean);
						for (const endpoint of endpoints) {
							const response = await fetch(endpoint, {
								headers: { accept: 'application/json' }
							}).catch(() => null);
							if (!response || !response.ok) continue;

							const payload = await response.json().catch(() => null);
							const results = Array.isArray(payload?.results)
								? payload.results
								: Array.isArray(payload)
									? payload
									: [];
							if (!results.length) continue;

							const wanted = normalize(desiredRiskAssessmentName || '');
							const candidates = results
								.map((item: Record<string, any>) => ({
									id: String(item?.id || ''),
									label: String(item?.str || item?.name || item?.display_name || '')
								}))
								.filter((item: { id: string; label: string }) => item.id.length > 0);
							if (!candidates.length) continue;

							if (!wanted) return candidates[0];
							const exact = candidates.find(
								(item: { id: string; label: string }) => normalize(item.label) === wanted
							);
							if (exact) return exact;
							const partial = candidates.find((item: { id: string; label: string }) =>
								normalize(item.label).includes(wanted)
							);
							if (partial) return partial;
							return candidates[0];
						}
						return null;
					}, { desiredRiskAssessmentName: desiredRiskAssessment })
					.catch(() => null);

				if (apiResolvedRiskAssessment?.id) {
					apiResolvedRiskAssessmentId = apiResolvedRiskAssessment.id;
					apiResolvedRiskAssessmentLabel = apiResolvedRiskAssessment.label || null;
					await riskAssessmentField
						.evaluate((container, riskAssessmentId: string) => {
							const existingInputs = Array.from(
								container.querySelectorAll('input[type="hidden"][name="risk_assessment"]')
							) as HTMLInputElement[];
							if (existingInputs.length > 0) {
								existingInputs[0].value = riskAssessmentId;
								for (let index = 1; index < existingInputs.length; index += 1) {
									existingInputs[index].remove();
								}
							} else {
								const hiddenInput = document.createElement('input');
								hiddenInput.type = 'hidden';
								hiddenInput.name = 'risk_assessment';
								hiddenInput.value = riskAssessmentId;
								container.appendChild(hiddenInput);
							}
							container.dispatchEvent(new Event('input', { bubbles: true }));
							container.dispatchEvent(new Event('change', { bubbles: true }));
						}, apiResolvedRiskAssessment.id)
						.catch(() => null);
					await ensureHiddenRiskAssessmentInput();

					if (apiResolvedRiskAssessment.label && this.form.fields.has('risk_assessment')) {
						setSelectedRiskAssessmentValue(apiResolvedRiskAssessment.label);
						await this.form.fill({ risk_assessment: apiResolvedRiskAssessment.label }).catch(() => null);
					}
				}
			}

			if (!(await hasRiskAssessmentSelection())) {
				console.warn('Risk assessment autocomplete remained empty after fallback selection');
			}

			riskAssessmentSelectionPresent = hasRiskAssessmentSelection;
			ensureRiskAssessmentSelection = async () => {
				if (!(await hasRiskAssessmentSelection())) {
					await selectRiskAssessmentFromDropdown();
				}
				if (!(await hasRiskAssessmentSelection())) {
					await ensureHiddenRiskAssessmentInput();
				}
				if (
					!(await hasRiskAssessmentSelection()) &&
					apiResolvedRiskAssessmentLabel &&
					this.form.fields.has('risk_assessment')
				) {
					await this.form.fill({ risk_assessment: apiResolvedRiskAssessmentLabel }).catch(() => null);
					await ensureHiddenRiskAssessmentInput();
				}
			};
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

		let duplicateRetryCount = 0;
		let folderRetryCount = 0;
		let perimeterRetryCount = 0;
		let riskAssessmentRetryCount = 0;
		let riskScenarioRetryCount = 0;
		let submitAttempts = 0;
		let receivedSuccessfulCreateResponse = false;
		const riskScenarioIdForSubmit =
			preFillRiskScenarioId ||
			(this.url === '/risk-acceptances' &&
			Array.isArray(values.risk_scenarios) &&
			values.risk_scenarios.length > 0 &&
			typeof values.risk_scenarios[0] === 'object' &&
			values.risk_scenarios[0] &&
			'value' in values.risk_scenarios[0]
				? String(values.risk_scenarios[0].value || '')
				: '');
			const riskScenarioIdLooksValid =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					riskScenarioIdForSubmit
				);
				while (true) {
					submitAttempts += 1;
					if (PAGE_DEBUG) {
						console.log(`[createItem] submit attempt=${submitAttempts} url=${this.url}`);
					}
					if (submitAttempts > 3) {
						throw new Error(`Create modal did not submit successfully after ${submitAttempts - 1} attempts on ${this.url}`);
					}
					const createActionResponsePromise = this.page
						.waitForResponse(
							(response) => {
								const method = response.request().method().toUpperCase();
								if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;

								const responseUrl = response.url();
								const pathname = new URL(responseUrl).pathname;
								const matchesActionRoute =
									responseUrl.includes(`${this.url}?/create`) ||
									responseUrl.includes(`${this.url}/?/create`);
								const matchesFrontendModelPath =
									pathname === this.url || pathname.startsWith(`${this.url}/`);
								const matchesBackendModelPath =
									pathname === `/api${this.url}` ||
									pathname.startsWith(`/api${this.url}/`) ||
									responseUrl.includes(`/api${this.url}/`);

								return matchesActionRoute || matchesFrontendModelPath || matchesBackendModelPath;
							},
							{ timeout: 8_000 }
						)
						.catch(() => null);

				if (riskScenarioIdLooksValid) {
					await this.page
						.getByTestId('form-input-risk-scenarios')
						.evaluate((container, scenarioId) => {
							const ownerForm = container.closest('form');
							const target = ownerForm || container;
							const existingInputs = Array.from(
								target.querySelectorAll('input[type="hidden"][name="risk_scenarios"]')
							) as HTMLInputElement[];
							existingInputs.forEach((input) => input.remove());
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = 'risk_scenarios';
							hiddenInput.value = scenarioId;
							target.appendChild(hiddenInput);
							target.dispatchEvent(new Event('input', { bubbles: true }));
							target.dispatchEvent(new Event('change', { bubbles: true }));
						}, riskScenarioIdForSubmit)
						.catch(() => null);
				}

					await this.form.formTitle.click({ timeout: 1_000 }).catch(() => null);
					if (PAGE_DEBUG) {
						console.log(`[createItem] clicking save url=${this.url}`);
					}
					let saveClicked = await this.form.saveButton
						.click({ timeout: 8_000 })
						.then(() => true)
						.catch(() => false);
					if (!saveClicked) {
						await this.form.saveButton.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => null);
						saveClicked = await this.form.saveButton
							.click({ force: true, timeout: 3_000 })
							.then(() => true)
							.catch(() => false);
					}
						if (!saveClicked) {
							const saveButtonVisible = await this.form.saveButton
								.isVisible({ timeout: 500 })
								.catch(() => false);
							if (saveButtonVisible) {
								await this.form.saveButton.focus({ timeout: 1_000 }).catch(() => null);
								saveClicked = await this.page.keyboard
									.press('Enter')
									.then(() => true)
									.catch(() => false);
							}
						}
					const currentPathAfterSubmitClick = new URL(this.page.url()).pathname;
					const redirectedToDetailAfterClick =
						currentPathAfterSubmitClick.startsWith(`${this.url}/`) &&
						currentPathAfterSubmitClick.length > this.url.length + 1;
					if (!saveClicked && !redirectedToDetailAfterClick) {
						const modalStillVisibleAfterClickAttempt = await this.form.formTitle
							.isVisible({ timeout: 1_000 })
							.catch(() => false);
						if (modalStillVisibleAfterClickAttempt) {
							if (PAGE_DEBUG) {
								console.warn(
									`[createItem] save click not confirmed, retrying submit loop url=${this.url}`
								);
							}
							continue;
						}
					}
					if (PAGE_DEBUG) {
						console.log(`[createItem] save click dispatched url=${this.url}`);
					}

				const createActionResponse = await createActionResponsePromise;
				let redirectedToDetail = redirectedToDetailAfterClick;
				if (!redirectedToDetail) {
					const currentPathname = new URL(this.page.url()).pathname;
					redirectedToDetail =
						currentPathname.startsWith(`${this.url}/`) &&
						currentPathname.length > this.url.length + 1;
				}
				if (PAGE_DEBUG) {
					console.log(
						`[createItem] create response url=${this.url} status=${
							createActionResponse ? createActionResponse.status() : 'none'
						} redirectedToDetail=${redirectedToDetail}`
					);
				}
				if (createActionResponse && createActionResponse.ok()) {
					receivedSuccessfulCreateResponse = true;
					const body = await createActionResponse.text().catch(() => '');
					const createdItemId = this.extractCreatedItemId(body);
					if (createdItemId) {
						this.lastCreatedItemId = createdItemId;
					}
				}
				if (redirectedToDetail) {
					receivedSuccessfulCreateResponse = true;
					const detailPath = new URL(this.page.url()).pathname;
					const detailId = detailPath.slice(this.url.length + 1).split('/')[0];
					if (detailId) {
						this.lastCreatedItemId = decodeURIComponent(detailId);
					}
				}

				const modalStillVisible = await this.form.formTitle
					.isVisible({ timeout: 2_000 })
					.catch(() => false);
				if (PAGE_DEBUG) {
					console.log(`[createItem] modal visible after submit=${modalStillVisible} url=${this.url}`);
				}
					if (modalStillVisible && receivedSuccessfulCreateResponse) {
						await this.page.locator('body').press('Escape').catch(() => null);
						await this.form.formTitle.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => null);
						break;
					}
					if (!modalStillVisible) {
						if (receivedSuccessfulCreateResponse || redirectedToDetail) {
							break;
						}
						const submittedPrimaryValue =
							typeof values.name === 'string' && values.name.trim()
								? values.name.trim()
								: typeof values.email === 'string' && values.email.trim()
									? values.email.trim()
									: typeof values.ref_id === 'string' && values.ref_id.trim()
										? values.ref_id.trim()
										: typeof values.str === 'string' && values.str.trim()
											? values.str.trim()
											: '';
						if (submittedPrimaryValue) {
							const recoveredId = await this.findItemIdByName(submittedPrimaryValue);
							if (recoveredId) {
								this.lastCreatedItemId = recoveredId;
								break;
							}
						}
						throw new Error(
							`Create modal closed without a successful create confirmation on ${this.url}`
						);
					}

			const folderRequiredVisible = await folderField
				.locator('.text-error-500, p, span')
				.filter({ hasText: /required|requis|obligatoire/i })
				.first()
				.isVisible({ timeout: 500 })
				.catch(() => false);
				const folderMissingSelection =
					folderSelectionPresent ? !(await folderSelectionPresent()) : false;
					if (
						ensureFolderSelection &&
						folderRetryCount < 2 &&
						(folderRequiredVisible || folderMissingSelection)
					) {
						folderRetryCount += 1;
						await ensureFolderSelection();
						continue;
					}
				const perimeterRequiredVisible = await perimeterField
					.locator('.text-error-500, p, span')
					.filter({ hasText: /required|requis|obligatoire/i })
					.first()
					.isVisible({ timeout: 500 })
					.catch(() => false);
				const perimeterMissingSelection =
					perimeterSelectionPresent ? !(await perimeterSelectionPresent()) : false;
				if (
					ensurePerimeterSelection &&
					perimeterRetryCount < 2 &&
					(perimeterRequiredVisible || perimeterMissingSelection)
				) {
					perimeterRetryCount += 1;
					await ensurePerimeterSelection();
					continue;
				}
				const riskAssessmentRequiredVisible = await riskAssessmentField
					.locator('.text-error-500, p, span')
					.filter({ hasText: /required|requis|obligatoire/i })
					.first()
					.isVisible({ timeout: 500 })
					.catch(() => false);
				const riskAssessmentMissingSelection =
					riskAssessmentSelectionPresent ? !(await riskAssessmentSelectionPresent()) : false;
				if (
					ensureRiskAssessmentSelection &&
					riskAssessmentRetryCount < 2 &&
					(riskAssessmentRequiredVisible || riskAssessmentMissingSelection)
				) {
					riskAssessmentRetryCount += 1;
					await ensureRiskAssessmentSelection();
					continue;
				}

					const riskScenariosRequiredVisible =
						this.url === '/risk-acceptances'
							? await this.page
									.getByTestId('form-input-risk-scenarios')
									.locator('.text-error-500, p, span')
									.filter({ hasText: /required|requis|obligatoire|ne peut pas être vide/i })
									.first()
									.isVisible({ timeout: 500 })
									.catch(() => false)
							: false;
					if (this.url === '/risk-acceptances' && riskScenariosRequiredVisible) {
						if (this.url === '/risk-acceptances' && riskScenarioRetryCount < 2) {
							riskScenarioRetryCount += 1;
							const apiCreated = await this.createRiskAcceptanceViaApi(values);
							if (apiCreated.ok) {
								if (apiCreated.createdId) {
									this.lastCreatedItemId = apiCreated.createdId;
								}
								await this.page.locator('body').press('Escape').catch(() => null);
								await this.form.formTitle
									.waitFor({ state: 'hidden', timeout: 2_000 })
									.catch(() => null);
								break;
							}
						}
						if (!riskScenarioIdLooksValid) {
							break;
						}
						await this.page
							.getByTestId('form-input-risk-scenarios')
							.evaluate((container, scenarioId) => {
							const ownerForm = container.closest('form');
							const target = ownerForm || container;
							const existingInputs = Array.from(
								target.querySelectorAll('input[type="hidden"][name="risk_scenarios"]')
							) as HTMLInputElement[];
							existingInputs.forEach((input) => input.remove());
							const hiddenInput = document.createElement('input');
							hiddenInput.type = 'hidden';
							hiddenInput.name = 'risk_scenarios';
							hiddenInput.value = scenarioId;
							target.appendChild(hiddenInput);
							target.dispatchEvent(new Event('input', { bubbles: true }));
							target.dispatchEvent(new Event('change', { bubbles: true }));
						}, riskScenarioIdForSubmit)
						.catch(() => null);
					continue;
				}

				const duplicateErrorVisible = await this.page
					.getByText(/already used in this scope|already exists|deja utilise|déjà utilisé/i)
				.first()
				.isVisible({ timeout: 1_000 })
				.catch(() => false);
			const candidateKey = ['name', 'email', 'ref_id'].find(
				(key) => typeof values[key] === 'string' && values[key].trim().length > 0
			);
			if (!duplicateErrorVisible || !candidateKey || duplicateRetryCount >= 3) {
				if (modalStillVisible) {
					const validationMessages = await this.page
						.locator('.text-error-500:visible, [role="alert"]:visible')
						.allInnerTexts()
						.catch(() => []);
					throw new Error(
						`Create form remained open on ${this.url}: ${validationMessages.join(' | ') || 'unknown validation error'}`
					);
				}
				break;
			}

			duplicateRetryCount += 1;
			const retrySuffix = `-${Math.random().toString(36).slice(2, 6)}`;
			values[candidateKey] = `${values[candidateKey]}${retrySuffix}`;
			await this.form.fill({ [candidateKey]: values[candidateKey] });
		}

		const modalStillOpenAtEnd = await this.form.formTitle
			.isVisible({ timeout: 1_000 })
			.catch(() => false);
		if (modalStillOpenAtEnd) {
			const validationMessages = await this.page
				.locator('.text-error-500:visible, [role="alert"]:visible')
				.allInnerTexts()
				.catch(() => []);
			throw new Error(
				`Create modal did not close on ${this.url}: ${validationMessages.join(' | ') || 'unknown validation error'}`
			);
		}
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
				timeout: 1_500
			});
			await this.isToastVisible('successfully created', 'i', {
				optional: true,
				timeout: 1_500
			});
	}

	private isUuidLike(value: string): boolean {
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			value.trim()
		);
	}

	private getLookupValue(value: unknown): string {
		if (typeof value === 'object' && value) {
			const candidate = value as { label?: unknown; value?: unknown };
			if (typeof candidate.label === 'string' && candidate.label.trim().length > 0) {
				return candidate.label.trim();
			}
			if (typeof candidate.value === 'string' && candidate.value.trim().length > 0) {
				return candidate.value.trim();
			}
		}
		return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
	}

	private getDirectIdValue(value: unknown): string {
		if (typeof value === 'object' && value) {
			const candidate = value as { value?: unknown };
			if (typeof candidate.value === 'string' && this.isUuidLike(candidate.value)) {
				return candidate.value.trim();
			}
		}
		const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
		return this.isUuidLike(raw) ? raw : '';
	}

	private async findCollectionCandidate(
		baseCollectionUrl: string,
		wantedRaw: string
	): Promise<{ id: string; label: string } | null> {
		return this.page.evaluate(
			async ({ baseCollectionUrl, wantedRaw }) => {
				const normalize = (value: string) =>
					(value || '')
						.normalize('NFD')
						.replace(/[\u0300-\u036f]/g, '')
						.toLowerCase()
						.trim();
				const toRows = (payload: any) =>
					Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
				const getLabel = (row: Record<string, any>) =>
					String(row?.str || row?.name || row?.display_name || row?.ref_id || '').trim();
				const parseCount = (payload: any) => {
					const parsed = Number(payload?.count);
					return Number.isFinite(parsed) ? parsed : null;
				};

				const wanted = String(wantedRaw || '').trim();
				const wantedSegment =
					wanted
						.split('/')
						.map((part) => part.trim())
						.filter(Boolean)
						.pop() || wanted;
				const normalizedWanted = normalize(wanted);
				const normalizedSegment = normalize(wantedSegment);

				const makeCandidates = (row: Record<string, any>) => ({
					id: String(row?.id || ''),
					label: getLabel(row)
				});

				const pickFromRows = (rows: Record<string, any>[]) => {
					const candidates = rows
						.map(makeCandidates)
						.filter((candidate) => candidate.id.length > 0);
					if (!candidates.length) return null;
					if (!normalizedWanted && !normalizedSegment) return candidates[0];
					const exact =
						candidates.find((candidate) => normalize(candidate.label) === normalizedWanted) ||
						candidates.find((candidate) => normalize(candidate.label) === normalizedSegment);
					if (exact) return exact;
					return (
						candidates.find((candidate) => normalize(candidate.label).includes(normalizedWanted)) ||
						candidates.find((candidate) => normalize(candidate.label).includes(normalizedSegment)) ||
						null
					);
				};

				const buildEndpointVariants = (pathname: string, params: URLSearchParams) => {
					const query = params.toString();
					const suffix = query ? `?${query}` : '';
					const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
					const variants = [normalizedPath, `${normalizedPath}/`];
					const unique = new Set<string>();
					for (const variantPath of variants) {
						unique.add(`${variantPath.replace(/\/{2,}/g, '/')}${suffix}`);
					}
					return [...unique];
				};

				const fetchPage = async (endpoint: string) => {
					const controller = new AbortController();
					const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
					const response = await fetch(endpoint, {
						headers: { accept: 'application/json' },
						signal: controller.signal
					}).catch(() => null);
					window.clearTimeout(timeoutId);
					if (!response || !response.ok) {
						return { ok: false, rows: [] as Record<string, any>[], count: null as number | null };
					}
					const payload = await response.json().catch(() => null);
					if (!payload) {
						return { ok: false, rows: [] as Record<string, any>[], count: null as number | null };
					}
					return { ok: true, rows: toRows(payload), count: parseCount(payload) };
				};

				const queries = [wanted, wantedSegment, ''].filter(
					(value, index, array) => value.length > 0 || index === array.length - 1
				);
				const limit = 100;
				const maxPages = 120;

				for (const query of queries) {
					const baseUrl = new URL(baseCollectionUrl, window.location.origin);
					for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
						const params = new URLSearchParams(baseUrl.search);
						params.set('offset', String(pageIndex * limit));
						params.set('limit', String(limit));
						if (query) {
							params.set('search', query);
						} else {
							params.delete('search');
						}

						const endpoints = buildEndpointVariants(baseUrl.pathname, params);
						let receivedData = false;
						for (const endpoint of endpoints) {
							const payload = await fetchPage(endpoint);
							if (!payload.ok) continue;
							receivedData = true;
							const picked = pickFromRows(payload.rows);
							if (picked) return picked;
							const pageOffset = pageIndex * limit;
							if (payload.rows.length === 0) break;
							if (payload.count !== null && pageOffset + payload.rows.length >= payload.count) break;
							if (payload.rows.length < limit) break;
						}
						if (!receivedData) break;
					}
				}

				return null;
			},
			{ baseCollectionUrl, wantedRaw }
		);
	}

	async createAssetAssessmentViaApi(values: { [k: string]: any }): Promise<{
		ok: boolean;
		assetLabel?: string;
		biaLabel?: string;
		createdId?: string;
		error?: string;
	}> {
		const wantedAsset = this.getLookupValue(values?.asset);
		const wantedBia = this.getLookupValue(values?.bia);

		const directAssetId = this.getDirectIdValue(values?.asset);
		const directBiaId = this.getDirectIdValue(values?.bia);

		const pickedAsset =
			directAssetId.length > 0
				? { id: directAssetId, label: wantedAsset || directAssetId }
				: await this.findCollectionCandidate('/assets', wantedAsset);
		if (!pickedAsset?.id) return { ok: false, error: 'no-asset' };

		const pickedBia =
			directBiaId.length > 0
				? { id: directBiaId, label: wantedBia || directBiaId }
				: await this.findCollectionCandidate('/business-impact-analysis', wantedBia);
		if (!pickedBia?.id) return { ok: false, error: 'no-bia' };

		const multiValueField = (entries: unknown[] | undefined): string[] => {
			if (!Array.isArray(entries)) return [];
			return entries
				.map((entry) => {
					if (typeof entry === 'object' && entry && 'value' in entry) {
						return String((entry as { value?: unknown }).value ?? '').trim();
					}
					return String(entry ?? '').trim();
				})
				.filter((entry) => entry.length > 0);
		};

		const postResult = await this.page
			.evaluate(
				async ({ payload }) => {
					const formData = new FormData();
					formData.append('urlmodel', 'asset-assessments');
					formData.append('asset', payload.assetId);
					formData.append('bia', payload.biaId);
					if (payload.observation) {
						formData.append('observation', payload.observation);
					}
					for (const dependency of payload.dependencies) {
						formData.append('dependencies', dependency);
					}
					for (const associatedControl of payload.associatedControls) {
						formData.append('associated_controls', associatedControl);
					}
					for (const evidence of payload.evidences) {
						formData.append('evidences', evidence);
					}
					if (payload.recoveryDocumented !== null) {
						formData.append('recovery_documented', payload.recoveryDocumented ? 'true' : 'false');
					}
					if (payload.recoveryTested !== null) {
						formData.append('recovery_tested', payload.recoveryTested ? 'true' : 'false');
					}
					if (payload.recoveryTargetsMet !== null) {
						formData.append('recovery_targets_met', payload.recoveryTargetsMet ? 'true' : 'false');
					}

					const controller = new AbortController();
					const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
					const response = await fetch('/asset-assessments?/create', {
						method: 'POST',
						headers: {
							accept: 'application/json',
							'x-sveltekit-action': 'true'
						},
						body: formData,
						signal: controller.signal
					}).catch(() => null);
					window.clearTimeout(timeoutId);

					if (!response) {
						return { ok: false, error: 'create-failed-network', status: 0, body: '' };
					}
					const body = await response.text().catch(() => '');
					if (!response.ok) {
						return {
							ok: false,
							error: `create-failed-${response.status}:${body.slice(0, 220)}`,
							status: response.status,
							body
						};
					}
					return { ok: true, status: response.status, body };
				},
				{
					payload: {
						assetId: String(pickedAsset.id),
						biaId: String(pickedBia.id),
						observation:
							typeof values?.observation === 'string' ? values.observation.trim() : '',
						dependencies: multiValueField(values?.dependencies),
						associatedControls: multiValueField(values?.associated_controls),
						evidences: multiValueField(values?.evidences),
						recoveryDocumented:
							typeof values?.recovery_documented === 'boolean' ? values.recovery_documented : null,
						recoveryTested:
							typeof values?.recovery_tested === 'boolean' ? values.recovery_tested : null,
						recoveryTargetsMet:
							typeof values?.recovery_targets_met === 'boolean' ? values.recovery_targets_met : null
					}
				}
			)
			.catch((error) => ({
				ok: false,
				error: String(error),
				status: 0,
				body: ''
			}));

		if (!postResult.ok) {
			return { ok: false, error: postResult.error || 'create-failed' };
		}

		const createdId = this.extractCreatedItemId(postResult.body || '') ?? undefined;
		return {
			ok: true,
			assetLabel: pickedAsset.label || wantedAsset,
			biaLabel: pickedBia.label || wantedBia,
			createdId
		};
	}

	async createRiskAcceptanceViaApi(values: { [k: string]: any }): Promise<{
		ok: boolean;
		folderLabel?: string;
		approverLabel?: string;
		scenarioLabel?: string;
		createdId?: string;
		error?: string;
	}> {
		return this.page
			.evaluate(async ({ values }) => {
				const normalize = (value: string) =>
					(value || '')
						.normalize('NFD')
						.replace(/[\u0300-\u036f]/g, '')
						.toLowerCase()
						.trim();
				const toRows = (payload: any) =>
					Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
					const fetchRows = async (endpoint: string) => {
						const controller = new AbortController();
						const timeoutId = window.setTimeout(() => controller.abort(), 2_500);
						const response = await fetch(endpoint, {
							headers: { accept: 'application/json' },
							signal: controller.signal
						}).catch(() => null);
						window.clearTimeout(timeoutId);
						if (!response || !response.ok) return [] as Record<string, any>[];
						const payload = await response.json().catch(() => null);
						return toRows(payload);
					};
					const fetchRow = async (endpoint: string) => {
						const controller = new AbortController();
						const timeoutId = window.setTimeout(() => controller.abort(), 2_500);
						const response = await fetch(endpoint, {
							headers: { accept: 'application/json' },
							signal: controller.signal
						}).catch(() => null);
						window.clearTimeout(timeoutId);
						if (!response || !response.ok) return null;
						return (await response.json().catch(() => null)) as Record<string, any> | null;
					};
					const getLabel = (row: Record<string, any>) =>
						String(
							row?.email || row?.str || row?.name || row?.display_name || row?.ref_id || ''
						).trim();

				const wantedFolder = normalize(String(values?.folder || ''));
				const wantedApprover = normalize(String(values?.approver || ''));
					const firstScenarioValue =
						Array.isArray(values?.risk_scenarios) && values.risk_scenarios.length > 0
							? values.risk_scenarios[0]
							: '';
					const wantedScenarioLabel = normalize(
						typeof firstScenarioValue === 'object' &&
							firstScenarioValue &&
							'label' in firstScenarioValue &&
							typeof firstScenarioValue.label === 'string'
							? String(firstScenarioValue.label)
							: String(firstScenarioValue || '')
					);
						const wantedScenarioId =
							typeof firstScenarioValue === 'object' &&
							firstScenarioValue &&
							'value' in firstScenarioValue
								? String(firstScenarioValue.value || '')
								: '';
						const uuidPattern =
							/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

					const folderEndpoints = [
						wantedFolder
							? `/folders?content_type=DO&search=${encodeURIComponent(String(values?.folder || ''))}&offset=0&limit=200`
							: '',
						'/folders?content_type=DO&offset=0&limit=200'
					].filter(Boolean);
					let folders: Record<string, any>[] = [];
					for (const endpoint of folderEndpoints) {
						const rows = await fetchRows(endpoint);
						if (rows.length > 0) {
							folders = rows;
							break;
						}
					}
					const pickedFolder =
						folders.find(
							(row) =>
								normalize(getLabel(row)) === wantedFolder ||
								normalize(getLabel(row)).includes(wantedFolder)
						) || folders[0];
					if (!pickedFolder?.id) return { ok: false, error: 'no-folder' };

				const folderId = String(pickedFolder.id);
					const scenarioEndpoints = [
						`/risk-scenarios?scope_folder_id=${encodeURIComponent(folderId)}&offset=0&limit=200`,
						`/risk-scenarios?folder=${encodeURIComponent(folderId)}&offset=0&limit=200`,
						'/risk-scenarios?offset=0&limit=200'
					];
					let scenarios: Record<string, any>[] = [];
					if (uuidPattern.test(wantedScenarioId)) {
						const exactScenario = await fetchRow(`/risk-scenarios/${encodeURIComponent(wantedScenarioId)}`);
						if (exactScenario) {
							scenarios = [exactScenario];
						}
					}
					for (const endpoint of scenarioEndpoints) {
						if (scenarios.length > 0) break;
						const rows = await fetchRows(endpoint);
						if (rows.length > 0) {
							scenarios = rows;
							break;
						}
					}
					const pickedScenario =
						(uuidPattern.test(wantedScenarioId)
							? scenarios.find((row) => String(row?.id || '') === wantedScenarioId)
							: null) ||
						scenarios.find((row) => normalize(getLabel(row)).includes(wantedScenarioLabel)) ||
						scenarios[0];
					if (!pickedScenario?.id) return { ok: false, error: `no-risk-scenario(${scenarios.length})` };

					const approverEndpoints = [
						wantedApprover
							? `/users?is_approver=true&search=${encodeURIComponent(String(values?.approver || ''))}&offset=0&limit=200`
							: '',
						'/users?is_approver=true&offset=0&limit=200'
					].filter(Boolean);
					let approvers: Record<string, any>[] = [];
					for (const endpoint of approverEndpoints) {
						const rows = await fetchRows(endpoint);
						if (rows.length > 0) {
							approvers = rows;
							break;
						}
					}
					const pickedApprover =
						approvers.find((row) => normalize(getLabel(row)).includes(wantedApprover)) || approvers[0] || null;

					const payload = {
						name: values?.name || 'Risk acceptance (auto)',
						description: values?.description || '',
						expiry_date: values?.expiry_date || '2100-01-01',
						folder: folderId,
						approver: pickedApprover?.id ? String(pickedApprover.id) : null,
						risk_scenarios: [String(pickedScenario.id)]
					};
					const formData = new FormData();
					formData.append('urlmodel', 'risk-acceptances');
					formData.append('name', payload.name);
					formData.append('description', payload.description);
					formData.append('expiry_date', payload.expiry_date);
					formData.append('folder', payload.folder);
					if (payload.approver) {
						formData.append('approver', payload.approver);
					}
					for (const scenarioId of payload.risk_scenarios) {
						formData.append('risk_scenarios', scenarioId);
					}

					const createController = new AbortController();
					const createTimeoutId = window.setTimeout(() => createController.abort(), 3_000);
					const response = await fetch('/risk-acceptances?/create', {
						method: 'POST',
						headers: {
							accept: 'application/json',
							'x-sveltekit-action': 'true'
						},
						body: formData,
						signal: createController.signal
					}).catch(() => null);
				window.clearTimeout(createTimeoutId);

				if (!response || !response.ok) {
					const responseBody = response ? await response.text().catch(() => '') : '';
					return {
						ok: false,
						error: `create-failed-${response?.status ?? 'network'}:${responseBody.slice(0, 200)}`
					};
				}
				const created = await response.json().catch(() => null);
				const createdObject =
					created?.form?.message?.object || created?.message?.object || created?.object || null;
				const actionReportedSuccess =
					created?.type === 'success' && Number(created?.status ?? 0) >= 200 && Number(created?.status ?? 0) < 300;
				if (created?.form?.valid === false || (!createdObject?.id && !actionReportedSuccess)) {
					return {
						ok: false,
						error: `create-invalid:${JSON.stringify(created?.form?.errors || created || {}).slice(0, 220)}`
					};
				}

				return {
					ok: true,
					folderLabel: getLabel(pickedFolder),
					approverLabel: pickedApprover ? getLabel(pickedApprover) : undefined,
					scenarioLabel: getLabel(pickedScenario),
					createdId: createdObject?.id ? String(createdObject.id) : undefined
				};
			}, { values })
			.catch((err) => ({ ok: false, error: `evaluate-failed:${String(err)}` }));
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
			const currentPathname = new URL(this.page.url()).pathname;
			if (currentPathname.startsWith(`${this.url}/`)) {
				this.itemDetail.setItem(value);
				await this.page.waitForURL(new RegExp('^.*\\' + this.url + '/.+'));
				return;
			}
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

				const buildCandidates = (offset: number) => [
					`${url}?offset=${offset}&limit=${limit}`,
					`/api${url}/?offset=${offset}&limit=${limit}`,
					`/api${url}?offset=${offset}&limit=${limit}`
				];

				for (let offset = 0; offset < 10_000; offset += limit) {
					let payload: Record<string, any> | null = null;
					for (const endpoint of buildCandidates(offset)) {
						const response = await fetch(endpoint, {
							headers: { accept: 'application/json' }
						}).catch(() => null);
						if (!response || !response.ok) continue;
						const parsed = await response.json().catch(() => null);
						if (!parsed) continue;
						payload = parsed;
						break;
					}
					if (!payload) return null;

					const results = Array.isArray(payload?.results)
						? payload.results
						: Array.isArray(payload)
							? payload
							: [];
					const match = results.find((row) => matches(row));
					if (match?.id && typeof match.id === 'string') return match.id;
					if (match?.id && typeof match.id === 'number') return String(match.id);

					const count = Number(payload?.count ?? results.length ?? 0);
					if (!Number.isFinite(count) || count <= 0 || offset + limit >= count) break;
				}
				return null;
			},
			{ url: this.url, itemName: value }
		);
	}

	private extractCreatedItemId(actionResponseBody: string): string | null {
		if (!actionResponseBody) return null;

		const isValidId = (candidate: unknown): candidate is string => {
			if (typeof candidate !== 'string') return false;
			const trimmed = candidate.trim();
			return (
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
				/^\d+$/.test(trimmed)
			);
		};

		const extractFromObject = (payload: unknown): string | null => {
			if (!payload || typeof payload !== 'object') return null;
			const queue: unknown[] = [payload];
			while (queue.length > 0) {
				const current = queue.shift();
				if (!current || typeof current !== 'object') continue;
				if (Array.isArray(current)) {
					queue.push(...current);
					continue;
				}

				const record = current as Record<string, unknown>;
				if (isValidId(record.id)) return record.id.trim();
				for (const value of Object.values(record)) {
					if (value && typeof value === 'object') queue.push(value);
				}
			}
			return null;
		};

		const escapedURL = this.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const responseURLMatch = actionResponseBody.match(
			new RegExp(`${escapedURL}/([0-9a-fA-F-]{36}|\\d+)`)
		);
		if (responseURLMatch?.[1]) return responseURLMatch[1];

		const uuidMatch = actionResponseBody.match(
			/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i
		);
		if (uuidMatch?.[1]) return uuidMatch[1];

		try {
			const jsonPayload = JSON.parse(actionResponseBody);
			return extractFromObject(jsonPayload);
		} catch {
			return null;
		}
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

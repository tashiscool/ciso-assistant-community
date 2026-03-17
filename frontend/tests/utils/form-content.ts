import { expect, type Locator, type Page } from './test-utils.js';

export enum FormFieldType {
	CHECKBOX = 'checkbox',
	DATE = 'date',
	FILE = 'file',
	SELECT = 'select',
	SELECT_AUTOCOMPLETE = 'select-autocomplete',
	SELECT_MULTIPLE_AUTOCOMPLETE = 'select-multi-autocomplete',
	TEXT = 'text',
	NUMBER = 'number',
	DURATION = 'duration'
}

const FORM_DEBUG = process.env.PW_FORM_DEBUG === '1';

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type FormField = {
	locator: Locator;
	type: FormFieldType;
};

export class FormContent {
	readonly formTitle: Locator;
	readonly saveButton: Locator;
	readonly cancelButton: Locator;
	readonly fields: Map<string, FormField>;
	name: string | RegExp;

	constructor(
		public readonly page: Page,
		name: string | RegExp,
		fields: { name: string; type: FormFieldType }[]
	) {
		this.formTitle = this.page.locator('[data-testid="modal-title"]:visible').first();
		this.saveButton = this.page.locator('[data-testid="save-button"]:visible').first();
		this.cancelButton = this.page.locator('[data-testid="cancel-button"]:visible').first();
		this.name = name;
		this.fields = new Map(
			fields.map((field) => [
				field.name,
				{
					locator: this.page
						.locator(
							`[data-testid="form-input-${field.name.replaceAll('_', '-')}"]:visible`
						)
						.first(),
					type: field.type
				}
			])
		);
	}

	async fill(values: { [k: string]: any }) {
		for (const key in values) {
			if (FORM_DEBUG) console.log(`[form] start field: ${key}`);
			const field = this.fields.get(key);
			if (!field) {
				if (FORM_DEBUG) console.warn(`[form] Unknown field skipped: ${key}`);
				continue;
			}
			if (FORM_DEBUG) console.log(`[form] waiting spinners: ${key}`);
			await expect
				.poll(
					async () => await this.page.locator('.loading-spinner:visible').count().catch(() => 0),
					{
						timeout: 3_000,
						intervals: [150, 300, 600, 1_000]
					}
				)
				.toBe(0)
				.catch(async () => {
					if (!FORM_DEBUG) return;
					const visibleSpinnerCount = await this.page
						.locator('.loading-spinner:visible')
						.count()
						.catch(() => 0);
					console.warn(
						`[form] spinner wait timeout (${visibleSpinnerCount} still visible), continuing: ${key}`
					);
				});
			if (FORM_DEBUG) console.log(`[form] spinner wait done: ${key}`);

				await field.locator.scrollIntoViewIfNeeded({ timeout: 1_500 }).catch(() => null);
				if (FORM_DEBUG) console.log(`[form] scrolled: ${key}`);
				let fieldVisible = await field.locator.isVisible({ timeout: 750 }).catch(() => false);
				if (FORM_DEBUG) console.log(`[form] visible=${fieldVisible}: ${key}`);
				if (!fieldVisible) {
					await this.page.waitForLoadState('domcontentloaded').catch(() => null);
					await this.page.waitForTimeout(400);
					await field.locator.scrollIntoViewIfNeeded({ timeout: 1_500 }).catch(() => null);
					fieldVisible = await field.locator.isVisible({ timeout: 3_000 }).catch(() => false);
					if (FORM_DEBUG) console.log(`[form] visible after retry=${fieldVisible}: ${key}`);
				}
				if (!fieldVisible) {
					if (
						(key === 'description' || key === 'observation' || key === 'justification') &&
						field.type === FormFieldType.TEXT
					) {
						const markdownEditBtn = this.page.getByTestId(`markdown-edit-btn-${key}`);
					if (await markdownEditBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
						await markdownEditBtn.click();
						fieldVisible = await field.locator.isVisible({ timeout: 2_000 }).catch(() => false);
					}
				}
				if (key === 'folder' && field.type === FormFieldType.SELECT_AUTOCOMPLETE) {
					const optionName = typeof values[key] === 'string' ? values[key] : undefined;
					const preferredOption = optionName
						? field.locator.getByRole('option', { name: optionName }).first()
						: field.locator.getByRole('option').first();
					const fallbackOption = field.locator.getByRole('option').first();
					const optionToClick =
						(await preferredOption.count()) > 0 ? preferredOption : fallbackOption;
					if ((await optionToClick.count()) > 0) {
						await optionToClick.click({ force: true });
						continue;
					}
				}
				if (!fieldVisible) {
					if (FORM_DEBUG) console.warn(`[form] Field not visible, skipping: ${key}`);
					continue;
				}
			}

			// Check if this is a markdown field (description, observation, or justification) and handle it
			if (
				(key === 'description' || key === 'observation' || key === 'justification') &&
				field?.type === FormFieldType.TEXT
			) {
				// Try to click the markdown edit button if it exists
				const markdownEditBtn = this.page.getByTestId(`markdown-edit-btn-${key}`);
				if (FORM_DEBUG) console.log(`[form] markdown check: ${key}`);
				if (await markdownEditBtn.isVisible()) {
					await markdownEditBtn.click();
				}
				if (FORM_DEBUG) console.log(`[form] markdown ready: ${key}`);
			}

			if (FORM_DEBUG) console.log(`[form] type handler: ${key} (${field?.type})`);
			switch (field?.type) {
				case FormFieldType.CHECKBOX:
					if (values[key]) {
						await field.locator.check();
					} else {
						await field.locator.uncheck();
					}
					break;
				case FormFieldType.FILE:
					await field.locator.setInputFiles(values[key]);
					break;
				case FormFieldType.SELECT:
					{
						const optionValue = values[key]?.toString()?.trim();
						if (!optionValue) break;

						const resolveSelectMatch = async () => {
							return field.locator
								.evaluate((select, wanted) => {
									const normalize = (value: string) =>
										value
											.normalize('NFD')
											.replace(/[\u0300-\u036f]/g, '')
											.toLowerCase()
											.trim();
									const slugify = (value: string) =>
										normalize(value)
											.replace(/[^a-z0-9]+/g, '_')
											.replace(/^_+|_+$/g, '');

									const wantedSlug = slugify(wanted);
									const wantedCompact = wantedSlug.replaceAll('_', '');
									const wantedPrefix = wantedCompact.slice(0, 4);

									const aliasMap: Record<string, string[]> = {
										primary: ['main', 'principal', 'primaire'],
										supporting: ['support', 'secondary', 'soutien'],
										support: ['supporting', 'secondary', 'soutien'],
										active: ['actif', 'enabled'],
										inactive: ['inactif', 'disabled'],
										production: ['in_prod', 'inproduction', 'prod'],
										design: ['in_design', 'conception'],
										endoflife: ['end_of_life', 'eol', 'fin_de_vie'],
										todo: ['to_do', 'a_faire'],
										inprogress: ['in_progress', 'en_cours'],
										planned: ['planifie', 'planifié'],
										inreview: ['en_revision', 'en revision', 'en_revue', 'review'],
										completed: ['termine', 'terminé', 'done'],
										deprecated: ['deprecie', 'déprécié'],
										high: ['eleve', 'élevé', 'haut'],
										medium: ['moyen', 'modere', 'modéré', 'average'],
										low: ['faible', 'bas']
									};
									const wantedAliases = aliasMap[wantedCompact] ?? [];

									const normalizeCandidates = (value: string) => {
										const slug = slugify(value);
										const compact = slug.replaceAll('_', '');
										return [normalize(value), slug, compact];
									};

									const candidateMatches = (value: string) => {
										const candidates = normalizeCandidates(value);
										if (candidates.includes(wantedSlug) || candidates.includes(wantedCompact)) {
											return true;
										}
										if (wantedAliases.some((alias) => candidates.includes(alias))) {
											return true;
										}
										if (wantedPrefix.length >= 3) {
											return candidates.some((candidate) =>
												candidate.replaceAll('_', '').startsWith(wantedPrefix)
											);
										}
										return false;
									};

									const selectedOption = Array.from(select.selectedOptions)[0];
									const selectedMatches = Boolean(
										selectedOption &&
										[
											selectedOption.value,
											selectedOption.label,
											selectedOption.textContent || ''
										].some((candidate) => candidate && candidateMatches(candidate))
									);

									const options = Array.from(select.options).map((opt) => ({
										value: opt.value ?? '',
										label: opt.label ?? '',
										text: opt.textContent ?? ''
									}));

									const matchedOption = options.find((opt) =>
										[opt.value, opt.label, opt.text].some(
											(candidate) => candidate && candidateMatches(candidate)
										)
									);
									return { selectedMatches, matchedValue: matchedOption?.value ?? null };
								}, optionValue)
								.catch(() => ({ selectedMatches: false, matchedValue: null as string | null }));
						};

						let selected = false;
						const initialResolution = await resolveSelectMatch();
						if (initialResolution.selectedMatches) {
							selected = true;
						}

						try {
							if (!selected) {
								await field.locator.selectOption(optionValue, { timeout: 5_000 });
								selected = true;
							}
						} catch {
							// Fall through to label/fuzzy matching.
						}

						try {
							if (!selected) {
								await field.locator.selectOption({ label: optionValue }, { timeout: 5_000 });
								selected = true;
							}
						} catch {
							// Fall through to fuzzy matching.
						}

						if (!selected) {
							const resolved = await resolveSelectMatch();
							if (resolved.selectedMatches) {
								selected = true;
							} else if (resolved.matchedValue) {
								await field.locator.selectOption(resolved.matchedValue, { timeout: 5_000 });
								selected = true;
							}
						}

						if (!selected) {
							if (FORM_DEBUG) {
								const debugText = await field.locator
									.evaluate((select) => {
										const options = Array.from(select.options).map((opt) => ({
											value: opt.value,
											label: opt.label,
											text: opt.textContent,
											selected: opt.selected
										}));
										return JSON.stringify(options);
									})
									.catch(() => '[]');
								console.warn(`[form] select unmatched for "${optionValue}": ${debugText}`);
							}
							throw new Error(`No select option for: ${optionValue}`);
						}
					}
					break;
				case FormFieldType.SELECT_AUTOCOMPLETE:
					{
						const rawOptionValue =
							typeof values[key] === 'object' && values[key] && 'value' in values[key]
								? values[key].value
								: values[key];
						const optionValue = rawOptionValue?.toString().trim();
						if (key === 'perimeter' && optionValue) {
							const perimeterSelectionLabel = await field.locator
								.evaluate(async (container, wantedLabel) => {
									const normalize = (value: string) =>
										(value || '')
											.normalize('NFD')
											.replace(/[\u0300-\u036f]/g, '')
											.toLowerCase()
											.trim();
									const wanted = normalize(wantedLabel || '');
									const segmentParts = wanted
										.split('/')
										.map((part) => part.trim())
										.filter(Boolean);
									const wantedSegment = segmentParts.length
										? segmentParts[segmentParts.length - 1]
										: wanted;

									const response = await fetch('/perimeters?offset=0&limit=200', {
										headers: { accept: 'application/json' }
									}).catch(() => null);
									const payload = response?.ok ? await response.json().catch(() => null) : null;
									const results = Array.isArray(payload?.results)
										? payload.results
										: Array.isArray(payload)
											? payload
											: [];

									const candidatesFromApi = results
										.map((item: Record<string, any>) => ({
											id: String(item?.id || ''),
											label: String(item?.str || item?.name || item?.display_name || '')
										}))
										.filter((item: { id: string; label: string }) => item.id.length > 0);

									const candidatesFromPage = Array.from(
										document.querySelectorAll('a[href*="/perimeters/"]')
									)
										.filter((node) => node instanceof HTMLAnchorElement)
										.map((anchor) => {
											const href = (anchor as HTMLAnchorElement).getAttribute('href') || '';
											const idMatch = href.match(/\/perimeters\/([0-9a-fA-F-]+)/);
											return {
												id: idMatch?.[1] || '',
												label: ((anchor as HTMLAnchorElement).textContent || '').trim()
											};
										})
										.filter(
											(item) =>
												item.id.length > 0 &&
												item.label.length > 0 &&
												!item.label.includes('No matching options')
										);

									const candidates = [...candidatesFromApi, ...candidatesFromPage].filter(
										(item, index, all) =>
											all.findIndex((candidate) => candidate.id === item.id) === index
									);
									if (!candidates.length) return '';

									const pick =
										candidates.find(
											(item: { id: string; label: string }) => normalize(item.label) === wanted
										) ||
										candidates.find((item: { id: string; label: string }) =>
											normalize(item.label).includes(wanted)
										) ||
										candidates.find((item: { id: string; label: string }) =>
											normalize(item.label).includes(wantedSegment)
										) ||
										candidates[0];

									if (!pick?.id) return '';

									const ownerForm = container.closest('form');
									const target = ownerForm || container;
									const existingInputs = Array.from(
										target.querySelectorAll('input[type="hidden"][name="perimeter"]')
									) as HTMLInputElement[];
									if (existingInputs.length > 0) {
										existingInputs[0].value = pick.id;
										for (let index = 1; index < existingInputs.length; index += 1) {
											existingInputs[index].remove();
										}
									} else {
										const hiddenInput = document.createElement('input');
										hiddenInput.type = 'hidden';
										hiddenInput.name = 'perimeter';
										hiddenInput.value = pick.id;
										target.appendChild(hiddenInput);
									}
									target.dispatchEvent(new Event('input', { bubbles: true }));
									target.dispatchEvent(new Event('change', { bubbles: true }));
									return pick.label;
								}, optionValue)
								.catch(() => '');
							if (perimeterSelectionLabel) {
								values[key] = perimeterSelectionLabel;
								break;
							}
						}
					}
					await expect(async () => {
						const rawOptionValue =
							typeof values[key] === 'object' && values[key] && 'value' in values[key]
								? values[key].value
								: values[key];
						const optionValue = rawOptionValue?.toString().trim();
						if (!optionValue) return;

							const optionPattern = new RegExp(escapeRegExp(optionValue), 'i');
							const normalizedOptionValue = optionValue
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();
							const optionTokens = normalizedOptionValue
								.replace(/[^a-z0-9]+/g, ' ')
								.split(' ')
								.filter(Boolean);
							const optionPrefix =
								optionTokens.find((token) => token.length >= 3) || optionTokens[0] || '';
							const pathSegments = optionValue
								.split('/')
								.map((part) => part.trim())
								.filter((part) => part.length > 0);
							const specificSegment =
								pathSegments.length > 1 ? pathSegments[pathSegments.length - 1] : optionValue;
							const typedOptionValue =
								key === 'risk_matrix'
									? optionPrefix.length >= 3
										? optionPrefix
										: specificSegment
									: specificSegment;
							const searchbox = field.locator.getByRole('searchbox').first();
							const textbox = field.locator.getByRole('textbox').first();
							const combobox = field.locator.getByRole('combobox').first();

							const typeIntoEditable = async (
								target: Locator,
								text: string,
								timeout = 1_500
							): Promise<boolean> => {
								const isEditable = await target
									.evaluate((el) => {
										const tag = el.tagName.toLowerCase();
										return tag === 'input' || tag === 'textarea' || el.isContentEditable;
									})
									.catch(() => false);
								if (!isEditable) {
									return false;
								}

								await target.click({ timeout }).catch(async () => {
									await target.click({ force: true, timeout }).catch(() => null);
								});
								await target.press('ControlOrMeta+A').catch(() => null);
								await target.fill('').catch(() => null);
								await target.fill(text, { timeout }).catch(() => null);

								const typedValue = await target
									.evaluate((el) => {
										if ('value' in el) {
											return String((el as HTMLInputElement | HTMLTextAreaElement).value || '');
										}
										return (el.textContent || '').trim();
									})
									.catch(() => '');
								if (typedValue.trim() === text.trim()) {
									return true;
								}

								await target.press('ControlOrMeta+A').catch(() => null);
								await target.press('Backspace').catch(() => null);
								await this.page.keyboard.type(text, { delay: 25 }).catch(() => null);

								const keyboardValue = await target
									.evaluate((el) => {
										if ('value' in el) {
											return String((el as HTMLInputElement | HTMLTextAreaElement).value || '');
										}
										return (el.textContent || '').trim();
									})
									.catch(() => '');
								return keyboardValue.trim().length > 0;
							};

						const textMatchesOption = (text: string) => {
							const normalizedText = text
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();
							if (!normalizedText) return false;
							if (
								normalizedText.includes(normalizedOptionValue) ||
								normalizedOptionValue.includes(normalizedText)
							) {
								return true;
							}
							return optionPrefix.length >= 3 && normalizedText.includes(optionPrefix);
						};

						const getSelectedLabelText = async () => {
							return field.locator
								.evaluate((container) => {
									const selectedList = container.querySelector('[aria-label="selected options"]');
									if (!selectedList) return '';
									const labels = Array.from(selectedList.children)
										.filter((child) => child instanceof HTMLElement)
										.filter((child) => !child.querySelector('[role="combobox"], input, textarea'))
										.map((child) => child.textContent?.trim() ?? '')
										.filter((value) => value.length > 0);
									return labels.join(' ').replaceAll('[]', '').trim();
								})
								.catch(() => '');
						};

							const getHiddenValues = async () => {
								return field.locator
									.evaluate((container, fieldName) => {
										const ownerForm = container.closest('form');
										const names = [fieldName, `${fieldName}[]`];
										const collectFrom = (root: ParentNode | null) => {
											if (!root) return [] as string[];
											return names.flatMap((name) =>
												Array.from(root.querySelectorAll(`input[type="hidden"][name="${name}"]`))
													.map((input) => (input as HTMLInputElement).value?.trim())
													.filter((value): value is string => Boolean(value))
											);
										};
										return Array.from(new Set([...collectFrom(container), ...collectFrom(ownerForm)]));
									}, key)
									.catch(() => [] as string[]);
							};

							const hasExpectedSelection = async (allowCollapsedTextFallback = false) => {
								const [selectedLabelText, hiddenValues] = await Promise.all([
									getSelectedLabelText(),
									getHiddenValues()
								]);
								const hasHiddenSelection = hiddenValues.length > 0;
								const matchesVisibleLabel =
									selectedLabelText.length > 0 && textMatchesOption(selectedLabelText);
								const requiresHiddenSelection = [
									'folder',
									'domain',
									'perimeter',
									'risk_assessment',
									'framework',
									'risk_matrix',
									'reference_control',
									'author',
									'approver'
								].includes(key);

								if (hiddenValues.some((value) => value === optionValue)) return true;
								if (hasHiddenSelection && !matchesVisibleLabel) return true;
								if (matchesVisibleLabel) {
									return requiresHiddenSelection ? hasHiddenSelection : true;
								}

								if (!allowCollapsedTextFallback) return false;
								const collapsedFieldText =
									(await field.locator.textContent().catch(() => ''))?.replaceAll('[]', '').trim() ??
									'';
								const collapsedLooksSelected =
									collapsedFieldText.length > 0 &&
									textMatchesOption(collapsedFieldText) &&
									!collapsedFieldText.toLowerCase().includes('required');
								if (!collapsedLooksSelected) return false;
								return requiresHiddenSelection ? hasHiddenSelection : true;
							};

						if (await hasExpectedSelection()) {
							return;
						}

						let responsePromise: Promise<unknown> | undefined;
						if (typeof values[key] === 'object' && values[key] && 'request' in values[key]) {
							responsePromise = this.page
								.waitForResponse(
									(resp) => resp.url().includes(values[key].request.url) && resp.status() === 200,
									{ timeout: 7_000 }
								)
								.catch(() => null);
						} else if (key === 'risk_matrix') {
							responsePromise = this.page
								.waitForResponse(
									(resp) => resp.url().includes('/risk-matrices') && resp.status() === 200,
									{ timeout: 2_000 }
								)
								.catch(() => null);
						}

						await field.locator.click({ force: true, timeout: 3_000 }).catch(() => null);

						if (await textbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await typeIntoEditable(textbox, typedOptionValue, 2_000).catch(() => null);
							} else if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await typeIntoEditable(combobox, typedOptionValue, 2_000).catch(() => null);
							}

							if (await searchbox.isVisible().catch(() => false)) {
								const searchboxIsDisabled = await searchbox
									.evaluate((el) => el.classList.contains('disabled'))
									.catch(() => false);
								if (!searchboxIsDisabled && !(await hasExpectedSelection())) {
									const nestedInput = searchbox.locator('input, textarea, [contenteditable="true"]').first();
									if (await nestedInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
										await typeIntoEditable(nestedInput, typedOptionValue, 1_500).catch(() => null);
									}
								}
							}

							const optionVisibilityTimeout = key === 'folder' ? 1_500 : 8_000;
							const fuzzyVisibilityTimeout = key === 'folder' ? 1_000 : 3_000;
							const selectFromPortalOptions = async (targetLabel: string, allowFirstOption = false) => {
								return this.page
									.evaluate(
										({ labelToMatch, allowFirst }) => {
											const normalize = (value: string) =>
												(value || '')
													.normalize('NFD')
													.replace(/[\u0300-\u036f]/g, '')
													.toLowerCase()
													.trim();
											const wanted = normalize(labelToMatch || '');
											const tokens = wanted
												.replace(/[^a-z0-9]+/g, ' ')
												.split(' ')
												.filter(Boolean);
											const prefix = tokens.find((token) => token.length >= 3) || tokens[0] || '';
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
											const matches = (text: string) => {
												const normalizedText = normalize(text);
												if (!normalizedText) return false;
												if (
													normalizedText.includes(wanted) ||
													(wanted.length > 0 && wanted.includes(normalizedText))
												) {
													return true;
												}
												return prefix.length >= 3 && normalizedText.includes(prefix);
											};
											const candidate =
												options.find((option) => matches(option.textContent || '')) ||
												(allowFirst ? options[0] : null);
											if (!candidate) return '';
											candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
											candidate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
											return (candidate.textContent || '').trim();
										},
										{ labelToMatch: targetLabel, allowFirst: allowFirstOption }
									)
									.catch(() => '');
							};
							const option = this.page.getByRole('option', { name: optionPattern }).first();
							if (await option.isVisible({ timeout: optionVisibilityTimeout }).catch(() => false)) {
								await option.click({ timeout: 2_000 }).catch(() => null);
							} else if (optionPrefix.length >= 3) {
								const fuzzyOption = this.page
									.getByRole('option', { name: new RegExp(escapeRegExp(optionPrefix), 'i') })
									.first();
								if (
									await fuzzyOption
										.isVisible({ timeout: fuzzyVisibilityTimeout })
										.catch(() => false)
								) {
									await fuzzyOption.click({ timeout: 2_000 }).catch(() => null);
								}
								}

								if (!(await hasExpectedSelection()) && key === 'risk_matrix') {
									const fallbackOption = this.page.getByRole('option').first();
									if (await fallbackOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
										await fallbackOption.click({ timeout: 1_500 }).catch(() => null);
									}
							}

							if (!(await hasExpectedSelection())) {
								const portalSelectionLabel = await selectFromPortalOptions(
									optionValue,
									key === 'risk_matrix'
								);
								if (portalSelectionLabel) {
									values[key] = portalSelectionLabel;
								}
							}

						if (!(await hasExpectedSelection()) && key === 'risk_matrix') {
								if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
									await combobox.click({ timeout: 1_500 }).catch(() => null);
									await combobox.press('ControlOrMeta+A').catch(() => null);
									await combobox.fill('').catch(() => null);
									const firstVisibleOption = this.page.getByRole('option').first();
									if (await firstVisibleOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
										await firstVisibleOption.click({ timeout: 1_500 }).catch(() => null);
									}
								}
							}

						if (!(await hasExpectedSelection()) && key === 'risk_matrix') {
							if (FORM_DEBUG) console.log('[form] risk_matrix fallback: trying API lookup');
							const apiMatch = await this.page
								.evaluate(
									async ({ wanted }) => {
										const normalize = (value: string) =>
											value
												.normalize('NFD')
												.replace(/[\u0300-\u036f]/g, '')
												.toLowerCase()
												.trim();
										const normalizedWanted = normalize(wanted);
										const prefix = normalizedWanted
											.replace(/[^a-z0-9]+/g, ' ')
											.split(' ')
											.filter(Boolean)[0];
										const response = await fetch('/risk-matrices?offset=0&limit=200', {
											headers: { accept: 'application/json' }
										}).catch(() => null);
										if (!response || !response.ok) return null;
										const payload = await response.json().catch(() => null);
										const results = Array.isArray(payload?.results)
											? payload.results
											: Array.isArray(payload)
												? payload
												: [];
										const getLabel = (item: Record<string, any>) =>
											item?.str || item?.name || item?.display_name || item?.ref_id || '';
										const scored = results
											.map((item: Record<string, any>) => {
												const label = String(getLabel(item) || '');
												const normalizedLabel = normalize(label);
												let score = 0;
												if (normalizedLabel.includes(normalizedWanted)) score += 3;
												if (
													normalizedWanted.includes(normalizedLabel) &&
													normalizedLabel.length > 0
												) {
													score += 2;
												}
												if (prefix && normalizedLabel.includes(prefix)) score += 1;
												return { id: item?.id, label, score };
											})
											.filter((item: { id: unknown; label: string }) =>
												Boolean(item.id && item.label)
											);
										const sorted = scored.sort((a, b) => b.score - a.score);
										const best = sorted[0];
										if (!best) return null;
										if (best.score <= 0) {
											return { id: String(best.id), label: best.label };
										}
										return { id: String(best.id), label: best.label };
									},
									{ wanted: optionValue }
								)
								.catch(() => null);
							if (FORM_DEBUG)
								console.log(
									`[form] risk_matrix fallback apiMatch: ${
										apiMatch ? JSON.stringify(apiMatch) : 'null'
									}`
								);

								if (apiMatch?.label) {
										await this.page.keyboard.press('Escape').catch(() => null);
										await field.locator.click({ force: true, timeout: 1_500 }).catch(() => null);
									const dropdownToggle = field.locator.locator('img').first();
									if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
										await dropdownToggle.click({ timeout: 1_500 }).catch(() => null);
									}
									if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
										await combobox.click({ timeout: 1_500 }).catch(() => null);
										await combobox.press('ControlOrMeta+A').catch(() => null);
										await combobox.fill(apiMatch.label, { timeout: 1_500 }).catch(() => null);
									}
									const apiLabelOption = this.page
										.getByRole('option', { name: new RegExp(escapeRegExp(apiMatch.label), 'i') })
										.first();
									if (await apiLabelOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
										await apiLabelOption.click({ timeout: 1_500 }).catch(() => null);
									} else {
										const firstVisibleOption = this.page.getByRole('option').first();
										if (await firstVisibleOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
											await firstVisibleOption.click({ timeout: 1_500 }).catch(() => null);
										}
									}
								}
							}

								if (!(await hasExpectedSelection()) && key === 'folder') {
									await field.locator.click({ force: true, timeout: 1_500 }).catch(() => null);
									if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
										await combobox.click({ timeout: 1_500 }).catch(() => null);
									await combobox.press('ControlOrMeta+A').catch(() => null);
									await combobox.fill('').catch(() => null);
								}
								const firstVisibleOption = this.page.getByRole('option').first();
								if (await firstVisibleOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
									const fallbackLabel = (await firstVisibleOption.innerText().catch(() => '')).trim();
									await firstVisibleOption.click({ timeout: 1_500 }).catch(() => null);
									if (fallbackLabel) {
										values[key] = fallbackLabel;
										}
									}
								}

							if (!(await hasExpectedSelection()) && key === 'risk_matrix') {
								const portalLabel = await this.page
									.evaluate((wantedLabel) => {
										const normalize = (value: string) =>
											(value || '')
												.normalize('NFD')
												.replace(/[\u0300-\u036f]/g, '')
												.toLowerCase()
												.trim();
										const wanted = normalize(wantedLabel || '');
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
										const matched =
											options.find((option) =>
												normalize(option.textContent || '').includes(wanted)
											) || options[0];
										matched.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
										matched.dispatchEvent(new MouseEvent('click', { bubbles: true }));
										return (matched.textContent || '').trim();
									}, optionValue)
									.catch(() => '');
								if (portalLabel) {
									values[key] = portalLabel;
								}
							}

						if (!(await hasExpectedSelection()) && key === 'perimeter') {
							if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await combobox.click({ timeout: 1_500 }).catch(() => null);
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill('').catch(() => null);
								await this.page.waitForTimeout(250);
							}
							const perimeterFallbackLabel = await selectFromPortalOptions('', true);
							if (perimeterFallbackLabel) {
								values[key] = perimeterFallbackLabel;
							}
						}

						if (!(await hasExpectedSelection(true)) && key === 'folder') {
							// Some forms lazily hydrate folder choices; allow createItem() folder fallback to handle it.
							return;
						}

						if (!(await hasExpectedSelection(true))) {
							const apiResolvedOption = await this.page
								.evaluate(
									async ({
										fieldName,
										wantedLabel,
										wantedSegment
									}: {
										fieldName: string;
										wantedLabel: string;
										wantedSegment: string;
									}) => {
										const endpointByField: Record<string, string | undefined> = {
											asset: '/assets?offset=0&limit=200',
											bia: '/business-impact-analysis?offset=0&limit=200',
											perimeter: '/perimeters?offset=0&limit=200',
											risk_assessment: '/risk-assessments?offset=0&limit=200',
											risk_matrix: '/risk-matrices?offset=0&limit=200',
											framework: '/frameworks?offset=0&limit=200',
											folder: '/folders?content_type=DO&content_type=GL&offset=0&limit=200',
											reference_control: '/reference-controls?offset=0&limit=200',
											author: '/users?offset=0&limit=200',
											approver: '/users?offset=0&limit=200'
										};
										const endpoint = endpointByField[fieldName];
										if (!endpoint) return null;
										const normalize = (value: string) =>
											(value || '')
												.normalize('NFD')
												.replace(/[\u0300-\u036f]/g, '')
												.toLowerCase()
												.trim();
										const wanted = normalize(wantedLabel || '');
										const segment = normalize(wantedSegment || wantedLabel || '');
										const response = await fetch(endpoint, {
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
										const getLabel = (item: Record<string, any>) =>
											String(
												item?.str ||
													item?.name ||
													item?.display_name ||
													item?.ref_id ||
													item?.email ||
													''
											);
										const candidates = results
											.map((item: Record<string, any>) => ({
												id: String(item?.id || ''),
												label: getLabel(item)
											}))
											.filter((item: { id: string; label: string }) => Boolean(item.id))
											.filter((item: { id: string; label: string }) => item.label.length > 0);
										if (!candidates.length) return null;
										const exact =
											candidates.find(
												(item: { id: string; label: string }) => normalize(item.label) === wanted
											) ||
											candidates.find(
												(item: { id: string; label: string }) => normalize(item.label) === segment
											);
										if (exact) return exact;
										const partial =
											candidates.find((item: { id: string; label: string }) =>
												normalize(item.label).includes(wanted)
											) ||
											candidates.find((item: { id: string; label: string }) =>
												normalize(item.label).includes(segment)
											);
										if (partial) return partial;
										if (fieldName === 'perimeter' || fieldName === 'risk_assessment') {
											return candidates[0];
										}
										return null;
									},
									{
										fieldName: key,
										wantedLabel: optionValue,
										wantedSegment: specificSegment
									}
								)
								.catch(() => null);

							if (apiResolvedOption?.id) {
								await field.locator
									.evaluate(
										(container, payload) => {
											const ownerForm = container.closest('form');
											const target = ownerForm || container;
											const existingInputs = Array.from(
												target.querySelectorAll(
													`input[type="hidden"][name="${payload.fieldName}"]`
												)
											) as HTMLInputElement[];
											if (existingInputs.length > 0) {
												existingInputs[0].value = payload.id;
												for (let index = 1; index < existingInputs.length; index += 1) {
													existingInputs[index].remove();
												}
											} else {
												const hiddenInput = document.createElement('input');
												hiddenInput.type = 'hidden';
												hiddenInput.name = payload.fieldName;
												hiddenInput.value = payload.id;
												target.appendChild(hiddenInput);
											}
											target.dispatchEvent(new Event('input', { bubbles: true }));
											target.dispatchEvent(new Event('change', { bubbles: true }));
										},
										{
											fieldName: key,
											id: apiResolvedOption.id
										}
									)
									.catch(() => null);
								if (apiResolvedOption.label) {
									values[key] = apiResolvedOption.label;
								}
							}
						}

							if (!(await hasExpectedSelection(true))) {
								const [selectedLabelText, hiddenValues] = await Promise.all([
									getSelectedLabelText(),
									getHiddenValues()
								]);
							throw new Error(
								`No autocomplete option found for: ${optionValue} (selectedLabels="${selectedLabelText}", hiddenValues="${hiddenValues.join(',')}")`
							);
						}
						const selectedLabelText = await getSelectedLabelText();
						if (selectedLabelText) {
							values[key] = selectedLabelText;
						} else {
							const collapsedFieldText =
								(await field.locator.textContent().catch(() => ''))?.replaceAll('[]', '').trim() ??
								'';
							if (
								collapsedFieldText.length > 0 &&
								!collapsedFieldText.toLowerCase().includes('required')
							) {
								values[key] = collapsedFieldText;
							}
						}

						if (responsePromise) {
							await responsePromise;
						}
					}).toPass({ timeout: 25_000, intervals: [500, 1000, 3000, 10_000] });
					break;
				case FormFieldType.SELECT_MULTIPLE_AUTOCOMPLETE:
					for (const val of values[key]) {
						const hasObjectValue = typeof val === 'object' && val && 'value' in val;
						const hasObjectLabel =
							typeof val === 'object' &&
							val &&
							'label' in val &&
							typeof (val as { label?: unknown }).label === 'string' &&
							(val as { label: string }).label.trim().length > 0;
						const optionValue =
							key === 'risk_scenarios' && hasObjectLabel
								? (val as { label: string }).label.toString()
								: hasObjectValue
									? String((val as { value: unknown }).value)
									: val.toString();
						if (FORM_DEBUG) console.log(`[form][multi] field=${key} optionValue="${optionValue}"`);
						const normalize = (value: string) =>
							value
								.normalize('NFD')
								.replace(/[\u0300-\u036f]/g, '')
								.toLowerCase()
								.trim();
						const normalizedOptionValue = optionValue ? normalize(optionValue) : '';
						const optionPrefix =
							normalizedOptionValue
								.replace(/[^a-z0-9]+/g, ' ')
								.split(' ')
								.filter(Boolean)[0] ?? '';
						const typedOptionValue = optionPrefix.length >= 3 ? optionPrefix : optionValue;
						const optionPattern = new RegExp(escapeRegExp(optionValue), 'i');
						const fuzzyPattern = new RegExp(
							escapeRegExp(optionPrefix.length >= 3 ? optionPrefix : optionValue),
							'i'
						);
						const noMatchOptionPattern = /no matching options|aucune option|no options/i;

						const readMultiSelectionState = async (): Promise<{
							selectedText: string;
							hiddenValues: string[];
						}> => {
							const fieldTestId = `form-input-${key.replaceAll('_', '-')}`;
							return this.page
								.evaluate(
									(payload: { testId: string; fieldName: string }) => {
										const visibleContainers = Array.from(
											document.querySelectorAll(`[data-testid="${payload.testId}"]`)
										).filter(
											(node) =>
												node instanceof HTMLElement && node.offsetParent !== null
										) as HTMLElement[];
										const container =
											visibleContainers[0] ||
											(document.querySelector(
												`[data-testid="${payload.testId}"]`
											) as HTMLElement | null);
										if (!container) {
											return { selectedText: '', hiddenValues: [] as string[] };
										}
										const selectedList = container.querySelector('[aria-label="selected options"]');
										const selectedText = selectedList
											? Array.from(selectedList.children)
													.filter((child) => child instanceof HTMLElement)
													.filter((child) =>
														child.matches('li[role="option"][aria-selected="true"]')
													)
													.map((child) => child.textContent?.trim() ?? '')
													.filter((value) => value.length > 0)
													.join(' ')
													.replaceAll('[]', '')
													.trim()
											: '';

										const ownerForm = container.closest('form');
										const hiddenNames = [payload.fieldName, `${payload.fieldName}[]`];
										const hiddenValues = Array.from(
											(container as HTMLElement).querySelectorAll('input[type="hidden"]')
										)
											.concat(
												ownerForm
													? Array.from(ownerForm.querySelectorAll('input[type="hidden"]'))
													: []
											)
											.filter((input) => hiddenNames.includes((input as HTMLInputElement).name))
											.map((input) => (input as HTMLInputElement).value?.trim())
											.filter((value): value is string => Boolean(value));

										return { selectedText, hiddenValues };
									},
									{ testId: fieldTestId, fieldName: key }
								)
								.catch(() => ({ selectedText: '', hiddenValues: [] as string[] }));
						};

						const getSelectedLabelText = async () => (await readMultiSelectionState()).selectedText;
						const getHiddenValues = async () => (await readMultiSelectionState()).hiddenValues;

							const textMatchesOption = (text: string) => {
								const normalizedText = normalize(text);
								if (!normalizedText) return false;
								if (
									normalizedText.includes(normalizedOptionValue) ||
									normalizedOptionValue.includes(normalizedText)
								) {
									return true;
								}
								return optionPrefix.length >= 3 && normalizedText.includes(optionPrefix);
							};

							if (key === 'risk_scenarios') {
								if (FORM_DEBUG) console.log('[form][multi] risk_scenarios UI-only selection path');
								const scenarioResponsePromise = this.page
									.waitForResponse(
										(response) =>
											response.request().method() === 'GET' &&
											response.url().toLowerCase().includes('risk-scenarios'),
										{ timeout: 7_000 }
									)
									.catch(() => null);
								const selectedChips = field.locator.locator('[aria-label="selected options"] li');
								const hiddenInputs = this.page.locator(
									'form input[type="hidden"][name="risk_scenarios"]'
								);
								const hasSelection = async () => {
									const [chipCount, hiddenCount] = await Promise.all([
										selectedChips.count().catch(() => 0),
										hiddenInputs.count().catch(() => 0)
									]);
									return chipCount > 0 || hiddenCount > 0;
								};
								if (await hasSelection()) {
									continue;
								}
								const uuidPattern =
									/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
									if (uuidPattern.test(optionValue) && !hasObjectLabel) {
									await field.locator
										.evaluate((container, id) => {
											const ownerForm = container.closest('form');
											const target = ownerForm || container;
											const existingInputs = Array.from(
												target.querySelectorAll('input[type="hidden"][name="risk_scenarios"]')
											) as HTMLInputElement[];
											existingInputs.forEach((input) => input.remove());
											const hiddenInput = document.createElement('input');
											hiddenInput.type = 'hidden';
											hiddenInput.name = 'risk_scenarios';
											hiddenInput.value = id;
											target.appendChild(hiddenInput);
											target.dispatchEvent(new Event('input', { bubbles: true }));
											target.dispatchEvent(new Event('change', { bubbles: true }));
										}, optionValue)
										.catch(() => null);
									const fallbackLabel =
										typeof val === 'object' &&
										val &&
										'label' in val &&
										typeof (val as { label?: unknown }).label === 'string'
											? (val as { label: string }).label
											: optionValue;
									values[key] = [fallbackLabel];
									continue;
								}

								await this.page.keyboard.press('Escape').catch(() => null);
								await field.locator.click({ force: true, timeout: 2_000 }).catch(() => null);

								const dropdownToggle = field.locator.locator('img').first();
								const combobox = field.locator.getByRole('combobox').first();
								const searchbox = field.locator.getByRole('searchbox').first();

								const dropdownVisible = await dropdownToggle
									.isVisible({ timeout: 1_000 })
									.catch(() => false);
								const comboboxVisible = await combobox
									.isVisible({ timeout: 1_000 })
									.catch(() => false);
								const searchboxVisible = await searchbox
									.isVisible({ timeout: 1_000 })
									.catch(() => false);
								if (FORM_DEBUG) {
									console.log(
										`[form][multi] risk_scenarios controls dropdown=${dropdownVisible} combobox=${comboboxVisible} searchbox=${searchboxVisible}`
									);
								}
								if (dropdownVisible) {
									await dropdownToggle.click({ timeout: 1_000 }).catch(() => null);
								}
								if (comboboxVisible) {
									await combobox.click({ timeout: 1_000 }).catch(() => null);
									await combobox.press('ControlOrMeta+A').catch(() => null);
									await combobox.fill(typedOptionValue, { timeout: 3_000 }).catch(() => null);
								}
								if (searchboxVisible) {
									await searchbox.click({ timeout: 1_000 }).catch(() => null);
									await searchbox.press('ControlOrMeta+A').catch(() => null);
									await searchbox.fill(typedOptionValue, { timeout: 3_000 }).catch(() => null);
								}

								let selected = false;
								const options = this.page
									.locator('ul.options li')
									.filter({ hasNotText: noMatchOptionPattern });
								const roleOptions = this.page
									.getByRole('option')
									.filter({ hasNotText: noMatchOptionPattern });
								if (FORM_DEBUG) {
									const [ulOptionCount, roleOptionCount] = await Promise.all([
										options.count().catch(() => 0),
										roleOptions.count().catch(() => 0)
									]);
									console.log(
										`[form][multi] risk_scenarios option pools ul=${ulOptionCount} role=${roleOptionCount}`
									);
									const scenarioResponse = await scenarioResponsePromise;
									if (scenarioResponse) {
										const responseBody = await scenarioResponse.text().catch(() => '');
										console.log(
											`[form][multi] risk_scenarios response url=${scenarioResponse.url()} status=${scenarioResponse.status()} body=${responseBody.slice(0, 200)}`
										);
									} else {
										console.log('[form][multi] risk_scenarios response not observed');
									}
								}
								const candidates: Locator[] = [
									options.filter({ hasText: optionPattern }).first(),
									options.filter({ hasText: fuzzyPattern }).first(),
									options.first(),
									roleOptions.filter({ hasText: optionPattern }).first(),
									roleOptions.filter({ hasText: fuzzyPattern }).first(),
									roleOptions.first()
								];
								for (let index = 0; index < candidates.length; index += 1) {
									const candidate = candidates[index];
									const candidateVisible = await candidate
										.isVisible({ timeout: 5_000 })
										.catch(() => false);
									if (FORM_DEBUG)
										console.log(
											`[form][multi] risk_scenarios candidate[${index}] visible=${candidateVisible}`
										);
									if (candidateVisible) {
										const selectedLabel = (await candidate.innerText().catch(() => '')).trim();
										await candidate.click({ timeout: 2_000 }).catch(() => null);
										if (await hasSelection()) {
											if (FORM_DEBUG)
												console.log(
													`[form][multi] risk_scenarios selected label="${selectedLabel}"`
												);
											if (selectedLabel) values[key] = [selectedLabel];
											selected = true;
											break;
										}
									}
								}

								if (!selected && comboboxVisible) {
									await combobox.press('ArrowDown').catch(() => null);
									await combobox.press('Enter').catch(() => null);
									selected = await hasSelection();
									if (FORM_DEBUG)
										console.log(
											`[form][multi] risk_scenarios selected via combobox enter=${selected}`
										);
								}
								if (!selected && searchboxVisible) {
									await searchbox.press('ArrowDown').catch(() => null);
									await searchbox.press('Enter').catch(() => null);
									selected = await hasSelection();
									if (FORM_DEBUG)
										console.log(
											`[form][multi] risk_scenarios selected via searchbox enter=${selected}`
										);
								}

								if (!selected) {
									const selectedFolderId =
										(await this.page
											.locator('input[type="hidden"][name="folder"]')
											.first()
											.inputValue()
											.catch(() => '')) || '';
									const apiFallbackResult = await this.page
										.evaluate(async ({ folderId, wanted }) => {
											const toRows = (payload: any) =>
												Array.isArray(payload?.results)
													? payload.results
													: Array.isArray(payload)
														? payload
														: [];
											const endpoints = [
												folderId
													? `/risk-scenarios?scope_folder_id=${encodeURIComponent(folderId)}&offset=0&limit=200`
													: null,
												folderId
													? `/risk-scenarios?folder=${encodeURIComponent(folderId)}&offset=0&limit=200`
													: null,
												'/risk-scenarios?offset=0&limit=200'
											].filter((endpoint): endpoint is string => Boolean(endpoint));
											const trace: string[] = [];

											for (const endpoint of endpoints) {
												const response = await fetch(endpoint, {
													headers: { accept: 'application/json' }
												}).catch(() => null);
												if (!response) {
													trace.push(`${endpoint}:network-error`);
													continue;
												}
												trace.push(`${endpoint}:status=${response.status}`);
												if (!response.ok) continue;
												const payload = await response.json().catch(() => null);
												const rows = toRows(payload);
												trace.push(`${endpoint}:rows=${rows.length}`);
												if (!rows.length) continue;
												const wantedLower = (wanted || '').toLowerCase();
												const matchingRow = rows.find((row: Record<string, any>) =>
													String(
														row?.str || row?.name || row?.display_name || row?.ref_id || ''
													)
														.toLowerCase()
														.includes(wantedLower)
												);
												const row = matchingRow || rows[0];
												if (row?.id) {
													return {
														candidate: {
															id: String(row.id),
															label: String(
																row?.str ||
																	row?.name ||
																	row?.display_name ||
																	row?.ref_id ||
																	row.id
															)
														},
														trace
													};
												}
											}
											return { candidate: null, trace };
										}, { folderId: selectedFolderId, wanted: optionValue })
										.catch((err) => ({
											candidate: null,
											trace: [`eval-error:${String(err)}`]
										}));
									const apiFallback = apiFallbackResult?.candidate ?? null;
									if (FORM_DEBUG)
										console.log(
											`[form][multi] risk_scenarios apiFallback=${apiFallback ? JSON.stringify(apiFallback) : 'null'} trace=${apiFallbackResult?.trace?.join(' | ') ?? 'n/a'}`
										);
									if (apiFallback?.id) {
										await field.locator
											.evaluate((container, data) => {
												const ownerForm = container.closest('form');
												const target = ownerForm || container;
												const existingInputs = Array.from(
													target.querySelectorAll(
														'input[type="hidden"][name="risk_scenarios"]'
													)
												) as HTMLInputElement[];
												existingInputs.forEach((input) => input.remove());
												const hiddenInput = document.createElement('input');
												hiddenInput.type = 'hidden';
												hiddenInput.name = 'risk_scenarios';
												hiddenInput.value = data.id;
												target.appendChild(hiddenInput);
												target.dispatchEvent(new Event('input', { bubbles: true }));
												target.dispatchEvent(new Event('change', { bubbles: true }));
											}, { id: apiFallback.id })
											.catch(() => null);
										values[key] = [apiFallback.label];
										selected = true;
									}
								}

								if (!selected) {
									if (FORM_DEBUG) {
										console.warn(
											`[form][multi] risk_scenarios selection unresolved for "${optionValue}", deferring to submit fallback`
										);
									}
									values[key] = [optionValue];
									continue;
								}
								continue;
							}

							const hiddenValuesBefore = await getHiddenValues();
						const hasExpectedSelection = async () => {
							const [selectedLabelText, hiddenValues] = await Promise.all([
								getSelectedLabelText(),
								getHiddenValues()
							]);
							if (selectedLabelText && textMatchesOption(selectedLabelText)) return true;
							if (hiddenValues.some((value) => value === optionValue || textMatchesOption(value))) {
								return true;
							}
							if (
								(optionPrefix.length >= 3 || key === 'authors' || key === 'reviewers') &&
								hiddenValues.length > hiddenValuesBefore.length
							) {
								return true;
							}
							return false;
						};

						const hasAnySelection = async () => {
							const [selectedLabelText, hiddenValues] = await Promise.all([
								getSelectedLabelText(),
								getHiddenValues()
							]);
							return Boolean(selectedLabelText) || hiddenValues.length > 0;
						};

						if (await hasExpectedSelection()) {
							continue;
						}

						const safeClick = async (locator: Locator, options: { force?: boolean } = {}) => {
							await locator.click({ timeout: 1_500, ...options }).catch(() => null);
						};

						const comboboxForEscape = field.locator.getByRole('combobox').first();
						if (await comboboxForEscape.isVisible({ timeout: 300 }).catch(() => false)) {
							await comboboxForEscape.press('Escape').catch(() => null);
						}
						await safeClick(field.locator, { force: true });
						await safeClick(field.locator);
						const searchbox = field.locator.getByRole('searchbox').first();
						const combobox = field.locator.getByRole('combobox').first();
						const dropdownToggle = field.locator.locator('img').first();
						const optionInField = field.locator.locator('ul.options li').filter({ hasText: optionPattern }).first();
						const optionInPage = this.page
							.locator('ul.options li')
							.filter({ hasText: optionPattern })
							.first();
						const fuzzyInPage = this.page.locator('ul.options li').filter({ hasText: fuzzyPattern }).first();
						const firstDropdownOption = this.page
							.locator('ul.options li')
							.filter({ hasNotText: noMatchOptionPattern })
							.first();

						const clickFirstVisibleCandidate = async (candidates: Locator[]) => {
							const candidateTimeout = key === 'risk_scenarios' ? 800 : 3_000;
							for (const candidate of candidates) {
								if (await candidate.isVisible({ timeout: candidateTimeout }).catch(() => false)) {
									const selectedLabel = (await candidate.innerText().catch(() => '')).trim();
									await candidate.click().catch(() => null);
									const selected = (await hasExpectedSelection()) || (await hasAnySelection());
									if (selected && selectedLabel) {
										values[key] = [selectedLabel];
									}
									if (selected) return true;
								}
							}
							return false;
						};

						if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
							await safeClick(dropdownToggle);
						}

						if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
							const canFillCombobox = await combobox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillCombobox) {
								await safeClick(combobox);
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill(typedOptionValue, { timeout: 3_000 }).catch(() => null);
							}
						}

						if (await searchbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
							const canFillSearchbox = await searchbox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillSearchbox) {
								await safeClick(searchbox);
								await searchbox.press('ControlOrMeta+A').catch(() => null);
								await searchbox.fill(typedOptionValue, { timeout: 3_000 }).catch(() => null);
							}
						}

						let selected = await clickFirstVisibleCandidate([
							optionInField,
							optionInPage,
							fuzzyInPage,
							firstDropdownOption
						]);

						if (!selected && (await hasExpectedSelection())) {
							selected = true;
						}

						if (!selected && (await combobox.isVisible({ timeout: 1_000 }).catch(() => false))) {
							await safeClick(combobox);
							await combobox.press('ArrowDown').catch(() => null);
							await combobox.press('Enter').catch(() => null);
							selected = await hasExpectedSelection();
						}

						if (!selected) {
							if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await safeClick(dropdownToggle);
							}
							selected = await clickFirstVisibleCandidate([
								optionInField,
								optionInPage,
								fuzzyInPage,
								firstDropdownOption
							]);
						}

						if (!selected) {
							selected = await clickFirstVisibleCandidate([firstDropdownOption]);
						}

						if (!selected && (await combobox.isVisible({ timeout: 1_000 }).catch(() => false))) {
							await combobox.press('Enter').catch(() => null);
							selected = await hasExpectedSelection();
						}

						if (!selected && (await searchbox.isVisible({ timeout: 1_000 }).catch(() => false))) {
							await searchbox.press('Enter').catch(() => null);
							selected = await hasExpectedSelection();
						}

						if (!selected && (await hasExpectedSelection())) {
							selected = true;
						}

							if (
								!selected &&
								(key === 'authors' || key === 'reviewers' || key === 'approver') &&
								optionPrefix
							) {
							const looseMatch = this.page
								.locator('ul.options li')
								.filter({ hasText: new RegExp(optionPrefix, 'i') })
								.first();
							if (await looseMatch.isVisible({ timeout: 5_000 }).catch(() => false)) {
								await looseMatch.click();
									selected = await hasExpectedSelection();
								}
							}

							if (
								!selected &&
								[
									'authors',
									'reviewers',
									'approver',
									'owners',
									'owner',
									'assigned_to',
									'default_assignee'
								].includes(key) &&
								optionPrefix
							) {
								const apiResolvedUser = await this.page
									.evaluate(async ({ searchTerm }) => {
										const normalize = (value: string) =>
											(value || '')
												.normalize('NFD')
												.replace(/[\u0300-\u036f]/g, '')
												.toLowerCase()
												.trim();
										const endpoints = [
											`/actors?search=${encodeURIComponent(searchTerm)}&offset=0&limit=200`,
											'/actors?offset=0&limit=200',
											`/users?search=${encodeURIComponent(searchTerm)}&offset=0&limit=200`,
											'/users?offset=0&limit=200'
										];
										for (const endpoint of endpoints) {
											const controller = new AbortController();
											const timeoutId = window.setTimeout(() => controller.abort(), 2_500);
											const response = await fetch(endpoint, {
												headers: { accept: 'application/json' },
												signal: controller.signal
											}).catch(() => null);
											window.clearTimeout(timeoutId);
											if (!response || !response.ok) continue;
											const payload = await response.json().catch(() => null);
											const rows = Array.isArray(payload?.results)
												? payload.results
												: Array.isArray(payload)
													? payload
													: [];
											if (!rows.length) continue;

											const wanted = normalize(searchTerm);
											const candidates = rows
												.map((row: Record<string, any>) => ({
													id: String(row?.id || ''),
													label: String(
														row?.email || row?.str || row?.name || row?.display_name || ''
													).trim()
												}))
												.filter((row: { id: string; label: string }) => Boolean(row.id));
											if (!candidates.length) continue;
											const exact = candidates.find(
												(row: { id: string; label: string }) => normalize(row.label) === wanted
											);
											if (exact) return exact;
											const partial = candidates.find((row: { id: string; label: string }) =>
												normalize(row.label).includes(wanted)
											);
											if (partial) return partial;
											return candidates[0];
										}
										return null;
									}, { searchTerm: optionValue })
									.catch(() => null);

								if (apiResolvedUser?.id) {
									const fieldTestId = `form-input-${key.replaceAll('_', '-')}`;
									await this.page
										.evaluate(
											(payload: { testId: string; inputName: string; value: string }) => {
												const visibleContainers = Array.from(
													document.querySelectorAll(`[data-testid="${payload.testId}"]`)
												).filter(
													(node) =>
														node instanceof HTMLElement && node.offsetParent !== null
												) as HTMLElement[];
												const container =
													visibleContainers[0] ||
													(document.querySelector(
														`[data-testid="${payload.testId}"]`
													) as HTMLElement | null);
												if (!container) return;
												const ownerForm = container.closest('form');
												const target = ownerForm || container;
												const existingInputNames = Array.from(
													target.querySelectorAll('input[type="hidden"]')
												)
													.map((input) => (input as HTMLInputElement).name)
													.filter(
														(name) =>
															name === payload.inputName ||
															name === `${payload.inputName}[]`
													);
												const resolvedInputName =
													existingInputNames[0] || payload.inputName;
												const existingInput = Array.from(
													target.querySelectorAll(
														`input[type="hidden"][name="${resolvedInputName}"]`
													)
												).find(
													(input) =>
														(input as HTMLInputElement).value?.trim() === payload.value
												) as HTMLInputElement | undefined;
												if (!existingInput) {
													const hiddenInput = document.createElement('input');
													hiddenInput.type = 'hidden';
													hiddenInput.name = resolvedInputName;
													hiddenInput.value = payload.value;
													target.appendChild(hiddenInput);
												}
												target.dispatchEvent(new Event('input', { bubbles: true }));
												target.dispatchEvent(new Event('change', { bubbles: true }));
											},
											{
												testId: fieldTestId,
												inputName: key,
												value: apiResolvedUser.id
											}
										)
										.catch(() => null);
									selected = (await hasExpectedSelection()) || (await hasAnySelection());
									if (selected && apiResolvedUser.label) {
										values[key] = [apiResolvedUser.label];
									}
								}
							}

						if (
							!selected &&
							['threats', 'risk_scenarios', 'assets', 'applied_controls'].includes(key)
						) {
							await safeClick(field.locator, { force: true });
							if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await safeClick(combobox);
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill('', { timeout: 2_000 }).catch(() => null);
							}
							if (await searchbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await safeClick(searchbox);
								await searchbox.press('ControlOrMeta+A').catch(() => null);
								await searchbox.fill('', { timeout: 2_000 }).catch(() => null);
							}
							await this.page.waitForTimeout(250);
							if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await safeClick(dropdownToggle);
							}
							selected = await clickFirstVisibleCandidate([firstDropdownOption, optionInPage]);
						}

							if (!selected) {
								if (
									[
										'owners',
										'owner',
										'authors',
										'reviewers',
										'assigned_to',
										'default_assignee'
									].includes(key)
								) {
									if (FORM_DEBUG) {
										console.warn(
											`[form][multi] unresolved optional user-like field "${key}" for "${optionValue}", continuing without selection`
										);
									}
									continue;
								}
								const [selectedLabelText, hiddenValues] = await Promise.all([
									getSelectedLabelText(),
									getHiddenValues()
							]);
							throw new Error(
								`No multi-autocomplete option found for: ${optionValue} (selectedLabels="${selectedLabelText}", hiddenValues="${hiddenValues.join(',')}")`
							);
						}
					}
					break;
				case FormFieldType.DATE:
					await field.locator.clear();
				case FormFieldType.NUMBER:
					await field?.locator.fill(values[key].toString());
					break;
				case FormFieldType.DURATION:
					for (const unit of Object.keys(values[key])) {
						const locator = field?.locator.getByTestId(
							`form-input-${key.replaceAll('_', '-')}-${unit}`
						);
						await locator?.fill(values[key][unit].toString());
					}
					break;
				case FormFieldType.TEXT: {
					const textValue = values[key]?.toString() ?? '';
					try {
						await field.locator.fill(textValue, { timeout: 4_000 });
					} catch {
						let editable = field.locator
							.locator('textarea, input[type="text"], input:not([type]), [contenteditable="true"]')
							.first();
						const editableVisible = await editable.isVisible({ timeout: 1_000 }).catch(() => false);
						if (!editableVisible) {
							const editButton = field.locator.getByRole('button', { name: /edit/i }).first();
								if (await editButton.isVisible({ timeout: 500 }).catch(() => false)) {
									await editButton.click();
								}
								const markdownPlaceholder = field.locator
									.locator('button, div, p')
									.filter({ hasText: /Double-click to add content/i })
									.first();
							if (await markdownPlaceholder.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await markdownPlaceholder.dblclick();
							} else {
								await field.locator.dblclick().catch(() => null);
							}
						}
						editable = field.locator
							.locator('textarea, input[type="text"], input:not([type]), [contenteditable="true"]')
							.first();
						await expect(editable).toBeVisible({ timeout: 10_000 });
						const canFill = await editable
							.evaluate((el) => {
								const tag = el.tagName.toLowerCase();
								return tag === 'input' || tag === 'textarea';
							})
							.catch(() => false);
						if (canFill) {
							await editable.fill(textValue);
						} else {
							await editable.click();
							await editable.press('ControlOrMeta+A');
							await editable.type(textValue);
						}
					}
					break;
				}
				default:
					await field?.locator.fill(values[key]);
					break;
			}
			if (FORM_DEBUG) console.log(`[form] done field: ${key}`);
		}
	}

	async hasTitle() {
		await expect(this.formTitle).toBeVisible();
		// await expect(this.formTitle).toHaveText(this.name);
	}
}

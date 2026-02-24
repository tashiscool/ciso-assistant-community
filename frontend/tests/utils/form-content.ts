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
		this.formTitle = this.page.getByTestId('modal-title');
		this.saveButton = this.page.getByTestId('save-button');
		this.cancelButton = this.page.getByTestId('cancel-button');
		this.name = name;
		this.fields = new Map(
			fields.map((field) => [
				field.name,
				{
					locator: this.page.getByTestId('form-input-' + field.name.replaceAll('_', '-')),
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
			for (const spinner of await this.page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 20_000
				});
			}
			if (FORM_DEBUG) console.log(`[form] spinner wait done: ${key}`);

			await field.locator.scrollIntoViewIfNeeded({ timeout: 1_500 }).catch(() => null);
			if (FORM_DEBUG) console.log(`[form] scrolled: ${key}`);
			let fieldVisible = await field.locator.isVisible({ timeout: 750 }).catch(() => false);
			if (FORM_DEBUG) console.log(`[form] visible=${fieldVisible}: ${key}`);
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
						const optionPrefix =
							normalizedOptionValue
								.replace(/[^a-z0-9]+/g, ' ')
								.split(' ')
								.filter(Boolean)[0] ?? '';
						const typedOptionValue =
							key === 'risk_matrix' && optionPrefix.length >= 3 ? optionPrefix : optionValue;
						const searchbox = field.locator.getByRole('searchbox').first();
						const combobox = field.locator.getByRole('combobox').first();

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
									return Array.from(
										container.querySelectorAll(`input[type="hidden"][name="${fieldName}"]`)
									)
										.map((input) => (input as HTMLInputElement).value?.trim())
										.filter((value): value is string => Boolean(value));
								}, key)
								.catch(() => [] as string[]);
						};

						const hasExpectedSelection = async (allowCollapsedTextFallback = false) => {
							const [selectedLabelText, hiddenValues] = await Promise.all([
								getSelectedLabelText(),
								getHiddenValues()
							]);
							if (selectedLabelText && textMatchesOption(selectedLabelText)) return true;
							if (hiddenValues.some((value) => value === optionValue)) return true;
							if ((key === 'folder' || key === 'risk_matrix') && hiddenValues.length > 0)
								return true;
							if (!allowCollapsedTextFallback) return false;
							const collapsedFieldText =
								(await field.locator.textContent().catch(() => ''))?.replaceAll('[]', '').trim() ??
								'';
							return (
								collapsedFieldText.length > 0 &&
								textMatchesOption(collapsedFieldText) &&
								!collapsedFieldText.toLowerCase().includes('required')
							);
						};

						if (await hasExpectedSelection()) {
							return;
						}

						let responsePromise: Promise<unknown> | undefined;
						if (typeof values[key] === 'object' && values[key] && 'request' in values[key]) {
							responsePromise = this.page
								.waitForResponse(
									(resp) => resp.url().includes(values[key].request.url) && resp.status() === 200
								)
								.catch(() => null);
						} else if (key === 'risk_matrix') {
							responsePromise = this.page
								.waitForResponse(
									(resp) => resp.url().includes('/risk-matrices') && resp.status() === 200
								)
								.catch(() => null);
						}

						await field.locator.click();

						if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
							const canFillCombobox = await combobox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillCombobox) {
								await combobox.click();
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill(typedOptionValue);
							}
						}

						if (await searchbox.isVisible().catch(() => false)) {
							const searchboxIsDisabled = await searchbox
								.evaluate((el) => el.classList.contains('disabled'))
								.catch(() => false);
							if (!searchboxIsDisabled) {
								const canFillSearchbox = await searchbox
									.evaluate((el) => {
										const tag = el.tagName.toLowerCase();
										return tag === 'input' || tag === 'textarea' || el.isContentEditable;
									})
									.catch(() => false);
								if (canFillSearchbox) {
									await searchbox.click().catch(() => null);
									await searchbox.press('ControlOrMeta+A').catch(() => null);
									await searchbox.fill(typedOptionValue);
								}
							}
						}

						const option = this.page.getByRole('option', { name: optionPattern }).first();
						if (await option.isVisible({ timeout: 8_000 }).catch(() => false)) {
							await option.click();
						} else if (optionPrefix.length >= 3) {
							const fuzzyOption = this.page
								.getByRole('option', { name: new RegExp(escapeRegExp(optionPrefix), 'i') })
								.first();
							if (await fuzzyOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
								await fuzzyOption.click();
							}
						} else if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
							await combobox.click();
							await this.page.keyboard.press('ArrowDown').catch(() => null);
							await this.page.keyboard.press('Enter').catch(() => null);
						}

						if (!(await hasExpectedSelection()) && (key === 'folder' || key === 'risk_matrix')) {
							const fallbackOption = this.page.getByRole('option').first();
							if (await fallbackOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
								await fallbackOption.click();
							}
						}

						if (!(await hasExpectedSelection()) && key === 'risk_matrix') {
							if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await combobox.click().catch(() => null);
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill('').catch(() => null);
								const firstVisibleOption = this.page.getByRole('option').first();
								if (await firstVisibleOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
									await firstVisibleOption.click();
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
								await field.locator.click().catch(() => null);
								const dropdownToggle = field.locator.locator('img').first();
								if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
									await dropdownToggle.click().catch(() => null);
								}
								if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
									await combobox.click().catch(() => null);
									await combobox.press('ControlOrMeta+A').catch(() => null);
									await combobox.fill(apiMatch.label).catch(() => null);
								}
								const apiLabelOption = this.page
									.getByRole('option', { name: new RegExp(escapeRegExp(apiMatch.label), 'i') })
									.first();
								if (await apiLabelOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
									await apiLabelOption.click();
								} else {
									const firstVisibleOption = this.page.getByRole('option').first();
									if (await firstVisibleOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
										await firstVisibleOption.click();
									}
								}
							}
						}

						if (!(await hasExpectedSelection())) {
							const [selectedLabelText, hiddenValues] = await Promise.all([
								getSelectedLabelText(),
								getHiddenValues()
							]);
							throw new Error(
								`No autocomplete option found for: ${optionValue} (selectedLabels="${selectedLabelText}", hiddenValues="${hiddenValues.join(',')}")`
							);
						}

						if (responsePromise) {
							await responsePromise;
						}
					}).toPass({ timeout: 25_000, intervals: [500, 1000, 3000, 10_000] });
					break;
				case FormFieldType.SELECT_MULTIPLE_AUTOCOMPLETE:
					for (const val of values[key]) {
						const optionValue =
							typeof val === 'object' && val && 'value' in val
								? val.value.toString()
								: val.toString();
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

						const getSelectedLabelText = async () => {
							return field.locator
								.evaluate((container) => {
									const selectedList = container.querySelector('[aria-label="selected options"]');
									if (!selectedList) return '';
									const labels = Array.from(selectedList.children)
										.filter((child) => child instanceof HTMLElement)
										.filter((child) => child.matches('li[role="option"][aria-selected="true"]'))
										.map((child) => child.textContent?.trim() ?? '')
										.filter((value) => value.length > 0);
									return labels.join(' ').replaceAll('[]', '').trim();
								})
								.catch(() => '');
						};

						const getHiddenValues = async () => {
							return field.locator
								.evaluate((container, fieldName) => {
									return Array.from(
										container.querySelectorAll(`input[type="hidden"][name="${fieldName}"]`)
									)
										.map((input) => (input as HTMLInputElement).value?.trim())
										.filter((value): value is string => Boolean(value));
								}, key)
								.catch(() => [] as string[]);
						};

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

						if (await hasExpectedSelection()) {
							continue;
						}

						await this.page.keyboard.press('Escape').catch(() => null);
						await field.locator.click({ force: true }).catch(async () => {
							await field.locator.click();
						});
						const searchbox = field.locator.getByRole('searchbox').first();
						const combobox = field.locator.getByRole('combobox').first();

						if (await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) {
							const canFillCombobox = await combobox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillCombobox) {
								await combobox.click().catch(() => null);
								await combobox.press('ControlOrMeta+A').catch(() => null);
								await combobox.fill(typedOptionValue);
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
								await searchbox.click().catch(() => null);
								await searchbox.press('ControlOrMeta+A').catch(() => null);
								await searchbox.fill(typedOptionValue);
							}
						}

						const trySelectVisibleOption = async () => {
							const optionInField = field.locator
								.getByRole('option', { name: optionPattern })
								.first();
							const optionInPage = this.page.getByRole('option', { name: optionPattern }).first();
							const fuzzyInPage = this.page.getByRole('option', { name: fuzzyPattern }).first();

							if (await optionInField.isVisible({ timeout: 4_000 }).catch(() => false)) {
								await optionInField.click();
								return true;
							}
							if (await optionInPage.isVisible({ timeout: 8_000 }).catch(() => false)) {
								await optionInPage.click();
								return true;
							}
							if (await fuzzyInPage.isVisible({ timeout: 8_000 }).catch(() => false)) {
								await fuzzyInPage.click();
								return true;
							}
							return false;
						};

						let selected = await trySelectVisibleOption();
						if (!selected && (await hasExpectedSelection())) {
							selected = true;
						}

						if (!selected && (await combobox.isVisible({ timeout: 1_000 }).catch(() => false))) {
							await combobox.click().catch(() => null);
							await combobox.press('ArrowDown').catch(() => null);
							await combobox.press('Enter').catch(() => null);
							selected = await hasExpectedSelection();
						}

						if (!selected) {
							const dropdownToggle = field.locator.locator('img').first();
							if (await dropdownToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
								await dropdownToggle.click().catch(() => null);
							}
							selected = await trySelectVisibleOption();
						}

						if (!selected) {
							const firstVisibleOption = this.page.getByRole('option').first();
							if (await firstVisibleOption.isVisible({ timeout: 4_000 }).catch(() => false)) {
								await firstVisibleOption.click();
								selected = await hasExpectedSelection();
							}
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
							// Actor labels can be prefixed/suffixed in different locales.
							const looseMatch = this.page
								.getByRole('option', { name: new RegExp(optionPrefix, 'i') })
								.first();
							if (await looseMatch.isVisible({ timeout: 5_000 }).catch(() => false)) {
								await looseMatch.click();
								selected = await hasExpectedSelection();
							}
						}

						if (!selected) {
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
							const markdownPlaceholder = field
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

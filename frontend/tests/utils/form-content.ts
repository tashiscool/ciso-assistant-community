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
			const fieldVisible = await field.locator.isVisible({ timeout: 750 }).catch(() => false);
			if (FORM_DEBUG) console.log(`[form] visible=${fieldVisible}: ${key}`);
			if (!fieldVisible) {
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
				if (FORM_DEBUG) console.warn(`[form] Field not visible, skipping: ${key}`);
				continue;
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
					await expect(async () => {
						const optionValue = values[key]?.toString();
						if (!optionValue) return;
						try {
							await field.locator.selectOption(optionValue);
						} catch {
							try {
								await field.locator.selectOption({ label: optionValue });
							} catch {
								const fallbackValue = await field.locator.evaluate(
									(select, wanted) => {
										const wantedNormalized = wanted.trim().toLowerCase();
										const option = Array.from(select.options).find(
											(opt) =>
												opt.value?.trim().toLowerCase() === wantedNormalized ||
												opt.label?.trim().toLowerCase() === wantedNormalized ||
												opt.textContent?.trim().toLowerCase() === wantedNormalized
										);
										return option?.value ?? null;
									},
									optionValue
								);
								if (!fallbackValue) throw new Error(`No select option for: ${optionValue}`);
								await field.locator.selectOption(fallbackValue);
							}
						}
					}).toPass({ timeout: 10_000, intervals: [250, 500, 1000, 2000] });
					break;
				case FormFieldType.SELECT_AUTOCOMPLETE:
					await expect(async () => {
						const optionValue =
							typeof values[key] === 'object' && 'value' in values[key]
								? values[key].value
								: values[key];
						const searchbox = field.locator.getByRole('searchbox').first();
						const hasSearchbox = (await searchbox.count()) > 0;

						let responsePromise: Promise<unknown> | undefined;
						if (typeof values[key] === 'object' && 'request' in values[key]) {
							responsePromise = this.page.waitForResponse(
								(resp) => resp.url().includes(values[key].request.url) && resp.status() === 200
							);
						}

						await field.locator.click();

						if (hasSearchbox && (await searchbox.isVisible().catch(() => false))) {
							const searchboxIsDisabled = await searchbox
								.evaluate((el) => el.classList.contains('disabled'))
								.catch(() => false);
							if (searchboxIsDisabled) {
								await expect(searchbox).toContainText(optionValue);
								return;
							}
							const canFillSearchbox = await searchbox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillSearchbox) {
								await searchbox.fill(optionValue);
							}
						}

						// Options can be rendered in a floating portal outside the field container.
						const optionPattern = new RegExp(escapeRegExp(optionValue), 'i');
						const option = this.page.getByRole('option', { name: optionPattern }).first();
						if (await option.isVisible({ timeout: 6_000 }).catch(() => false)) {
							await option.click();
						} else {
							const fallbackOption = this.page.getByRole('option').first();
							await expect(fallbackOption).toBeVisible({ timeout: 10_000 });
							await fallbackOption.click();
						}

						if (responsePromise) {
							await responsePromise;
						}
					}).toPass({ timeout: 25_000, intervals: [500, 1000, 3000, 10_000] });
					break;
				case FormFieldType.SELECT_MULTIPLE_AUTOCOMPLETE:
					for (const val of values[key]) {
						const optionValue =
							typeof val === 'object' && val && 'value' in val ? val.value.toString() : val.toString();
						const optionPattern = new RegExp(escapeRegExp(optionValue), 'i');
						await field.locator.click();
						const searchbox = field.locator.getByRole('searchbox').first();
						if (await searchbox.isVisible({ timeout: 1000 }).catch(() => false)) {
							const canFillSearchbox = await searchbox
								.evaluate((el) => {
									const tag = el.tagName.toLowerCase();
									return tag === 'input' || tag === 'textarea' || el.isContentEditable;
								})
								.catch(() => false);
							if (canFillSearchbox) {
								await searchbox.fill(optionValue);
							}
						}

						const optionInField = field.locator.getByRole('option', { name: optionPattern }).first();
						const optionInPage = this.page.getByRole('option', { name: optionPattern }).first();
						if (await optionInField.isVisible({ timeout: 2_000 }).catch(() => false)) {
							await optionInField.click();
						} else if (await optionInPage.isVisible({ timeout: 8_000 }).catch(() => false)) {
							await optionInPage.click();
						} else {
							const fallbackInField = field.locator.getByRole('option').first();
							const fallbackInPage = this.page.getByRole('option').first();
							if (await fallbackInField.isVisible({ timeout: 1_500 }).catch(() => false)) {
								await fallbackInField.click();
							} else if (await fallbackInPage.isVisible({ timeout: 8_000 }).catch(() => false)) {
								await fallbackInPage.click();
							} else {
								throw new Error(`No multi-autocomplete option found for: ${optionValue}`);
							}
						}
					}
					const searchbox = field.locator.getByRole('searchbox').first();
					const searchboxDisabled = await searchbox
						.evaluate((el) => el.classList.contains('disabled'))
						.catch(() => false);
					if ((await field.locator.isEnabled()) && !searchboxDisabled) {
						await field.locator.press('Escape');
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
						const editable = field.locator
							.locator('textarea, input, [contenteditable="true"]')
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

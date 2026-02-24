import { getObjectNameWithoutScope, expect, type Locator, type Page } from './test-utils.js';
import { FormContent, FormFieldType } from './form-content.js';
import { BasePage } from './base-page.js';

export class PageDetail extends BasePage {
	readonly form: FormContent;
	item: string;
	readonly editButton: Locator;

	constructor(
		public readonly page: Page,
		url: string,
		form: FormContent,
		item: string
	) {
		super(page, url, item);
		this.form = form;
		this.item = item;
		this.editButton = this.page.getByTestId('edit-button');
	}

	setItem(item: string) {
		this.item = item;
	}

	async editItem(buildParams: { [k: string]: string }, editParams: { [k: string]: string }) {
		await this.editButton.click();
		await this.hasBreadcrumbPath([], false);

		const editedValues: { [k: string]: string } = {};
		const uniqueSuffix = ` edited-${Math.random().toString(36).slice(2, 6)}`;
		for (const key in editParams) {
			editedValues[key] =
				editParams[key] === '' ? `${buildParams[key]}${uniqueSuffix}` : editParams[key];
		}

		await this.form.fill(editedValues);
		await this.form.saveButton.click();

		await this.isToastVisible('The .+ has been successfully updated');
		return editedValues;
	}

	async verifyItem(values: { [k: string]: any }) {
		if (this.url.includes('risk-assessments')) {
			if ('perimeter' in values) {
				await expect
					.soft(this.page.getByTestId('name-field-value'))
					.toHaveText(`${values.perimeter}/${values.name} - ${values.version}`);
			} else {
				await expect
					.soft(this.page.getByTestId('name-field-value'))
					.toHaveText(new RegExp(`.+/${values.name} - ${values.version}`));
			}
			if ('risk_matrix' in values) {
				await expect
					.soft(this.page.getByTestId('risk-matrix-field-title'))
					.toHaveText('Risk matrix:');
				await expect
					.soft(this.page.getByTestId('risk-matrix-field-value'))
					.toHaveText(values.risk_matrix);
			}

			await expect
				.soft(this.page.getByTestId('description-field-title'))
				.toHaveText('Description:');
			await expect
				.soft(this.page.getByTestId('description-field-value'))
				.toHaveText(values.description);
			} else {
				for (const key in values) {
					const fieldTitle = this.page.getByTestId(key.replaceAll('_', '-') + '-field-title');
					if (await fieldTitle.isVisible()) {
						await expect.soft(fieldTitle).toBeVisible();

						if (this.form.fields.get(key)?.type === FormFieldType.CHECKBOX) {
							await expect
								.soft(this.page.getByTestId(key.replaceAll('_', '-') + '-field-value'))
							.toHaveText(values[key] ? '✅' : '❌');
					} else if (this.form.fields.get(key)?.type === FormFieldType.DATE) {
						const displayedValue = await this.page
							.getByTestId(key.replaceAll('_', '-') + '-field-value')
							.innerText();

						const displayedDate = new Date(displayedValue);
						const date = new Date(values[key]);

						expect
							.soft(displayedValue)
							.toMatch(
								/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{1,2}\/\d{1,2}\/\d{2})|(\d{4}-\d{2}-\d{2}),\s\d{1,2}(:\d{1,2}){2} (AM|PM)/
							);
						expect.soft(displayedDate.getFullYear()).toBe(date.getFullYear());
						expect.soft(displayedDate.getMonth()).toBe(date.getMonth());
						expect.soft(displayedDate.getDate()).toBe(date.getDate());
					} else if (this.form.fields.get(key)?.type === FormFieldType.FILE) {
						const displayedValue = await this.page
							.getByTestId(key.replaceAll('_', '-') + '-field-value')
							.innerText();
						const fileName = values[key]?.split('/')?.pop()?.split('.') ?? [];

						expect
							.soft(displayedValue)
							.toMatch(new RegExp(fileName[0] + '(_.{7})?' + '.' + fileName[1]));
					} else {
						const value = this.page.getByTestId(key.replaceAll('_', '-') + '-field-value');
						if ((await value.allInnerTexts()).length > 1) {
							await expect
								.soft(await value.allInnerTexts())
								.toHaveTextUnordered(
									typeof values[key] === 'object' && !Array.isArray(values[key])
										? values[key].value
										: values[key]
								);
						} else {
							await expect
								.soft(value)
								.toContainText(
									getObjectNameWithoutScope(
										typeof values[key] === 'object'
											? !Array.isArray(values[key])
												? values[key].value
												: values[key][0]
											: values[key]
									),
									{ ignoreCase: true }
								);
						}
					}
				}
			}
		}
	}

	async treeViewItem(value: string, path: string[] = []) {
		const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const valuePattern = new RegExp(`^${escapeRegex(value)}\\b`, 'i');
		await this.page.getByTestId('tree-item-content').first().waitFor({ state: 'visible' });
		const content = this.page
			.getByTestId('tree-item-content')
			.filter({ hasText: valuePattern })
			.locator(':visible')
			.first();

		// Expand tree using stable requirement codes (e.g. ID, ID.AM) instead of localized labels.
		if (await content.first().isHidden().catch(() => true)) {
			const code = value.includes('-') ? value.split('-').slice(0, -1).join('-') : value;
			const codeLevels = code
				.split('.')
				.filter((part) => part.length > 0)
				.map((_, idx, arr) => arr.slice(0, idx + 1).join('.'));
			for (let i = 0; i < codeLevels.length; i++) {
				const currentPattern = new RegExp(`^${escapeRegex(codeLevels[i])}\\b`, 'i');
				const current = this.page
					.getByTestId('tree-item-content')
					.filter({ hasText: currentPattern })
					.locator(':visible')
					.first();
				const nextPattern =
					i < codeLevels.length - 1
						? new RegExp(`^${escapeRegex(codeLevels[i + 1])}\\b`, 'i')
						: valuePattern;
				const next = this.page
					.getByTestId('tree-item-content')
					.filter({ hasText: nextPattern })
					.locator(':visible')
					.first();
				const nextVisible = await next.isVisible().catch(() => false);
				if (!nextVisible && (await current.isVisible().catch(() => false))) {
					await current.click();
				}
			}
		}

		// Keep legacy label-based expansion as fallback when an explicit path is provided.
		if (path.length !== 0 && (await content.first().isHidden().catch(() => true))) {
			const tree = [...path, value];
			for (let i = 0; i < tree.length - 1; i++) {
				const current = this.page.getByTestId('tree-item-content').getByText(tree[i]).first();
				const next = this.page.getByTestId('tree-item-content').getByText(tree[i + 1]).first();
				if (
					(await next.isHidden().catch(() => true)) &&
					(await current.isVisible().catch(() => false))
				) {
					await current.click();
				}
			}
		}
		const owningTreeItem = content.locator('xpath=ancestor::*[@data-testid="tree-item"][1]');
		return {
			content,
			progressRadial: owningTreeItem
				.getByTestId('tree-item-lead')
				.getByTestId('progress-ring-svg')
				.first(),
			default: owningTreeItem
		};
	}
}

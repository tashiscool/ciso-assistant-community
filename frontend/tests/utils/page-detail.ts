import { getObjectNameWithoutScope, expect, type Locator, type Page } from './test-utils.js';
import { FormContent, FormFieldType } from './form-content.js';
import { BasePage } from './base-page.js';

export class PageDetail extends BasePage {
	readonly form: FormContent;
	item: string;
	readonly editButton: Locator;

	private static normalizeValue(value: string): string {
		return value
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.trim();
	}

	private static slugify(value: string): string {
		return this.normalizeValue(value)
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	private static selectValueMatches(actualValue: string, expectedValue: string): boolean {
		const actualNormalized = this.normalizeValue(actualValue);
		const expectedNormalized = this.normalizeValue(expectedValue);
		const actualSlug = this.slugify(actualValue);
		const expectedSlug = this.slugify(expectedValue);
		const actualCompact = actualSlug.replaceAll('_', '');
		const expectedCompact = expectedSlug.replaceAll('_', '');

		if (
			actualNormalized.includes(expectedNormalized) ||
			expectedNormalized.includes(actualNormalized) ||
			actualSlug.includes(expectedSlug) ||
			expectedSlug.includes(actualSlug) ||
			actualCompact.includes(expectedCompact) ||
			expectedCompact.includes(actualCompact)
		) {
			return true;
		}

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
			planned: ['planifie', 'planifiee', 'planifiees'],
			inreview: ['en_revision', 'en revision', 'en_revue', 'review'],
			completed: ['termine', 'terminee', 'done'],
			deprecated: ['deprecie'],
			high: ['eleve', 'haut'],
			medium: ['moyen', 'modere', 'average'],
			low: ['faible', 'bas']
		};
		const expectedAliases = aliasMap[expectedCompact] ?? [];
		if (
			expectedAliases.some((alias) =>
				actualCompact.includes(alias.replaceAll('_', '').replaceAll(' ', ''))
			)
		) {
			return true;
		}

		const aliasRoot = Object.entries(aliasMap).find(([, aliases]) =>
			aliases
				.map((alias) => alias.replaceAll('_', '').replaceAll(' ', ''))
				.includes(expectedCompact)
		)?.[0];
		if (aliasRoot && actualCompact.includes(aliasRoot)) {
			return true;
		}

		return false;
	}

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
		const uniqueSuffix = ' edited';
		for (const key in editParams) {
			editedValues[key] =
				editParams[key] === '' ? `${buildParams[key]}${uniqueSuffix}` : editParams[key];
		}
		const duplicateFieldKey = ['name', 'email', 'ref_id'].find(
			(key) => typeof editedValues[key] === 'string' && editedValues[key].trim().length > 0
		);
		let duplicateRetryCount = 0;
		while (true) {
			await this.form.fill(editedValues);

			// Detail edit pages do not always have a modal title; avoid waiting on a non-existent locator.
			await this.form.formTitle.click({ timeout: 500 }).catch(async () => {
				await this.page.keyboard.press('Tab').catch(() => null);
			});

			const saveButtonCandidates = [
				this.form.saveButton,
				this.page
					.getByRole('button', {
						name: /^(Save|Enregistrer|Guardar|Speichern|Salvar|Enregistrez)$/i
					})
					.first()
			];
			let clicked = false;
			for (const candidate of saveButtonCandidates) {
				if (!(await candidate.isVisible({ timeout: 1_000 }).catch(() => false))) {
					continue;
				}
				await candidate.scrollIntoViewIfNeeded().catch(() => null);
				await candidate.click({ timeout: 10_000 }).catch(async () => {
					await candidate.click({ force: true, timeout: 10_000 });
				});
				clicked = true;
				break;
			}
			if (!clicked) {
				throw new Error(`Could not find a visible save button while editing ${this.url}`);
			}

			const duplicateErrorVisible = await this.page
				.getByText(/already used in this scope|already exists|deja utilise|déjà utilisé/i)
				.first()
				.isVisible({ timeout: 1_500 })
				.catch(() => false);
			if (duplicateErrorVisible && duplicateFieldKey && duplicateRetryCount < 3) {
				duplicateRetryCount += 1;
				editedValues[duplicateFieldKey] = `${editedValues[duplicateFieldKey]}-${Math.random().toString(36).slice(2, 6)}`;
				continue;
			}

			const startedOnEditRoute = /\/edit(?:$|[/?#])/i.test(this.page.url());
			const leftEditRoute = startedOnEditRoute
				? await this.page
						.waitForURL((url) => !/\/edit(?:$|[/?#])/i.test(url.toString()), {
							timeout: 15_000
						})
						.then(() => true)
						.catch(() => false)
				: false;

			await this.isToastVisible(
				'successfully updated|successfully saved|mise a jour|mis a jour|mise à jour|mis à jour|enregistre avec succes|enregistré avec succès',
				'i',
				{ optional: true, timeout: 10_000 }
			);

			if (startedOnEditRoute && !leftEditRoute) {
				const validationMessages = await this.page
					.locator('.text-error-500:visible, [role="alert"]:visible')
					.allInnerTexts()
					.catch(() => []);
				if (validationMessages.length > 0) {
					throw new Error(`Edit validation error: ${validationMessages.join(' | ')}`);
				}
			}
			break;
		}
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
						.toHaveText(/risk matrix:|matrice de risque:/i);
					const displayedRiskMatrix = await this.page
						.getByTestId('risk-matrix-field-value')
						.innerText();
					const normalize = (value: string) =>
						(value || '')
							.normalize('NFD')
							.replace(/[\u0300-\u036f]/g, '')
							.toLowerCase()
							.replace(/\s+/g, ' ')
							.trim();
					const expectedRiskMatrix = normalize(String(values.risk_matrix || ''));
					const actualRiskMatrix = normalize(displayedRiskMatrix).replace(
						/^matrice de risque\s+/,
						''
					);
					const expectedTokenAliases: Record<string, string[]> = {
						critical: ['critique'],
						high: ['haut', 'eleve'],
						medium: ['moyen', 'modere'],
						moderate: ['moyen', 'modere'],
						low: ['faible', 'bas']
					};
					const expectedTokens = expectedRiskMatrix.split(' ').filter(Boolean);
					const tokensMatch = expectedTokens.every((token) => {
						if (actualRiskMatrix.includes(token)) return true;
						const aliases = expectedTokenAliases[token] || [];
						return aliases.some((alias) => actualRiskMatrix.includes(alias));
					});
					expect
						.soft(tokensMatch || actualRiskMatrix.includes(expectedRiskMatrix))
						.toBeTruthy();
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
							const expectedRaw =
								typeof values[key] === 'object'
									? !Array.isArray(values[key])
										? values[key].value
										: values[key][0]
									: values[key];
							const expectedText = getObjectNameWithoutScope(expectedRaw);
							if (this.form.fields.get(key)?.type === FormFieldType.SELECT) {
								const actualText = (await value.innerText()).trim();
								expect
									.soft(PageDetail.selectValueMatches(actualText, expectedText))
									.toBeTruthy();
							} else {
								await expect.soft(value).toContainText(expectedText, { ignoreCase: true });
							}
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

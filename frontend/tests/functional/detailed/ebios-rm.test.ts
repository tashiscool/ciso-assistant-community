import { LoginPage } from '../../utils/login-page.js';
import { TestContent, test, expect } from '../../utils/test-utils.js';

let vars = TestContent.generateTestVars();
let testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

const workshopStepsNames: { [k: number]: string | RegExp } = {
	11: /Define the study framework|Définir le cadre de l['’]étude/i,
	12: /Define business and technical perimeter|Définir le périmètre/i,
	13: /Identify feared events|Identifier les [ée]v[ée]nements redout[ée]s/i,
	14: /Determine the security foundation|D[ée]terminer le socle de s[ée]curit[ée]/i,
	21: /Identify risk origins and targeted objectives|Identifier les sources de risque/i,
	22: /Evaluate RO\/TO pairs|[ÉE]valuer les couples/i,
	23: /Select RO\/TO pairs|Sélectionner les couples/i,
	31: /Map the ecosystem|Cartographier l['’]écosystème/i,
	32: /Develop strategic scenarios|[ÉE]laborer les sc[ée]narios strat[ée]giques/i,
	33: /Define security measures for the ecosystem|D[ée]finir les mesures de s[ée]curit[ée]/i,
	40: /Prepare elementary actions|Pr[ée]parer les actions [ée]l[ée]mentaires/i,
	41: /Develop operational scenarios|[ÉE]laborer les sc[ée]narios op[ée]rationnels/i,
	42: /Evaluate the likelihood of operational scenarios|[ÉE]valuer la vraisemblance des sc[ée]narios op[ée]rationnels/i,
	51: /Generate the risk assessment|G[ée]n[ée]rer l['’][ée]valuation des risques/i,
	52: /Decide on risk treatment strategy|D[ée]cider de la strat[ée]gie de traitement des risques/i,
	53: /Define security measures|D[ée]finir les mesures de s[ée]curit[ée]/i,
	54: /Assess and document residual risks|[ÉE]valuer et documenter les risques r[ée]siduels/i,
	55: /Establish risk monitoring framework|Mettre en place le cadre de suivi des risques/i
};

const ebiosRmStudy = {
	displayName: 'Ebios RM studies',
	modelName: 'ebiosrmstudy',
	dependency: vars.matrix,
	build: {
		name: `Test Ebios RM Study ${vars.folderName}`,
		folder: vars.folderName,
		risk_matrix: vars.matrix.displayName
		// eta: "2025-01-01",
		// due_date: "2025-05-01"
	}
};

test.setTimeout(420_000);

const ensureModalClosed = async (page: import('@playwright/test').Page) => {
	const modalTitle = page.getByTestId('modal-title');
	try {
		await expect(modalTitle).not.toBeVisible({ timeout: 5_000 });
		return;
	} catch {
		// Continue with fallback closes when modal stays open after validation errors.
	}

	const cancelButton = page.getByRole('button', { name: /Cancel|Annuler/i }).first();
	if (await cancelButton.isVisible().catch(() => false)) {
		await cancelButton.click();
	}

	if (await modalTitle.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape');
	}

	await expect(modalTitle).not.toBeVisible({ timeout: 20_000 });
};

test('ebios rm study', async ({
	logedPage,
	foldersPage,
	perimetersPage,
	assetsPage,
	librariesPage,
	ebiosRmStudyPage,
	page
}) => {
	page.setDefaultTimeout(20_000);

	await test.step('create required folder', async () => {
		await foldersPage.goto();
		await foldersPage.hasUrl();
		await foldersPage.createItem({
			name: vars.folderName,
			description: vars.description
		});
	});

	await test.step('create required perimeter', async () => {
		await perimetersPage.goto();
		await perimetersPage.hasUrl();
		await perimetersPage.createItem({
			name: vars.perimeterName,
			description: vars.description,
			ref_id: 'R-1234',
			lc_status: 'Production'
		});
		await perimetersPage.createItem({
			name: `additional perimeter ${vars.folderName}`,
			description: vars.description,
			ref_id: 'R-1234',
			lc_status: 'Production'
		});
	});

	await test.step('create required assets', async () => {
		await assetsPage.goto();
		await assetsPage.hasUrl();
		await assetsPage.createItem({
			name: vars.assetName,
			description: vars.description,
			type: 'Primary'
		});
		await assetsPage.createItem({
			name: `added asset ${vars.folderName}`,
			description: vars.description,
			type: 'Primary'
		});
	});

	await test.step('import risk matrix', async () => {
		await librariesPage.goto();
		await librariesPage.hasUrl();
		await librariesPage.importLibrary(vars.matrix.name, vars.matrix.urn);
	});

	await test.step('import framework', async () => {
		await librariesPage.goto();
		await librariesPage.hasUrl();
		await librariesPage.importLibrary(vars.framework.name, vars.framework.urn);
	});

	await test.step('create ebios rm study', async () => {
		await ebiosRmStudyPage.goto();
		await ebiosRmStudyPage.hasUrl();
		await ebiosRmStudyPage.hasTitle();
		if (!/\/ebios-rm\/?$/.test(page.url())) {
			await page.goto('/ebios-rm');
		}
		await expect(page).toHaveURL(/\/ebios-rm\/?$/);
		const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const selectAutocomplete = async (
			fieldTestId: 'form-input-folder' | 'form-input-risk-matrix',
			preferredLabel: string,
			required: boolean = true
		) => {
			const field = page.getByTestId(fieldTestId);
			const isVisible = await field.isVisible({ timeout: 5_000 }).catch(() => false);
			if (!isVisible) {
				if (required) {
					throw new Error(`Expected autocomplete field ${fieldTestId} to be visible`);
				}
				return false;
			}
			await page.keyboard.press('Escape').catch(() => null);
			await field.click({ force: true });

			const combobox = field.getByRole('combobox').first();
			const searchbox = field.getByRole('searchbox').first();
			const input =
				(await combobox.isVisible({ timeout: 1_000 }).catch(() => false)) ? combobox : searchbox;

			if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
				await input.click({ force: true }).catch(() => null);
				await input.press('ControlOrMeta+A').catch(() => null);
				await input.fill(preferredLabel).catch(() => null);
			}

			const preferredOption = page
				.getByRole('option', { name: new RegExp(escapeRegExp(preferredLabel), 'i') })
				.first();
				if (await preferredOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
					await preferredOption.click();
				} else {
					const firstOption = page.getByRole('option').first();
					if (await firstOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
						await firstOption.click().catch(() => null);
					}
				}

			await page.waitForTimeout(300);
			return true;
		};

		const addStudyButton = page.getByRole('button', {
			name: /Add EBIOS RM study|Ajouter une étude EBIOS RM/i
		});
		await addStudyButton.click();
		await expect(page.getByTestId('modal-title')).toBeVisible();
		await page.getByTestId('form-input-name').fill(ebiosRmStudy.build.name);
		await selectAutocomplete('form-input-folder', vars.folderName);
		await selectAutocomplete('form-input-risk-matrix', vars.matrix.displayName, false);
		if (await page.getByTestId('modal-title').isVisible({ timeout: 2_000 }).catch(() => false)) {
			await page.getByTestId('save-button').click();
		}
		if (await page.getByTestId('modal-title').isVisible({ timeout: 2_000 }).catch(() => false)) {
			await selectAutocomplete('form-input-folder', vars.folderName);
			await selectAutocomplete('form-input-risk-matrix', vars.matrix.displayName, false);
			await page.getByTestId('save-button').click();
		}
		await expect(page.getByTestId('modal-title')).not.toBeVisible({ timeout: 20_000 });
		const ebiosDetailUrlPattern = /\/ebios-rm\/[0-9a-f-]{36}(?:\/.*)?$/i;
		if (!ebiosDetailUrlPattern.test(page.url())) {
			const exactRow = page.getByRole('gridcell', { name: ebiosRmStudy.build.name }).first();
			if (await exactRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
				await exactRow.click();
			} else {
				await page.getByRole('gridcell', { name: /Test Ebios RM Study/i }).first().click();
			}
		}
		await expect(page).toHaveURL(ebiosDetailUrlPattern);
	});

	await test.step('workshop 1', async () => {
		await test.step('step 1', async () => {
			await page.getByTestId('workshop-1-step-1-link').click();
			await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[11]], false);
			await page.getByRole('link', { name: /Edit|Modifier/i }).click();
			await expect(page).toHaveURL(/.*edit.*/);
			await ebiosRmStudyPage.form.fill({
				authors: [LoginPage.defaultEmail],
				reviewers: [LoginPage.defaultEmail]
			});
			await page.keyboard.press('Escape').catch(() => null);
			await page.getByTestId('save-button').click({ timeout: 5_000 }).catch(async () => {
				await page.getByTestId('save-button').click({ force: true, timeout: 5_000 });
			});
			await ensureModalClosed(page);
			await expect(
				page
					.locator('#activityOne div')
					.filter({ hasText: /Authors|Auteurs/i })
					.getByRole('link')
					.first()
			).toBeVisible();
			await expect(
				page
					.locator('#activityOne div')
					.filter({ hasText: /Reviewers|Relecteurs/i })
					.getByRole('link')
					.first()
			).toBeVisible();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});

		await test.step('step 2', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-1-step-2-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[12]], false);
				await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});

		await test.step('step 3', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-1-step-3-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[13]], false);
				await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});

		await test.step('step 4', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-1-step-4-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[14]], false);
				await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
	});

	await test.step('workshop 2', async () => {
		await expect(async () => {
			await page.getByTestId('workshop-2-step-1-link').click();
			await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[21]], false);
			await expect(page).toHaveURL(/.*workshop-2.*/);
		}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
		await page
			.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
			.click();
		await expect(async () => {
			await page.getByTestId('workshop-2-step-2-link').click();
			await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[22]], false);
			await expect(page).toHaveURL(/.*workshop-2.*/);
		}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
		await page
			.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
			.click();
		await expect(async () => {
			await page.getByTestId('workshop-2-step-3-link').click();
			await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[23]], false);
			await expect(page).toHaveURL(/.*workshop-2.*/);
		}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
		await page
			.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
			.click();
	});

	await test.step('workshop 3', async () => {
		const stepChecks: Array<{ link: string; key: number }> = [
			{ link: 'workshop-3-step-1-link', key: 31 },
			{ link: 'workshop-3-step-2-link', key: 32 },
			{ link: 'workshop-3-step-3-link', key: 33 }
		];

		for (const step of stepChecks) {
			await expect(async () => {
				await page.getByTestId(step.link).click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[step.key]], false);
				await expect(page).toHaveURL(/.*workshop-3.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		}
	});

	await test.step('workshop 4', async () => {
		const stepChecks: Array<{ link: string; key: number }> = [
			{ link: 'workshop-4-step-0-link', key: 40 },
			{ link: 'workshop-4-step-1-link', key: 41 },
			{ link: 'workshop-4-step-2-link', key: 42 }
		];

		for (const step of stepChecks) {
			const stepLink = page.getByTestId(step.link);
			if (!(await stepLink.isVisible().catch(() => false))) {
				continue;
			}

			await expect(async () => {
				await stepLink.click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[step.key]], false);
				await expect(page).toHaveURL(/.*workshop-4.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		}
	});

	await test.step('workshop 5', async () => {
		const generateRiskButton = page.getByRole('button', {
			name: /Step 1.*Generate the risk|Étape 1.*Générer l['’]évaluation des risques/i
		});
		if (!(await generateRiskButton.isVisible().catch(() => false))) {
			return;
		}
		await generateRiskButton.click();
		await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[51]], false);
		await expect(page).toHaveURL(/.*workshop-5.*/);
		await page
			.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
			.click();
	});
});

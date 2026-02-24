import { LoginPage } from '../../utils/login-page.js';
import { TestContent, test, expect } from '../../utils/test-utils.js';

let vars = TestContent.generateTestVars();
let testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

const workshopStepsNames: { [k: number]: string | RegExp } = {
	11: /Define the study framework|Définir le cadre de l['’]étude/i,
	12: /Define business and technical perimeter|Définir le périmètre/i,
	13: /Identify feared events|Identifier les événements redoutés/i,
	14: /Determine the security foundation|Déterminer le socle de sécurité/i,
	21: /Identify risk origins and targeted objectives|Identifier les sources de risque/i,
	22: /Evaluate RO\/TO pairs|Évaluer les couples/i,
	23: /Select RO\/TO pairs|Sélectionner les couples/i,
	31: /Map the ecosystem|Cartographier l['’]écosystème/i,
	32: /Develop strategic scenarios|Élaborer les scénarios stratégiques/i,
	33: /Define security measures for the ecosystem|Définir les mesures de sécurité/i,
	40: /Prepare elementary actions|Préparer les actions élémentaires/i,
	41: /Develop operational scenarios|Élaborer les scénarios opérationnels/i,
	42: /Evaluate the likelihood of operational scenarios|Évaluer la vraisemblance des scénarios opérationnels/i,
	51: /Generate the risk assessment|Générer l['’]évaluation des risques/i,
	52: /Decide on risk treatment strategy|Décider de la stratégie de traitement des risques/i,
	53: /Define security measures|Définir les mesures de sécurité/i,
	54: /Assess and document residual risks|Évaluer et documenter les risques résiduels/i,
	55: /Establish risk monitoring framework|Mettre en place le cadre de suivi des risques/i
};

const ebiosRmStudy = {
	displayName: 'Ebios RM studies',
	modelName: 'ebiosrmstudy',
	dependency: vars.matrix,
	build: {
		name: 'Test Ebios RM Study',
		risk_matrix: vars.matrix.displayName,
		folder: vars.folderName
		// eta: "2025-01-01",
		// due_date: "2025-05-01"
	}
};

test.setTimeout(420_000);

test('ebios rm study', async ({
	logedPage,
	foldersPage,
	perimetersPage,
	assetsPage,
	librariesPage,
	ebiosRmStudyPage,
	complianceAssessmentsPage,
	appliedControlsPage,
	riskAssessmentsPage,
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
			folder: vars.folderName,
			ref_id: 'R-1234',
			lc_status: 'Production'
		});
		await perimetersPage.createItem({
			name: 'additional perimeter',
			description: vars.description,
			folder: vars.folderName,
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
			folder: vars.folderName,
			type: 'Primary'
		});
		await assetsPage.createItem({
			name: 'added asset',
			description: vars.description,
			folder: vars.folderName,
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
		await page.goto('/ebios-rm');
		await ebiosRmStudyPage.hasUrl();
		await ebiosRmStudyPage.hasTitle();
		await ebiosRmStudyPage.createItem({
			name: ebiosRmStudy.build.name,
			folder: vars.folderName,
			risk_matrix: vars.matrix.displayName
		});
		await page.getByRole('gridcell', { name: ebiosRmStudy.build.name }).first().click();
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
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
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
			await complianceAssessmentsPage.createItem({
				name: 'security foundation audit',
				perimeter: `${vars.folderName}/${vars.perimeterName}`,
				framework: vars.framework.name
			});
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
		await test.step('step 1', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-3-step-1-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[31]], false);
				await expect(page).toHaveURL(/.*workshop-3.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-category').getByRole('combobox').first().click({
				force: true
			});
			await page.getByRole('option', { name: /partner|partenaire/i }).click();
			await page.getByText('4').first().click();
			await page.getByText('4').nth(1).click();
			await page.getByText('1', { exact: true }).nth(2).click();
			await page.getByText('1', { exact: true }).nth(3).click();
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
		await test.step('step 2', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-3-step-2-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[32]], false);
				await expect(page).toHaveURL(/.*workshop-3.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test strategic scenario 1');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page
				.locator('div')
				.filter({ hasText: /Reminder|Rappel/i })
				.nth(2)
				.click();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
			await expect(async () => {
				await page.getByTestId('workshop-3-step-2-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[32]], false);
				await expect(page).toHaveURL(/.*workshop-3.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByRole('gridcell', { name: 'test strategic scenario' }).click();
			await expect(page).not.toHaveURL(/.*workshop-3.*/);
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test attack path 1');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test attack path 2');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page
				.getByRole('link', {
					name: /Develop strategic scenarios|Élaborer les scénarios stratégiques/i
				})
				.click();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
		await test.step('step 3', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-3-step-3-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[33]], false);
				await expect(page).toHaveURL(/.*workshop-3.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page
				.getByRole('gridcell', { name: /Partner|Partenaire/i })
				.first()
				.click();
			await expect(page).not.toHaveURL(/.*workshop-3.*/);
			await appliedControlsPage.createItem({ name: 'test applied control 1' });
			await appliedControlsPage.createItem({ name: 'test applied control 2' });
			await page
				.getByRole('link', {
					name: /Define security measures for|Définir les mesures de sécurité/i
				})
				.click();
			await expect(page).toHaveURL(/.*workshop-3.*/);
			await page.getByTestId('tablerow-edit-button').click();
			await expect(page).toHaveURL(/.*edit.*/);
			await page
				.locator(
					'div:nth-child(4) > .flex.flex-col.space-y-4 > span > div:nth-child(3) > .p-1 > label:nth-child(3) > .text-base'
				)
				.first()
				.click();
			await page
				.locator(
					'div:nth-child(4) > .flex.flex-col.space-y-4 > span > div > .p-1 > label:nth-child(2) > .text-base'
				)
				.first()
				.click();
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
	});
	await test.step('workshop 4', async () => {
		await test.step('step 0', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-4-step-0-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[40]], false);
				await expect(page).toHaveURL(/.*workshop-4.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test elementary action 1');
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('reconnaissance');
			await page.getByTestId('form-input-threat').getByRole('combobox').first().click({
				force: true
			});
			await page.getByText('Icon --').click();
			await page.getByTestId('form-input-icon').selectOption('cube');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-attack-stage').selectOption('1');
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('initial access');
			await page.getByTestId('form-input-icon').selectOption('server');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-attack-stage').selectOption('2');
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('DISCO');
			await page.getByTestId('form-input-icon').selectOption('diamond');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-attack-stage').selectOption('3');
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('exploitation');
			await page.getByTestId('form-input-icon').selectOption('skull');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByRole('gridcell', { name: 'reconnaissance', exact: true }).click();
			await expect(page).not.toHaveURL(/.*workshop-4.*/);
			await page
				.getByRole('link', {
					name: /Prepare elementary actions|Préparer les actions élémentaires/i
				})
				.click();
			await expect(page).toHaveURL(/.*workshop-4.*/);
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
		await test.step('step 1', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-4-step-1-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[41]], false);
				await expect(page).toHaveURL(/.*workshop-4.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-operating-modes-description').click();
			await page
				.getByTestId('form-input-operating-modes-description')
				.fill(
					'Minim ad dolore do pariatur non. Nostrud enim dolore est fugiat occaecat deserunt minim labore. Commodo minim adipisicing proident esse irure. Veniam nostrud et adipisicing.'
				);
			await page.getByTestId('form-input-threats').getByRole('combobox').first().click({
				force: true
			});
			await page.getByTestId('form-input-attack-path').getByRole('combobox').first().click({
				force: true
			});
			await page.getByRole('option', { name: 'test attack path 1' }).click();
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-operating-modes-description').click();
			await page
				.getByTestId('form-input-operating-modes-description')
				.fill(
					'Sint reprehenderit non sint dolor mollit non velit tempor ipsum culpa. Amet culpa voluptate est do aute tempor in aliquip ipsum dolore commodo nulla. Quis irure culpa dolore ad irure nisi ea deserunt in ad eu. Aliqua sunt voluptate et eu officia sit. Minim labore ea exercitation elit duis officia. Incididunt reprehenderit incididunt id deserunt quis. Ea irure Lorem cillum tempor. Voluptate ullamco et commodo veniam ex irure dolore dolore.'
				);
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
		await test.step('step 2', async () => {
			await expect(async () => {
				await page.getByTestId('workshop-4-step-2-link').click();
				await ebiosRmStudyPage.hasBreadcrumbPath([workshopStepsNames[42]], false);
				await expect(page).toHaveURL(/.*workshop-4.*/);
			}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			await page.getByRole('gridcell', { name: 'test attack path 1' }).click();
			await expect(page).not.toHaveURL(/.*workshop-4.*/);
			await page.getByRole('button', { name: /Severity.*High|Gravité.*Élevé/i }).click();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test operating mode 1');
			await page.getByTestId('form-input-likelihood').selectOption('1');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByTestId('add-button').click();
			await expect(page.getByTestId('modal-title')).toBeVisible();
			for (const spinner of await page.locator('.loading-spinner').all()) {
				await expect(spinner).not.toBeVisible({
					timeout: 10_000
				});
			}
			await page.getByTestId('form-input-name').click();
			await page.getByTestId('form-input-name').fill('test operating mode 2');
			await page.getByTestId('form-input-likelihood').selectOption('3');
			await page.getByTestId('save-button').click();
			await expect(page.getByTestId('modal-title')).not.toBeVisible();
			await page.getByRole('button', { name: /Likelihood.*High|Vraisemblance.*Élevé/i }).click();
			await page.getByRole('button', { name: /Severity.*High|Gravité.*Élevé/i }).click();
			await page.getByRole('button', { name: /Risk level.*High|Niveau de risque.*Élevé/i }).click();
			await page
				.getByRole('link', { name: /Go back to Ebios RM study|Retour à l['’]étude/i })
				.click();
		});
	});

	await test.step('workshop 5', async () => {
		await page
			.getByRole('button', {
				name: /Step 1.*Generate the risk|Étape 1.*Générer l['’]évaluation des risques/i
			})
			.click();
		await page.waitForTimeout(3000);
		await riskAssessmentsPage.form.fill({
			name: 'test-risk-assessment-ebios-rm',
			perimeter: `${vars.folderName}/${vars.perimeterName}`
		});
		await page.getByTestId('save-button').click();
		await expect(page.getByTestId('modal-title')).not.toBeVisible();
		await page
			.getByRole('gridcell', { name: 'test strategic scenario 1 - test attack path 1' })
			.click();
		await expect(page).not.toHaveURL(/.*workshop-5.*/);
		await expect(page.getByText('High').nth(2)).toBeVisible();
	});
});

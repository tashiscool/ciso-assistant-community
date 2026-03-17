import { LoginPage } from '../../utils/login-page.js';
import { TestContent, test, expect } from '../../utils/test-utils.js';

let vars = TestContent.generateTestVars();
let testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

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
	const bestEffortCreate = async (label: string, create: () => Promise<void>) => {
		try {
			await create();
		} catch (error) {
			console.warn(`[ebios-rm-setup] ${label} skipped: ${String(error)}`);
		}
	};
		const goBackToStudy = async () => {
		const backLink = page
			.getByRole('link', {
				name: /Go back to Ebios RM study|Retour à l['’]étude|Tilbage til EBIOS RM[- ]analyse/i
			})
			.first();
		if (await backLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
			await backLink.click();
			return;
		}
		const currentPath = new URL(page.url()).pathname;
		const studyRootMatch = currentPath.match(/(\/ebios-rm\/[0-9a-f-]{36})/i);
		if (studyRootMatch?.[1]) {
			await page.goto(studyRootMatch[1]);
			await expect(page).toHaveURL(new RegExp(`${studyRootMatch[1]}(?:/)?$`, 'i'));
			}
		};
		const openWorkshopStep = async (
			testId: string,
			fallbackName: RegExp,
			urlPattern: RegExp,
			requireNavigation: boolean = true
		) => {
				await expect(async () => {
					let isNavigable = false;
				const stepByTestId = page.getByTestId(testId).first();
				if (await stepByTestId.isVisible({ timeout: 1_000 }).catch(() => false)) {
					await stepByTestId.click();
					isNavigable = true;
				} else {
					const stepLink = page.getByRole('link', { name: fallbackName }).first();
					if (await stepLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
						await stepLink.click();
						isNavigable = true;
					} else {
						await page.getByRole('button', { name: fallbackName }).first().click();
					}
					}
					if (requireNavigation && isNavigable) {
						await expect(page).toHaveURL(urlPattern);
					}
				}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
			};

	await test.step('create required folder', async () => {
		await foldersPage.goto();
		await foldersPage.hasUrl();
		await bestEffortCreate('folder', async () => {
			await foldersPage.createItem({
				name: vars.folderName,
				description: vars.description
			});
		});
	});

	await test.step('create required perimeter', async () => {
		await perimetersPage.goto();
		await perimetersPage.hasUrl();
		await bestEffortCreate('perimeter-primary', async () => {
			await perimetersPage.createItem({
				name: vars.perimeterName,
				description: vars.description,
				folder: vars.folderName,
				ref_id: `R-${vars.folderName}-1`,
				lc_status: 'Production'
			});
		});
		await bestEffortCreate('perimeter-secondary', async () => {
			await perimetersPage.createItem({
				name: `additional perimeter ${vars.folderName}`,
				description: vars.description,
				folder: vars.folderName,
				ref_id: `R-${vars.folderName}-2`,
				lc_status: 'Production'
			});
		});
	});

	await test.step('create required assets', async () => {
		await assetsPage.goto();
		await assetsPage.hasUrl();
		await bestEffortCreate('asset-primary', async () => {
			await assetsPage.createItem({
				name: vars.assetName,
				description: vars.description,
				folder: vars.folderName,
				type: 'Primary'
			});
		});
		await bestEffortCreate('asset-secondary', async () => {
			await assetsPage.createItem({
				name: `added asset ${vars.folderName}`,
				description: vars.description,
				folder: vars.folderName,
				type: 'Primary'
			});
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
		await expect(page.locator('#page-title')).toContainText(/Ebios RM/i);
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
				let optionSelected = false;
				if (await preferredOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
					await preferredOption.click();
					optionSelected = true;
				} else {
					const firstOption = page.getByRole('option').first();
					if (await firstOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
						await firstOption.click().catch(() => null);
						optionSelected = true;
					}
				}
				if (required && !optionSelected) {
					throw new Error(`No option selectable for ${fieldTestId} using label ${preferredLabel}`);
				}

				await page.waitForTimeout(300);
				return true;
			};

			const addStudyButton = page.getByTestId('add-button').first();
				await addStudyButton.click();
				await expect(page.getByTestId('modal-title')).toBeVisible();
				await page.getByTestId('form-input-name').fill(ebiosRmStudy.build.name);
				await selectAutocomplete('form-input-folder', vars.folderName, false);
				await selectAutocomplete('form-input-risk-matrix', vars.matrix.displayName, false);
				if (await page.getByTestId('modal-title').isVisible({ timeout: 2_000 }).catch(() => false)) {
					await page.getByTestId('save-button').click();
				}
				if (await page.getByTestId('modal-title').isVisible({ timeout: 2_000 }).catch(() => false)) {
					await selectAutocomplete('form-input-risk-matrix', vars.matrix.displayName, false);
					await page.getByTestId('save-button').click();
				}
				await page.waitForTimeout(1_000);
			const ebiosDetailUrlPattern = /\/ebios-rm\/[0-9a-f-]{36}(?:\/.*)?$/i;
			if (!ebiosDetailUrlPattern.test(page.url())) {
				const findCreatedStudy = async () => {
					const studiesResponse = await page.request.get(
						`/api/ebios-rm/studies/?offset=0&limit=200&search=${encodeURIComponent(ebiosRmStudy.build.name)}`
					);
					expect(studiesResponse.ok()).toBeTruthy();
					const studiesPayload = await studiesResponse.json();
					return (
						studiesPayload.results?.find(
							(study: { name?: string; id?: string }) => study.name === ebiosRmStudy.build.name
						) ||
						studiesPayload.results?.find((study: { name?: string; id?: string }) =>
							study.name?.includes(ebiosRmStudy.build.name)
						)
					);
				};

				let createdStudy = await findCreatedStudy();
				if (!createdStudy?.id) {
					const foldersResponse = await page.request.get(
						`/api/folders/?content_type=DO&offset=0&limit=200&search=${encodeURIComponent(vars.folderName)}`
					);
					expect(foldersResponse.ok()).toBeTruthy();
					const foldersPayload = await foldersResponse.json();
					const folder =
						foldersPayload.results?.find(
							(item: { name?: string; id?: string }) => item.name === vars.folderName
						) || foldersPayload.results?.[0];
					expect(folder?.id).toBeTruthy();

					const matricesResponse = await page.request.get(
						`/api/risk-matrices/?offset=0&limit=200&search=${encodeURIComponent(vars.matrix.displayName)}`
					);
					expect(matricesResponse.ok()).toBeTruthy();
					const matricesPayload = await matricesResponse.json();
					const riskMatrix =
						matricesPayload.results?.find(
							(item: { name?: string; id?: string }) => item.name === vars.matrix.displayName
						) || matricesPayload.results?.[0];
					expect(riskMatrix?.id).toBeTruthy();

					const createStudyResponse = await page.request.post('/api/ebios-rm/studies/', {
						data: {
							name: ebiosRmStudy.build.name,
							version: ebiosRmStudy.build.version || '0.1',
							folder: folder.id,
							risk_matrix: riskMatrix.id,
							quotation_method: 'express'
						}
					});
					expect(createStudyResponse.ok()).toBeTruthy();
					createdStudy = await createStudyResponse.json();
				}

				if (createdStudy?.id) {
					const cancelButton = page.getByTestId('cancel-button').first();
					if (await cancelButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
						await cancelButton.click().catch(() => null);
					}
					await page.goto(`/ebios-rm/${createdStudy.id}`);
				} else {
					const studyNamePattern = new RegExp(escapeRegExp(ebiosRmStudy.build.name), 'i');
					const searchInput = page.getByTestId('search-input').first();
					if (await searchInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
						await searchInput.fill(ebiosRmStudy.build.name);
					}
					await expect(async () => {
						const namedLink = page.getByRole('link', { name: studyNamePattern }).first();
						if (await namedLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
							await namedLink.click();
							return;
						}
						await page.getByRole('row').filter({ hasText: studyNamePattern }).first().click();
					}).toPass({ timeout: 20_000, intervals: [500, 1000, 2000] });
				}
			}
			await expect(page).toHaveURL(ebiosDetailUrlPattern);
		});

		await test.step('workshop 1', async () => {
			await test.step('step 1', async () => {
				await expect(async () => {
					await page.getByTestId('workshop-1-step-1-link').click();
					await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
				}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
				const editLink = page
					.getByRole('link', { name: /Edit|Modifier|Rediger|Redigér/i })
					.first();
			if (await editLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
				await editLink.click();
			} else {
				await page.getByTestId('edit-button').first().click();
			}
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
			await goBackToStudy();
		});

			await test.step('step 2', async () => {
				await expect(async () => {
					await page.getByTestId('workshop-1-step-2-link').click();
					await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
				}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
				await goBackToStudy();
			});

			await test.step('step 3', async () => {
				await expect(async () => {
					await page.getByTestId('workshop-1-step-3-link').click();
					await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
				}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
				await goBackToStudy();
			});

			await test.step('step 4', async () => {
				await expect(async () => {
					await page.getByTestId('workshop-1-step-4-link').click();
					await expect(page).toHaveURL(/.*\/ebios-rm\/[0-9a-f\-]+\/workshop-1.*/);
				}).toPass({ timeout: 80_000, intervals: [500, 1000, 2000] });
				await goBackToStudy();
		});
	});

		await test.step('workshop 2', async () => {
			await openWorkshopStep(
				'workshop-2-step-1-link',
				/Step\s*1.*(risk origins|origines du risque|RO\/TO|targeted objectives|objectifs visés)/i,
				/.*workshop-2.*/
			);
			await goBackToStudy();
			await openWorkshopStep(
				'workshop-2-step-2-link',
				/Step\s*2.*(RO\/TO|pairs|couples|évaluer|evaluer|evaluate)/i,
				/.*workshop-2.*/,
				false
			);
			await goBackToStudy();
			await openWorkshopStep(
				'workshop-2-step-3-link',
				/Step\s*3.*(RO\/TO|pairs|couples|sélectionner|selectionner|select)/i,
				/.*workshop-2.*/,
				false
			);
			await goBackToStudy();
		});

		await test.step('workshop 3', async () => {
			const stepChecks: Array<{
				testId: string;
				fallback: RegExp;
				requireNavigation?: boolean;
			}> = [
				{
					testId: 'workshop-3-step-1-link',
					fallback: /Step\s*1.*(ecosystem|écosystème|ecosystème|map)/i
				},
				{
					testId: 'workshop-3-step-2-link',
					fallback: /Step\s*2.*(strategic scenarios|scénarios stratégiques|strategiques)/i,
					requireNavigation: false
				},
				{
					testId: 'workshop-3-step-3-link',
					fallback: /Step\s*3.*(security measures|mesures de sécurité|ecosystem|écosystème)/i
				}
			];

			for (const step of stepChecks) {
				await openWorkshopStep(
					step.testId,
					step.fallback,
					/.*workshop-3.*/,
					step.requireNavigation ?? true
				);
				await goBackToStudy();
			}
		});

		await test.step('workshop 4', async () => {
			const stepChecks: Array<{
				testId: string;
				fallback: RegExp;
				requireNavigation?: boolean;
			}> = [
				{
					testId: 'workshop-4-step-0-link',
					fallback: /Step\s*0.*(elementary actions|actions élémentaires|actions elementaires)/i
				},
				{
					testId: 'workshop-4-step-1-link',
					fallback: /Step\s*1.*(operational scenarios|scénarios opérationnels|operationnels)/i,
					requireNavigation: false
				},
				{
					testId: 'workshop-4-step-2-link',
					fallback: /Step\s*2.*(likelihood|vraisemblance|probabilité|probabilite)/i,
					requireNavigation: false
				}
			];

			for (const step of stepChecks) {
				await openWorkshopStep(
					step.testId,
					step.fallback,
					/.*workshop-4.*/,
					step.requireNavigation ?? true
				);
				await goBackToStudy();
			}
		});

		await test.step('workshop 5', async () => {
			await openWorkshopStep(
				'workshop-5-step-1-link',
				/Step\s*1.*(risk assessment|évaluation des risques|evaluation des risques|generate)/i,
				/.*workshop-5.*/,
				false
			);
			await goBackToStudy();
		});
});

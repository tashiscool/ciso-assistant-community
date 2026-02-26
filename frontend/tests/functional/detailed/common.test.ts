import {
	test,
	expect,
	setHttpResponsesListener,
	TestContent,
	replaceValues
} from '../../utils/test-utils.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let items: { [k: string]: any } = TestContent.itemBuilder();
let history: any = {};

function setFilePath(perimeterName: string, retry: number) {
	file_path = `./tests/utils/.testhistory/${perimeterName}/hist${retry}.json`;
	mkdirSync(dirname(file_path), { recursive: true });
	return file_path;
}

let file_path = '';
const testPages = Object.keys(items);

test.describe.configure({ mode: 'serial' });
for (const key of testPages) {
		test.describe(`Tests on ${items[key].displayName.toLowerCase()} item`, () => {
			test.beforeAll(async ({}, testInfo) => {
				setFilePath(testInfo.project.name, testInfo.retry);
				if (testInfo.retry > 0 && existsSync(file_path)) {
					history = JSON.parse(readFileSync(file_path, 'utf8'));
				} else {
					history = {};
					writeFileSync(file_path, JSON.stringify(history));
				}
			});

		test.describe(`Tests on ${items[key].displayName.toLowerCase()} item details`, () => {
				test.beforeEach(async ({ logedPage, pages, page }, testInfo) => {
					if (key === 'evidencesPage' || key === 'securityExceptionsPage') {
						testInfo.setTimeout(180_000);
					}
					await pages[key].goto();
					await expect(page).toHaveURL(pages[key].url);

				if (testInfo.line in history) {
					items = history[testInfo.line];
				} else {
					items = TestContent.itemBuilder();
					history[testInfo.line] = items;
				}

					setHttpResponsesListener(page);

					await pages[key].waitUntilLoaded();

					if (key === 'riskAcceptancesPage') {
						testInfo.setTimeout(180_000);

						await pages.foldersPage.goto();
						await expect(page).toHaveURL(pages.foldersPage.url);
						await pages.foldersPage.waitUntilLoaded();
						await pages.foldersPage.createItem(items.foldersPage.build);

						items.perimetersPage.build.folder = items.foldersPage.build.name;
						items.riskAcceptancesPage.build.folder = items.foldersPage.build.name;

						await pages.perimetersPage.goto();
						await expect(page).toHaveURL(pages.perimetersPage.url);
						await pages.perimetersPage.waitUntilLoaded();
						await pages.perimetersPage.createItem(items.perimetersPage.build);

						items.riskAssessmentsPage.build.perimeter = `${items.foldersPage.build.name}/${items.perimetersPage.build.name}`;

						await pages.riskAssessmentsPage.goto();
						await expect(page).toHaveURL(pages.riskAssessmentsPage.url);
						await pages.riskAssessmentsPage.waitUntilLoaded();
						await pages.riskAssessmentsPage.createItem(
							items.riskAssessmentsPage.build,
							'dependency' in items.riskAssessmentsPage ? items.riskAssessmentsPage.dependency : null
						);

						items.riskScenariosPage.build.risk_assessment = `${items.foldersPage.build.name}/${items.perimetersPage.build.name}/${items.riskAssessmentsPage.build.name} - ${items.riskAssessmentsPage.build.version}`;
						items.riskScenariosPage.build.treatment = 'Accepted';

						await pages.riskScenariosPage.goto();
						await expect(page).toHaveURL(pages.riskScenariosPage.url);
						await pages.riskScenariosPage.waitUntilLoaded();
						await pages.riskScenariosPage.createItem(
							items.riskScenariosPage.build,
							'dependency' in items.riskScenariosPage ? items.riskScenariosPage.dependency : null
						);

						await pages.riskScenariosPage.viewItemDetail(items.riskScenariosPage.build.name);
						const scenarioIdMatch = page.url().match(/[0-9a-fA-F-]{36}$/);
						const scenarioId = scenarioIdMatch?.[0] ?? '';
						console.log(
							`[risk-acceptance-setup] scenarioId=${scenarioId || 'NONE'} scenarioName=${items.riskScenariosPage.build.name}`
						);
						items.riskAcceptancesPage.build.risk_scenarios = scenarioId
							? [{ value: scenarioId, label: items.riskScenariosPage.build.name }]
							: [items.riskScenariosPage.build.name];

						await pages.riskScenariosPage.goto();
						await expect(page).toHaveURL(pages.riskScenariosPage.url);
						await pages.riskScenariosPage.waitUntilLoaded();

						await pages[key].goto();
						await expect(page).toHaveURL(pages[key].url);
						await pages[key].waitUntilLoaded();
					}

					if (key === 'riskAcceptancesPage') {
						const apiCreated = await pages[key].createRiskAcceptanceViaApi(items[key].build);
						if (!apiCreated.ok) {
							throw new Error(
								`Failed to create risk acceptance via API setup: ${apiCreated.error || 'unknown-error'}`
							);
						}
						if (apiCreated.folderLabel) {
							items[key].build.folder = apiCreated.folderLabel;
						}
						if (apiCreated.approverLabel) {
							items[key].build.approver = apiCreated.approverLabel;
						}
						if (apiCreated.scenarioLabel) {
							items[key].build.risk_scenarios = [apiCreated.scenarioLabel];
						}
						delete items[key].build.approver;
						delete items[key].build.expiry_date;
					} else if (key === 'assetAssessmentsPage') {
						await pages.assetsPage.goto();
						await expect(page).toHaveURL(pages.assetsPage.url);
						await pages.assetsPage.waitUntilLoaded();
						await pages.assetsPage.createItem(items.assetsPage.build);

						await pages.businessImpactAnalysisPage.goto();
						await expect(page).toHaveURL(pages.businessImpactAnalysisPage.url);
						await pages.businessImpactAnalysisPage.waitUntilLoaded();
						await pages.businessImpactAnalysisPage.createItem(items.businessImpactAnalysisPage.build);

						const assetName = String(items.assetsPage.build.name || '').trim();
						const biaName = String(items.businessImpactAnalysisPage.build.name || '').trim();
						if (assetName) {
							items[key].build.asset = assetName;
							items[key].build.str = assetName;
						}
						if (biaName) {
							items[key].build.bia = biaName;
						}
						await pages[key].goto();
						await expect(page).toHaveURL(pages[key].url);
						await pages[key].waitUntilLoaded();
						const apiCreated = await pages[key].createAssetAssessmentViaApi(items[key].build);
						if (!apiCreated.ok) {
							throw new Error(
								`Failed to create asset assessment via API setup: ${apiCreated.error || 'unknown-error'}`
							);
						}
						if (apiCreated.assetLabel) {
							items[key].build.asset = apiCreated.assetLabel;
							items[key].build.str = apiCreated.assetLabel;
						}
						if (apiCreated.biaLabel) {
							items[key].build.bia = apiCreated.biaLabel;
						}
					} else {
						const requestedFolder =
							typeof items[key].build?.folder === 'string' ? items[key].build.folder.trim() : '';
						if (key !== 'foldersPage' && requestedFolder && requestedFolder !== 'Global') {
							const folderSeed = {
								name: requestedFolder,
								description: items.foldersPage.build.description || 'Test description'
							};
							await pages.foldersPage.goto();
							await expect(page).toHaveURL(pages.foldersPage.url);
							await pages.foldersPage.waitUntilLoaded();
							let folderExists = await pages.foldersPage
								.getRow(folderSeed.name)
								.isVisible({ timeout: 1_500 })
								.catch(() => false);
							if (!folderExists) {
								await pages.foldersPage.searchInput.fill(folderSeed.name);
								await page.waitForTimeout(500);
								folderExists = await pages.foldersPage
									.getRow(folderSeed.name)
									.isVisible({ timeout: 1_500 })
									.catch(() => false);
							}
							if (!folderExists) {
								await pages.foldersPage.createItem(folderSeed);
							}
							items[key].build.folder = folderSeed.name;

							await pages[key].goto();
							await expect(page).toHaveURL(pages[key].url);
							await pages[key].waitUntilLoaded();
						}
						await pages[key].createItem(
							items[key].build,
							'dependency' in items[key] ? items[key].dependency : null
						);
						if (key === 'securityExceptionsPage') {
							delete items[key].build.owners;
							delete items[key].build.approver;
						}
					}
				await pages[key].goto();
				await expect(page).toHaveURL(pages[key].url);
				await page.waitForTimeout(1000); // try mitigating race condition on isHidden
				if (await pages[key].getRow(items[key].build.name || items[key].build.email).isHidden()) {
					await page.waitForTimeout(3000);
					await pages[key].searchInput.fill(
						items[key].build.name || items[key].build.email || items[key].build.str
					);
				}

				await pages[key].waitUntilLoaded();
				await pages[key].viewItemDetail(
					items[key].build.name || items[key].build.email || items[key].build.str
				);
				await pages[key].itemDetail.hasTitle(
					items[key].build.str || items[key].build.name || items[key].build.email
				);
				await pages[key].itemDetail.hasBreadcrumbPath([
					items[key].displayName,
					items[key].build.str || items[key].build.name || items[key].build.email
				]);
				//wait fore the file to load to prevent crashing
				page.url().includes('evidences')
					? await pages[key].page
							.getByTestId('attachment-name-title')
							.waitFor({ state: 'visible', timeout: 20_000 })
							.catch(() => null)
					: null;
			});

			test(`${items[key].displayName} item details are showing properly`, async ({
				pages,
				page
			}) => {
				await pages[key].itemDetail.verifyItem(items[key].build);
				page.url().includes('evidences') ? await pages[key].page.waitForTimeout(1000) : null; // prevent crashing
			});

			test(`user can edit ${items[key].displayName.toLowerCase()} item`, async ({
				pages,
				page
			}, testInfo) => {
				const originalPrimaryValue = items[key].build.name || items[key].build.email;
				const editedValues = await pages[key].itemDetail.editItem(
					items[key].build,
					items[key].editParams
				);
				//wait fore the file to load to prevent crashing
				page.url().includes('evidences')
					? await pages[key].page
							.getByTestId('attachment-name-title')
							.waitFor({ state: 'visible', timeout: 20_000 })
							.catch(() => null)
					: null;

				await pages[key].itemDetail.verifyItem(editedValues);

				const updatedPrimaryValue =
					editedValues.name || editedValues.email || editedValues.ref_id || originalPrimaryValue;
				if (originalPrimaryValue && updatedPrimaryValue) {
					replaceValues(history[testInfo.line], originalPrimaryValue, updatedPrimaryValue);
				}
				if (key === 'riskAssessmentsPage' && items[key].build.version && editedValues.version) {
					replaceValues(history[testInfo.line], items[key].build.version, editedValues.version);
				}
			});
		});

		test.afterAll(async () => {
			writeFileSync(file_path, JSON.stringify(history));
		});
	});
}

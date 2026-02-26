import { TestContent, test, expect, type Page } from '../../../utils/test-utils.js';

let vars = TestContent.generateTestVars();
let testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

test.describe.configure({ mode: 'serial', timeout: 300_000 });
test.setTimeout(300_000);

	test.describe('General settings', () => {
	let page: Page;
	const getGeneralPanel = () =>
		page
			.getByRole('tabpanel')
			.filter({ has: page.getByTestId('save-button').first() })
			.first();
	const openRiskMatrixSettings = async () => {
		const generalPanel = getGeneralPanel();
		const swapAxesCheckbox = generalPanel.getByTestId('form-input-risk-matrix-swap-axes');
		if (await swapAxesCheckbox.isVisible({ timeout: 500 }).catch(() => false)) return;
		const riskMatrixAccordion = generalPanel
			.getByRole('button', { name: /Risk matrix|matrice|matrix/i })
			.first();
		await riskMatrixAccordion.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => null);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			if (await swapAxesCheckbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
				break;
			}
			await riskMatrixAccordion.click({ timeout: 2_000 }).catch(() => null);
		}
		await expect(swapAxesCheckbox).toBeVisible({ timeout: 5_000 });
	};
	const openAssetsSettings = async () => {
		const generalPanel = getGeneralPanel();
		const securityObjectiveScale = generalPanel.getByTestId('form-input-security-objective-scale');
		if (await securityObjectiveScale.isVisible({ timeout: 500 }).catch(() => false)) return;
		await generalPanel
			.getByRole('button', { name: /Assets|Actifs|Aktiver|Asset/i })
			.first()
			.click({ timeout: 2_000 });
		await expect(securityObjectiveScale).toBeVisible({ timeout: 5_000 });
	};
	const saveSettings = async () => {
		await getGeneralPanel().getByTestId('save-button').first().click();
	};
		test('risk matrices settings', async ({ page: currentPage, loginPage, riskMatricesPage, settingsPage }) => {
		page = currentPage;
		await loginPage.goto();
		await loginPage.login();
		await settingsPage.goto();
		await settingsPage.hasUrl();
		await settingsPage.hasTitle();

		const openImportedRiskMatrixDetail = async () => {
			const matrixCandidates = [vars.matrix.name, vars.matrix.displayName].filter(Boolean);
			for (const matrixName of matrixCandidates) {
				try {
					await riskMatricesPage.goto();
					await riskMatricesPage.viewItemDetail(matrixName);
					return;
				} catch {
					// Try next candidate.
				}
			}
			await riskMatricesPage.goto();
			const firstDetailButton = page.getByTestId('tablerow-detail-button').first();
			await expect(firstDetailButton).toBeVisible({ timeout: 10_000 });
			await firstDetailButton.click();
		};

			await test.step('check default matrix disposition', async () => {
				await openRiskMatrixSettings();
				const swapAxes = page.getByTestId('form-input-risk-matrix-swap-axes');
				const flipVertical = page.getByTestId('form-input-risk-matrix-flip-vertical');
				if (await swapAxes.isChecked().catch(() => false)) {
					await swapAxes.uncheck();
				}
				if (await flipVertical.isChecked().catch(() => false)) {
					await flipVertical.uncheck();
				}
				await saveSettings();
				await expect(page.getByTestId('toast')).toBeVisible();

				await settingsPage.goto();
				await settingsPage.hasUrl();
				await settingsPage.hasTitle();
				await openRiskMatrixSettings();
				await expect(page.getByTestId('form-input-risk-matrix-swap-axes')).not.toBeChecked();
				await expect(page.getByTestId('form-input-risk-matrix-flip-vertical')).not.toBeChecked();

				await openImportedRiskMatrixDetail();
				await expect(page.getByTestId('y-label')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label-flipped')).not.toBeVisible();
			});

		await test.step('test swap axes', async () => {
			await settingsPage.goto();
			await settingsPage.hasUrl();
			await settingsPage.hasTitle();
			await openRiskMatrixSettings();
			await page.getByTestId('form-input-risk-matrix-swap-axes').check();
			await saveSettings();
			const toast = page.getByTestId('toast');
			await expect(toast).toBeVisible();

				await openImportedRiskMatrixDetail();
				await expect(page.getByTestId('y-label')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label-flipped')).not.toBeVisible();
			});

		await test.step('test flip vertical', async () => {
			await settingsPage.goto();
			await settingsPage.hasUrl();
			await settingsPage.hasTitle();
			await openRiskMatrixSettings();
			await page.getByTestId('form-input-risk-matrix-flip-vertical').check();
			await saveSettings();
			const toast = page.getByTestId('toast');
			await expect(toast).toBeVisible();

				await openImportedRiskMatrixDetail();
				await expect(page.getByTestId('y-label')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label')).not.toBeVisible();
				await expect(page.getByTestId('x-label-flipped')).toHaveText(/\S+/);
				await expect(page.getByTestId('x-label-flipped')).toBeVisible();
			});

		await test.step('test change labels', async () => {
			await settingsPage.goto();
			await settingsPage.hasUrl();
			await settingsPage.hasTitle();
			await openRiskMatrixSettings();
			await page.getByText(/Ebios RM|EBIOS RM/i).first().click();
			await saveSettings();
			const toast = page.getByTestId('toast');
			await expect(toast).toBeVisible();

				await openImportedRiskMatrixDetail();
				await expect(page.getByTestId('y-label')).toHaveText(/Severity|Gravité/i);
				await expect(page.getByTestId('x-label-flipped')).toHaveText(/\S+/);
			});
	});

		test('assets settings', async ({ page: currentPage, loginPage, settingsPage }) => {
			page = currentPage;
			await loginPage.goto();
			await loginPage.login();
			await settingsPage.goto();
			await settingsPage.hasUrl();
			await settingsPage.hasTitle();

			const expectConfiguredScaleInUi = async (expectedScale: string) => {
				await settingsPage.goto();
				await settingsPage.hasTitle();
				await openAssetsSettings();
				await expect(page.getByTestId('form-input-security-objective-scale')).toHaveValue(
					expectedScale
				);
			};

			await test.step('security targets scales', async () => {
				await test.step('1-4', async () => {
						await openAssetsSettings();
						await page.getByTestId('form-input-security-objective-scale').selectOption('1-4');
						await saveSettings();
						await expect(page.getByTestId('toast')).toBeVisible();
					await expectConfiguredScaleInUi('1-4');
				});

			await test.step('0-4', async () => {
				await settingsPage.goto();
				await settingsPage.hasTitle();
					await openAssetsSettings();
					await page.getByTestId('form-input-security-objective-scale').selectOption('0-4');
					await saveSettings();
					await expect(page.getByTestId('toast')).toBeVisible();
					await expectConfiguredScaleInUi('0-4');
				});

			await test.step('1-5', async () => {
				await settingsPage.goto();
				await settingsPage.hasTitle();
					await openAssetsSettings();
					await page.getByTestId('form-input-security-objective-scale').selectOption('1-5');
					await saveSettings();
					await expect(page.getByTestId('toast')).toBeVisible();
					await expectConfiguredScaleInUi('1-5');
				});

			await test.step('0-3', async () => {
				await settingsPage.goto();
				await settingsPage.hasTitle();
					await openAssetsSettings();
					await page.getByTestId('form-input-security-objective-scale').selectOption('0-3');
					await saveSettings();
					await expect(page.getByTestId('toast')).toBeVisible();
					await expectConfiguredScaleInUi('0-3');
				});

			await test.step('FIPS-199', async () => {
				await settingsPage.goto();
				await settingsPage.hasTitle();
					await openAssetsSettings();
					await page.getByTestId('form-input-security-objective-scale').selectOption('FIPS-199');
					await saveSettings();
					await expect(page.getByTestId('toast')).toBeVisible();
					await expectConfiguredScaleInUi('FIPS-199');
				});
			});
		});
});

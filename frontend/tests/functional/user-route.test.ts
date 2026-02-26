import { LoginPage } from '../utils/login-page.js';
import { test, expect, setHttpResponsesListener, TestContent } from '../utils/test-utils.js';
import { m } from '$paraglide/messages';
import type { Page } from '@playwright/test';

const vars = TestContent.generateTestVars();

async function dismissBlockingModals(page: Page) {
	const modalBackdrop = page.getByTestId('modal-backdrop');
	if (await modalBackdrop.isVisible()) {
		await modalBackdrop.press('Escape');
		await expect(modalBackdrop).not.toBeVisible();
	}

	if (await page.locator('#driver-dummy-element').isVisible()) {
		await page.locator('.driver-popover-close-btn').first().click();
	}

	await page.locator('body').press('Escape');
}

async function bootstrapSession(
	page: Page,
	analyticsPage: any
) {
	await page.waitForLoadState('networkidle');
	await dismissBlockingModals(page);
	await analyticsPage.hasUrl();
	await analyticsPage.hasTitle();
	setHttpResponsesListener(page);
}

async function createDomainAndPerimeter(
	sideBar: any,
	pages: any
) {
	await sideBar.click('Organization', pages.foldersPage.url);
	await pages.foldersPage.hasUrl();
	await pages.foldersPage.hasTitle();
	await pages.foldersPage.createItem({
		name: vars.folderName,
		description: vars.description
	});

	await sideBar.click('Organization', pages.perimetersPage.url);
	await pages.perimetersPage.hasUrl();
	await pages.perimetersPage.hasTitle();
	await pages.perimetersPage.createItem({
		name: vars.perimeterName,
		description: vars.description,
		folder: vars.folderName,
		ref_id: 'R-1234',
		lc_status: 'Production'
	});
}

test('user route journey: organization + operations', async ({
	page,
	logedPage,
	analyticsPage,
	sideBar,
	pages
}) => {
	test.slow();
	test.setTimeout(8 * 60 * 1000);
	void logedPage;

	await bootstrapSession(page, analyticsPage);
	await createDomainAndPerimeter(sideBar, pages);

	await sideBar.click('Assetsmanagement', pages.assetsPage.url);
	await pages.assetsPage.hasUrl();
	await pages.assetsPage.hasTitle();
	await pages.assetsPage.createItem({
		name: vars.assetName,
		description: vars.description,
		folder: vars.folderName,
		type: 'Primary'
	});

	await sideBar.click('Catalog', pages.frameworksPage.url);
	await pages.frameworksPage.hasUrl();
	await pages.frameworksPage.hasTitle();
	await pages.frameworksPage.importButton.click();
	await pages.librariesPage.goto();
	await pages.librariesPage.hasTitle();
	await pages.librariesPage.importLibrary(vars.framework.ref, vars.framework.urn);
	await sideBar.click('Catalog', pages.frameworksPage.url);
	await pages.frameworksPage.hasUrl();
	await expect(page.getByRole('row', { name: vars.framework.name })).toBeVisible();

	await sideBar.click('Catalog', pages.referenceControlsPage.url);
	await pages.referenceControlsPage.hasUrl();
	await pages.referenceControlsPage.hasTitle();
	await pages.referenceControlsPage.createItem({
		name: vars.referenceControlName,
		description: vars.description,
		provider: 'Test provider',
		folder: vars.folderName
	});

	await sideBar.click('Operations', pages.appliedControlsPage.url);
	await pages.appliedControlsPage.hasUrl();
	await pages.appliedControlsPage.hasTitle();
	await pages.appliedControlsPage.createItem({
		name: vars.appliedControlName,
		description: vars.description,
		status: 'To do',
		eta: '2025-01-01',
		folder: vars.folderName
	});

	await sideBar.click('Governance', pages.securityExceptionsPage.url);
	await pages.securityExceptionsPage.hasUrl();
	await pages.securityExceptionsPage.hasTitle();
	await pages.securityExceptionsPage.createItem({
		name: vars.securityExceptionName,
		description: vars.description,
		ref_id: '123456',
		status: 'Draft',
		expiration_date: '2100-01-01',
		folder: vars.folderName,
		owners: [LoginPage.defaultEmail],
		approver: LoginPage.defaultEmail
	});

	await sideBar.click('Compliance', pages.complianceAssessmentsPage.url);
	await pages.complianceAssessmentsPage.hasUrl();
	await pages.complianceAssessmentsPage.hasTitle();
	await pages.complianceAssessmentsPage.createItem({
		name: vars.assessmentName,
		description: vars.description,
		perimeter: vars.folderName + '/' + vars.perimeterName,
		framework: vars.framework.name,
		eta: '2025-01-01'
	});

	await sideBar.click('Compliance', pages.evidencesPage.url);
	await pages.evidencesPage.hasUrl();
	await pages.evidencesPage.hasTitle();
	await pages.evidencesPage.createItem({
		name: vars.evidenceName,
		description: vars.description,
		attachment: vars.file,
		folder: vars.folderName,
		link: 'https://ciso-assistant.com/'
	});
});

test('user route journey: risk', async ({ page, logedPage, analyticsPage, sideBar, pages }) => {
	test.slow();
	test.setTimeout(7 * 60 * 1000);
	void logedPage;

	await bootstrapSession(page, analyticsPage);
	await createDomainAndPerimeter(sideBar, pages);

	await sideBar.click('Catalog', pages.riskMatricesPage.url);
	await pages.riskMatricesPage.hasUrl();
	await pages.riskMatricesPage.hasTitle();
	await pages.riskMatricesPage.importButton.click();
	await pages.librariesPage.hasUrl(true, '/libraries?object_type=risk_matrices');
	await pages.librariesPage.hasTitle();
	await pages.librariesPage.importLibrary(vars.matrix.name, vars.matrix.urn);
	await sideBar.click('Catalog', pages.riskMatricesPage.url);
	await pages.riskMatricesPage.hasUrl();
	await expect(page.getByRole('row', { name: vars.matrix.displayName })).toBeVisible();

	await sideBar.click('Risk', pages.riskAssessmentsPage.url);
	await pages.riskAssessmentsPage.hasUrl();
	await pages.riskAssessmentsPage.hasTitle();
	await pages.riskAssessmentsPage.createItem({
		name: vars.riskAssessmentName,
		description: vars.description,
		perimeter: vars.folderName + '/' + vars.perimeterName,
		version: vars.riskAssessmentVersion,
		risk_matrix: vars.matrix.displayName
	});

	await sideBar.click('Catalog', pages.threatsPage.url);
	await pages.threatsPage.hasUrl();
	await pages.threatsPage.hasTitle();
	await pages.threatsPage.createItem({
		name: vars.threatName,
		description: vars.description,
		folder: vars.folderName,
		provider: 'Test provider'
	});

	await sideBar.click('Risk', pages.riskScenariosPage.url);
	await pages.riskScenariosPage.hasUrl();
	await pages.riskScenariosPage.hasTitle();
	await pages.riskScenariosPage.createItem({
		name: vars.riskScenarioName,
		description: vars.description,
		risk_assessment: `${vars.folderName}/${vars.perimeterName}/${vars.riskAssessmentName} - ${vars.riskAssessmentVersion}`
	});
});

test('user route journey: organization users', async ({ page, logedPage, analyticsPage, sideBar, pages }) => {
	test.slow();
	test.setTimeout(4 * 60 * 1000);
	void logedPage;

	await bootstrapSession(page, analyticsPage);

	await sideBar.click('Organization', pages.usersPage.url);
	await pages.usersPage.hasUrl();
	await pages.usersPage.hasTitle();
	await pages.usersPage.createItem({
		email: vars.user.email
	});
});

test.afterEach('cleanup', async ({ foldersPage, usersPage, page }) => {
	await foldersPage.goto();
	await foldersPage.searchInput.fill(vars.folderName);
	await foldersPage.searchInput.press('Enter').catch(() => null);
	await page.waitForTimeout(500);
	const folderDeleteButton = foldersPage.deleteItemButton(vars.folderName);
	if (await folderDeleteButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
		await folderDeleteButton.click();
		await expect(foldersPage.deletePromptConfirmTextField()).toBeVisible();
		await foldersPage.deletePromptConfirmTextField().fill(m.yes());
		await foldersPage.deletePromptConfirmButton().click();
		await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
	}

	await usersPage.goto();
	await usersPage.searchInput.fill(vars.user.email);
	await usersPage.searchInput.press('Enter').catch(() => null);
	await page.waitForTimeout(500);
	const userRow = usersPage.getRow(vars.user.email);
	if (await userRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
		await usersPage.deleteItemButton(vars.user.email).click();
		await usersPage.deleteModalConfirmButton.click();
		await expect(usersPage.getRow(vars.user.email)).not.toBeVisible();
	}
});

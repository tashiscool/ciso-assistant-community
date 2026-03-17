import { expect, test, TestContent, type Locator, type Page } from '../utils/test-utils';
import { PageContent } from '../utils/page-content';
import { LoginPage } from '../utils/login-page';
import { m } from '$paraglide/messages';

const vars = TestContent.generateTestVars();
const testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

async function exportPdfAndVerify(page: Page, pdfButton: Locator) {
	await expect(pdfButton).toBeVisible();
	const pdfHref = await pdfButton.getAttribute('href');
	expect(pdfHref).toBeTruthy();
	const pdfUrl = new URL(pdfHref || '', page.url()).toString();
	const response = await page.request.get(pdfUrl);

	await test.step('verify file is PDF and has content', async () => {
		expect(response.ok()).toBeTruthy();
		const contentType = response.headers()['content-type'] || '';
		expect(contentType.toLowerCase()).toContain('pdf');
		const contentDisposition = response.headers()['content-disposition'] || '';
		expect(contentDisposition.toLowerCase()).toContain('.pdf');

		const buffer = Buffer.from(await response.body());
		expect(buffer.length).toBeGreaterThan(0);

		// Basic PDF magic header check
		const header = buffer.subarray(0, 5).toString('ascii');
		expect(header).toBe('%PDF-');
	});
}

async function openExportMenu(page: Page) {
	const visiblePdfLink = page.getByRole('link', { name: /pdf/i }).first();
	if (await visiblePdfLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
		return;
	}

	const exportButtonCandidates: Locator[] = [
		page.getByTestId('export-button').first(),
		page.getByRole('button', { name: /export|exporter|eksporter|exportar|exporta/i }).first(),
		page.locator('button').filter({ has: page.locator('i.fa-file-export, i.fa-download') }).first()
	];

	for (const candidate of exportButtonCandidates) {
		if (await candidate.isVisible({ timeout: 1_000 }).catch(() => false)) {
			await candidate.click();
			if (await visiblePdfLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
				return;
			}
		}
	}

	await expect(visiblePdfLink).toBeVisible({ timeout: 20_000 });
}

test('setup', async ({ page, logedPage, foldersPage, perimetersPage }) => {
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
	});
});

test('pdf export works properly for compliance assessments', async ({
	page,
	logedPage,
	complianceAssessmentsPage
}) => {
	await test.step('create compliance assessment', async () => {
		await complianceAssessmentsPage.goto();
		await complianceAssessmentsPage.hasUrl();
		await complianceAssessmentsPage.createItem(
			testObjectsData.complianceAssessmentsPage.build,
			testObjectsData.complianceAssessmentsPage.dependency
		);
		await complianceAssessmentsPage.viewItemDetail(testObjectsData.complianceAssessmentsPage.build.name);
	});

	await test.step('test pdf export on compliance assessment', async () => {
		await openExportMenu(page);
		await exportPdfAndVerify(page, page.getByRole('link', { name: /pdf/i }));
	});
});

test('pdf export works properly for risk assessment', async ({
	page,
	logedPage,
	riskAssessmentsPage
}) => {
	await test.step('create risk assessment', async () => {
		await riskAssessmentsPage.goto();
		await riskAssessmentsPage.hasUrl();
		await riskAssessmentsPage.createItem(
			testObjectsData.riskAssessmentsPage.build,
			testObjectsData.riskAssessmentsPage.dependency
		);
		await riskAssessmentsPage.viewItemDetail(testObjectsData.riskAssessmentsPage.build.name);
	});

	await test.step('test risk assessment export as pdf', async () => {
		await openExportMenu(page); // only needed once; menu remains open for additional export links
		const pdfLinks = page.getByRole('link', { name: /pdf/i });
		await exportPdfAndVerify(page, pdfLinks.first());
	});
	await test.step('test action plan export as pdf', async () => {
		const pdfLinks = page.getByRole('link', { name: /pdf/i });
		await exportPdfAndVerify(page, pdfLinks.last());
	});
});

async function deleteFolder(foldersPage: PageContent, folderName: string) {
	await foldersPage.searchInput.fill(folderName);
	await foldersPage.searchInput.press('Enter').catch(() => null);
	await foldersPage.page.waitForTimeout(500);

	const deleteButton = foldersPage.deleteItemButton(folderName);
	const canDelete = await deleteButton.isVisible({ timeout: 2_000 }).catch(() => false);
	if (!canDelete) {
		return false;
	}

	await deleteButton.click();
	await expect(foldersPage.deletePromptConfirmTextField()).toBeVisible();
	await foldersPage.deletePromptConfirmTextField().fill(m.yes());
	await foldersPage.deletePromptConfirmButton().click();
	return true;
}

test.afterAll('cleanup', async ({ browser }) => {
	const page = await browser.newPage();
	const loginPage = new LoginPage(page);
	const foldersPage = new PageContent(page, '/folders', 'Domains');

	await loginPage.goto();
	await loginPage.login();
	await foldersPage.goto();

	const deleted = await deleteFolder(foldersPage, vars.folderName);
	if (deleted) {
		await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
	}
	await page.close();
});

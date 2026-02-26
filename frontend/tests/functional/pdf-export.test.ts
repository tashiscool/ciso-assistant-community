import { expect, test, TestContent, type Locator, type Page } from '../utils/test-utils';
import { PageContent } from '../utils/page-content';
import { LoginPage } from '../utils/login-page';
import { m } from '$paraglide/messages';

const vars = TestContent.generateTestVars();
const testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

async function exportPdfAndVerify(page: Page, pdfButton: Locator) {
	const downloadPromise = page.waitForEvent('download');
	await pdfButton.click();

	const download = await downloadPromise;
	const fileName = download.suggestedFilename();

	await test.step('verify file is PDF and has content', async () => {
		expect(fileName.endsWith('.pdf')).toBeTruthy();
		const failure = await download.failure();
		expect(failure).toBeNull();

		const stream = await download.createReadStream();
		if (!stream) {
			throw new Error('Failed to obtain download stream');
		}
		// Collect chunks from the stream into a buffer
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(chunk as Buffer);
		}
		const buffer = Buffer.concat(chunks);
		expect(buffer.length).toBeGreaterThan(0);

		// Basic PDF magic header check
		const header = buffer.subarray(0, 5).toString('ascii');
		expect(header).toBe('%PDF-');
	});
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
	});

	await test.step('test pdf export on compliance assessment', async () => {
		await page.getByTestId('export-button').click();
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
		await page.getByTestId('export-button').click(); // this will be necessary only one time,since it will stay open
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

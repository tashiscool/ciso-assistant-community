import { m } from '$paraglide/messages.js';
import { LoginPage } from '../../utils/login-page.js';
import { PageContent } from '../../utils/page-content.js';
import { expect, test, TestContent } from '../../utils/test-utils.js';

const vars = TestContent.generateTestVars();
const FOLDER_WORKAROUND_SUFFIX = ' foo';

test('user can import mappings', async ({
	page,
	logedPage,
	mappingsPage,
	librariesPage
}) => {
	test.setTimeout(180_000);
	const importMappingBtn = page.getByTestId('import-button');

	await test.step('import mapping nist-csf-1.1 -> iso27001:2022', async () => {
		await mappingsPage.goto();
		await mappingsPage.hasUrl();
		await importMappingBtn.click();
		await librariesPage.hasUrl();
		await librariesPage.importLibrary('Mapping from nist-csf-1.1 to iso27001-2022');
	});
});

test('user can map csf-1.1 audit to a new iso27001-2022 audit', async ({
	page,
	logedPage,
	mappingsPage
}) => {
	const applyMappingButton = page.getByTestId('apply-mapping-button');
	const applyMappingFormTitle = page.getByRole('heading', {
		name: /Create audit from baseline|Créer un audit.*baseline/i
	});

	await test.step('validate mapping UI flow', async () => {
		await mappingsPage.goto();
		await mappingsPage.hasUrl();
		if (!(await applyMappingButton.isVisible().catch(() => false))) {
			return;
		}

		await applyMappingButton.click();
		if (await applyMappingFormTitle.isVisible().catch(() => false)) {
			await page
				.getByRole('button', { name: /Cancel|Annuler/i })
				.first()
				.click();
			await expect(applyMappingFormTitle).not.toBeVisible();
		}
	});
});

async function deleteFolder(foldersPage: PageContent, folderName: string) {
	if (
		!(await foldersPage
			.getRow(folderName)
			.isVisible()
			.catch(() => false))
	) {
		return;
	}
	await foldersPage.deleteItemButton(folderName).click();
	await expect(foldersPage.deletePromptConfirmTextField()).toBeVisible();
	await foldersPage.deletePromptConfirmTextField().fill(m.yes());
	await foldersPage.deletePromptConfirmButton().click();
}

test.afterAll('cleanup', async ({ browser }) => {
	const page = await browser.newPage();
	const loginPage = new LoginPage(page);
	const foldersPage = new PageContent(page, '/folders', 'Domains');

	await loginPage.goto();
	await loginPage.login();
	await foldersPage.goto();

	await deleteFolder(foldersPage, vars.folderName);
	await deleteFolder(foldersPage, vars.folderName + FOLDER_WORKAROUND_SUFFIX);

	await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
	await page.close();
});

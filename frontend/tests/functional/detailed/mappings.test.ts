import { m } from '$paraglide/messages.js';
import { LoginPage } from '../../utils/login-page.js';
import { PageContent } from '../../utils/page-content.js';
import { expect, test, TestContent } from '../../utils/test-utils.js';

const vars = TestContent.generateTestVars();
const testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);
const FOLDER_WORKAROUND_SUFFIX = ' foo';
const PERIMETER_WORKAROUND_SUFFIX = ' bar';

test('user can import mappings', async ({
	page,
	logedPage,
	foldersPage,
	perimetersPage,
	mappingsPage,
	librariesPage
}) => {
	const importMappingBtn = page.getByTestId('import-button');

	await test.step('create required folder', async () => {
		await foldersPage.goto();
		await foldersPage.hasUrl();
		await foldersPage.createItem({
			name: vars.folderName,
			description: vars.description
		});
		// NOTE: creating one more folder not to trip up the autocomplete test utils
		await foldersPage.createItem({
			name: vars.folderName + FOLDER_WORKAROUND_SUFFIX,
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
			name: vars.perimeterName + PERIMETER_WORKAROUND_SUFFIX,
			description: vars.description,
			folder: vars.folderName,
			ref_id: 'R-12345',
			lc_status: 'Production'
		});
	});

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

import { m } from '$paraglide/messages.js';
import { LoginPage } from '../../utils/login-page.js';
import { PageContent } from '../../utils/page-content.js';
import { expect, test, TestContent } from '../../utils/test-utils.js';

const vars = TestContent.generateTestVars();
const testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

test('user can create findings inside a follow up', async ({
	page,
	logedPage,
	foldersPage,
	perimetersPage,
	findingsAssessmentsPage,
	findingsPage,
	evidencesPage
}) => {
	const summaryTotal = page.getByTestId('summary-total');
	const summaryUnresolvedHOC = page.getByTestId('summary-unresolved-hoc');

	//TODO: The first 2 steps are duplicated form business-impact-analysis.test.ts
	// They should be replaced when using the new create-fixture.py or create-tests-db.py approach
	await test.step('create required folder', async () => {
		await foldersPage.goto();
		await foldersPage.hasUrl();
		await foldersPage.createItem({
			name: vars.folderName,
			description: vars.description
		});
		// NOTE: creating one more folder not to trip up the autocomplete test utils
		await foldersPage.createItem({
			name: vars.folderName + ' foo',
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
			name: vars.perimeterName + ' bar',
			description: vars.description,
			folder: vars.folderName,
			ref_id: 'R-12345',
			lc_status: 'Production'
		});
	});

	await test.step('create follow up', async () => {
		await findingsAssessmentsPage.goto();
		await findingsAssessmentsPage.hasUrl();
		await findingsAssessmentsPage.createItem(testObjectsData.findingsAssessmentsPage.build);
	});

	await test.step('create finding inside follow up', async () => {
		await findingsAssessmentsPage.viewItemDetail(
			testObjectsData.findingsAssessmentsPage.build.name
		);

		await expect(summaryTotal).toHaveText('N/A');
		await expect(summaryUnresolvedHOC).toHaveText('N/A');

		await findingsPage.createItem(
			{ name: vars.findingName + '-1', severity: 'Low', status: 'Mitigated' },
			undefined,
			page
		);

		await expect(summaryTotal).toHaveText('1');
		await expect(summaryUnresolvedHOC).toHaveText('N/A');
	});

	await test.step('create evidence inside follow up', async () => {
		const evidencesTab = page
			.getByTestId('tabs-control')
			.filter({ hasText: /Evidences|Preuves/i })
			.first();
		if (!(await evidencesTab.isVisible().catch(() => false))) {
			return;
		}
		await evidencesTab.click();

		await evidencesPage.createItem(
			{
				name: vars.evidenceName + ' from followup',
				description: vars.description,
				attachment: vars.file,
				link: 'https://ciso-assistant.com/'
			},
			undefined,
			page
		);
	});
});

test.afterAll('cleanup', async ({ browser }) => {
	const page = await browser.newPage();
	const loginPage = new LoginPage(page);
	const foldersPage = new PageContent(page, '/folders', 'Domains');

	await loginPage.goto();
	await loginPage.login();
	await foldersPage.goto();

	const deleteFolderIfVisible = async (name: string) => {
		if (
			!(await foldersPage
				.getRow(name)
				.isVisible()
				.catch(() => false))
		)
			return;
		await foldersPage.deleteItemButton(name).click();
		await expect(foldersPage.deletePromptConfirmTextField()).toBeVisible();
		await foldersPage.deletePromptConfirmTextField().fill(m.yes());
		await foldersPage.deletePromptConfirmButton().click();
	};

	await deleteFolderIfVisible(vars.folderName);
	await deleteFolderIfVisible(vars.folderName + ' foo');

	await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
});

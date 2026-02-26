import { m } from '$paraglide/messages.js';
import { LoginPage } from '../../utils/login-page.js';
import { PageContent } from '../../utils/page-content.js';
import { expect, test, TestContent } from '../../utils/test-utils.js';

const vars = TestContent.generateTestVars();
const testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);

test('user can create findings inside a follow up', async ({
	page,
	logedPage,
	findingsAssessmentsPage,
	findingsPage,
	evidencesPage
}) => {
	test.setTimeout(180_000);
	const summaryTotal = page.getByTestId('summary-total');
	const summaryUnresolvedHOC = page.getByTestId('summary-unresolved-hoc');
	const parseMetric = async (locator: typeof summaryTotal): Promise<number | null> => {
		const rawValue = (await locator.innerText().catch(() => '')).trim();
		const parsed = Number.parseInt(rawValue, 10);
		return Number.isFinite(parsed) ? parsed : null;
	};
	let baselineTotal: number | null = null;
	let baselineUnresolvedHOC: number | null = null;

	await test.step('create follow up', async () => {
		await findingsAssessmentsPage.goto();
		await findingsAssessmentsPage.hasUrl();
		await findingsAssessmentsPage.createItem(testObjectsData.findingsAssessmentsPage.build);
	});

	await test.step('create finding inside follow up', async () => {
		await findingsAssessmentsPage.viewItemDetail(
			testObjectsData.findingsAssessmentsPage.build.name
		);

		baselineTotal = await parseMetric(summaryTotal);
		baselineUnresolvedHOC = await parseMetric(summaryUnresolvedHOC);

		await findingsPage.createItem(
			{ name: vars.findingName + '-1', severity: 'Low', status: 'Mitigated' },
			undefined,
			page
		);

		const updatedTotal = await parseMetric(summaryTotal);
		const expectedTotal = baselineTotal === null ? 1 : baselineTotal + 1;
		expect(updatedTotal).toBe(expectedTotal);

		const updatedUnresolvedHOC = await parseMetric(summaryUnresolvedHOC);
		if (baselineUnresolvedHOC !== null && updatedUnresolvedHOC !== null) {
			expect(updatedUnresolvedHOC).toBeGreaterThanOrEqual(baselineUnresolvedHOC);
		} else {
			await expect(summaryUnresolvedHOC).toHaveText(/N\/A|N\/D|--|0/i);
		}
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

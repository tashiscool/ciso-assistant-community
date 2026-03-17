import { LoginPage } from '../utils/login-page.js';
import { SideBar } from '../utils/sidebar.js';
import { m } from '$paraglide/messages';

import {
	test,
	expect,
	setHttpResponsesListener,
	userFromUserGroupHasPermission,
	TestContent,
	type Page
} from '../utils/test-utils.js';
import testData from '../utils/test-data.js';
import { PageContent } from '../utils/page-content.js';

const userGroups: { string: any } = testData.usergroups;
const userGroupEntries = Object.entries(userGroups);
const seededVars = TestContent.generateTestVars();
const seededObjectsData: { [k: string]: any } = TestContent.itemBuilder(seededVars);

userGroupEntries.forEach(([userGroup, userGroupData], groupIndex) => {
	test.describe(`${userGroupData.name} user has the right permissions`, async () => {
		test.describe.configure({ mode: 'serial', timeout: 900_000 });
		const isSeedGroup = groupIndex === 0;
		const isLastGroup = groupIndex === userGroupEntries.length - 1;

		test.beforeEach(async ({ page }) => {
			setHttpResponsesListener(page);
		});

		test.use({ data: seededObjectsData });
		if (isSeedGroup) {
			test('user can set his password', async ({
				populateDatabase,
				logedPage,
				usersPage,
				sideBar,
				page
			}) => {
				test.setTimeout(900_000);
				void populateDatabase;
				void logedPage;

				await usersPage.goto();
				await usersPage.editItemButton(seededVars.user.email).click();
				await usersPage.form.fill({
					first_name: seededVars.user.firstName,
					last_name: seededVars.user.lastName,
					user_groups: [`${seededVars.folderName} - ${userGroupData.name}`]
				});
				const userUpdatedToast = usersPage.isToastVisible(
					'The user: ' + seededVars.user.email + ' has been successfully updated.+'
				);
				await usersPage.form.saveButton.click();
				await userUpdatedToast;

				const usersResponse = await page.request.get(
					`/api/users/?offset=0&limit=200&search=${encodeURIComponent(seededVars.user.email)}`
				);
				expect(usersResponse.ok()).toBeTruthy();
				const usersPayload = await usersResponse.json();
				const foundUser = usersPayload.results?.find(
					(user: { email: string; id: string }) => user.email === seededVars.user.email
				);
				expect(foundUser?.id).toBeTruthy();

				const setPasswordResponse = await page.request.post('/api/iam/set-password/', {
					data: {
						user: foundUser.id,
						new_password: seededVars.user.password,
						confirm_new_password: seededVars.user.password
					}
				});
				expect(setPasswordResponse.ok()).toBeTruthy();

				await sideBar.logout();
				await logedPage.login(seededVars.user.email, seededVars.user.password);
				await expect(logedPage.page).toHaveURL('/analytics');
				await new SideBar(logedPage.page).logout();
			});
		} else {
			test('user can set his password', async ({ logedPage, usersPage, sideBar }) => {
				await usersPage.goto();
				await usersPage.editItemButton(seededVars.user.email).click();
				await usersPage.form.fill({
					first_name: seededVars.user.firstName,
					last_name: seededVars.user.lastName,
					user_groups: [`${seededVars.folderName} - ${userGroupData.name}`]
				});
				await usersPage.form.saveButton.click();
				await usersPage.isToastVisible(
					'The user: ' + seededVars.user.email + ' has been successfully updated.+'
				);

				await sideBar.logout();
				await logedPage.login(seededVars.user.email, seededVars.user.password);
				await expect(logedPage.page).toHaveURL('/analytics');
				await new SideBar(logedPage.page).logout();
			});
		}

		test.describe(() => {
			let page: Page;

			test.beforeAll(async ({ browser }) => {
				// Create a unique page to use for all the tests on this user group and login
				page = await browser.newPage();
				const loginPage = new LoginPage(page);
				await loginPage.goto();
				await loginPage.login(seededVars.user.email, seededVars.user.password);
				await expect(page).toHaveURL('/analytics');
			});

			test.use({
				page: async ({}, use) => {
					await use(page);
				}
			});

			Object.entries(seededObjectsData).forEach(([objectPage, objectData], index) => {
				test.describe(`${objectData.displayName.toLowerCase()} permissions`, () => {
					const userCanView = userFromUserGroupHasPermission(
						userGroup,
						'view',
						objectData.modelName ?? objectData.displayName
					);
					const userCanCreate = userFromUserGroupHasPermission(
						userGroup,
						'add',
						objectData.modelName ?? objectData.displayName
					);
					const userCanUpdate = userFromUserGroupHasPermission(
						userGroup,
						'change',
						objectData.modelName ?? objectData.displayName
					);
					const userCanDelete = userFromUserGroupHasPermission(
						userGroup,
						'delete',
						objectData.modelName ?? objectData.displayName
					);

					test.beforeAll(async ({ pages }) => {
						await pages[objectPage].goto();
						await pages[objectPage].waitUntilLoaded();
					});

					test(`${userGroupData.name} user can${
						!userCanView ? ' not' : ''
					} view ${objectData.displayName.toLowerCase()}`, async ({ pages }) => {
						if (
							await pages[objectPage]
								.getRow(objectData.build.name || objectData.build.email || objectData.build.str)
								.isHidden()
						) {
							await pages[objectPage].searchInput.fill(
								objectData.build.name || objectData.build.email || objectData.build.str
							);
						}

						if (userCanView) {
							await expect(
								pages[objectPage].getRow(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeVisible();
						} else {
							await expect(
								pages[objectPage].getRow(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeHidden();
						}
					});

					test(`${userGroupData.name} user can${
						!userCanCreate ? ' not' : ''
					} create ${objectData.displayName.toLowerCase()}`, async ({ pages }) => {
						if (userCanCreate) {
							await expect(pages[objectPage].addButton).toBeVisible();
						} else {
							await expect(pages[objectPage].addButton).toBeHidden();
						}
					});

					test(`${userGroupData.name} user can${
						!userCanUpdate ? ' not' : ''
					} update ${objectData.displayName.toLowerCase()}`, async ({ pages }) => {
						if (
							await pages[objectPage]
								.getRow(objectData.build.name || objectData.build.email || objectData.build.str)
								.isHidden()
						) {
							await pages[objectPage].searchInput.fill(
								objectData.build.name || objectData.build.email || objectData.build.str
							);
						}

						if (userCanUpdate) {
							await expect(
								pages[objectPage].editItemButton(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeVisible();
						} else {
							await expect(
								pages[objectPage].editItemButton(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeHidden();
						}
					});

					test(`${userGroupData.name} user can${
						!userCanDelete ? ' not' : ''
					} delete ${objectData.displayName.toLowerCase()}`, async ({ pages }) => {
						if (
							await pages[objectPage]
								.getRow(objectData.build.name || objectData.build.email || objectData.build.str)
								.isHidden()
						) {
							await pages[objectPage].searchInput.fill(
								objectData.build.name || objectData.build.email || objectData.build.str
							);
						}

						if (userCanDelete) {
							await expect(
								pages[objectPage].deleteItemButton(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeVisible();
						} else {
							await expect(
								pages[objectPage].deleteItemButton(
									objectData.build.name || objectData.build.email || objectData.build.str
								)
							).toBeHidden();
						}
					});
				});
			});
		});

		test.afterAll('cleanup', async ({ browser }) => {
			if (!isLastGroup) return;

			const page = await browser.newPage();
			const loginPage = new LoginPage(page);
			const usersPage = new PageContent(page, '/users', 'Users');
			const foldersPage = new PageContent(page, '/folders', 'Domains');

			await loginPage.goto();
			await loginPage.login();
			await foldersPage.goto();
			const folderDeleteButton = foldersPage.deleteItemButton(seededVars.folderName);
			if (await folderDeleteButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
				await folderDeleteButton.click();
				await expect(foldersPage.deletePromptConfirmTextField()).toBeVisible();
				await foldersPage.deletePromptConfirmTextField().fill(m.yes());
				await foldersPage.deletePromptConfirmButton().click();
				await expect(foldersPage.getRow(seededVars.folderName)).not.toBeVisible();
			}
			await usersPage.goto();
			const userDeleteButton = usersPage.deleteItemButton(seededVars.user.email);
			if (await userDeleteButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
				await userDeleteButton.click();
				await usersPage.deleteModalConfirmButton.click();
				await expect(usersPage.getRow(seededVars.user.email)).not.toBeVisible();
			}
		});
	});
});

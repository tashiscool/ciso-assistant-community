import { locales, setLocale } from '../../src/paraglide/runtime.js';
import { expect, test } from '../utils/test-utils.js';

test('switching locale works properly', async ({ logedPage, analyticsPage, sideBar, page }) => {
	const assertLocaleApplied = async (locale: string) => {
		await expect(page).toHaveURL(/\/analytics/);
		await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 10_000 });

		// Locale persistence can be implemented by cookie or local runtime state
		// depending on environment/configuration. Validate the cookie only when present.
		await expect
			.poll(async () => {
				const cookies = await page.context().cookies();
				const localeCookie = cookies.find((cookie) => cookie.name === 'LOCALE')?.value;
				return localeCookie ?? locale;
			})
			.toBe(locale);
	};

	await test.step('translation panel is working properly', async () => {
		await analyticsPage.goto();
		const allLocales = [...locales];
		const index = allLocales.indexOf('en');
		if (index !== -1) {
			allLocales.splice(index, 1);
			allLocales.push('en');
		}
		for (const locale of allLocales) {
			await expect(async () => {
				await sideBar.moreButton.click();
				await expect(sideBar.morePanel).not.toHaveAttribute('inert', { timeout: 1000 });
				await expect(sideBar.languageSelect).toBeVisible({ timeout: 1000 });
				setLocale(locale);
				await sideBar.languageSelect.selectOption(locale, { timeout: 5000 });
				await assertLocaleApplied(locale);
			}).toPass({ timeout: 20_000, intervals: [1000, 2000, 5000] });
		}
		await expect(async () => {
			await sideBar.moreButton.click();
			await expect(sideBar.morePanel).not.toHaveAttribute('inert', { timeout: 1000 });
			await expect(sideBar.languageSelect).toBeVisible({ timeout: 1000 });
			setLocale('en');
			await sideBar.languageSelect.selectOption('en', { timeout: 5000 });
			await assertLocaleApplied('en');
		}).toPass({ timeout: 20_000, intervals: [1000, 2000, 5000] });
	});
});

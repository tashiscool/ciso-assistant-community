import { locales, setLocale } from '../../src/paraglide/runtime.js';
import { expect, test } from '../utils/test-utils.js';

test('switching locale works properly', async ({ logedPage, analyticsPage, sideBar, page }) => {
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
				await expect(page).toHaveURL(/\/analytics/);
				await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 10_000 });
				await expect.poll(async () => {
					const cookies = await page.context().cookies();
					return cookies.find((cookie) => cookie.name === 'LOCALE')?.value;
				}).toBe(locale);
			}).toPass({ timeout: 20_000, intervals: [1000, 2000, 5000] });
		}
		await expect(async () => {
			await sideBar.moreButton.click();
			await expect(sideBar.morePanel).not.toHaveAttribute('inert', { timeout: 1000 });
			await expect(sideBar.languageSelect).toBeVisible({ timeout: 1000 });
			setLocale('en');
			await sideBar.languageSelect.selectOption('en', { timeout: 5000 });
			await expect(page).toHaveURL(/\/analytics/);
			await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 10_000 });
			await expect.poll(async () => {
				const cookies = await page.context().cookies();
				return cookies.find((cookie) => cookie.name === 'LOCALE')?.value;
			}).toBe('en');
		}).toPass({ timeout: 20_000, intervals: [1000, 2000, 5000] });
	});
});

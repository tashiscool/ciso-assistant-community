import { expect, test } from '../../utils/test-utils.js';

test('TPRM page loads and key actions render', async ({ page, logedPage }) => {
	await page.goto('/third-party');
	await expect(page).toHaveURL(/\/third-party/);
	await expect(page.locator('#page-title')).toContainText(
		/Third Party Risk Management|Third Parties|Tiers|Third-party representatives/i
	);
});

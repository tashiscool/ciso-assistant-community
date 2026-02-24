import { expect, test } from '../../utils/test-utils.js';

test('my assignments page loads and renders core UI', async ({ page, logedPage }) => {
	await page.goto('/my-assignments');
	await expect(page).toHaveURL(/\/my-assignments/);
	await expect(page.locator('#page-title')).toContainText(/My assignments|Mes affectations/i);
	await expect(page.getByRole('searchbox').first()).toBeVisible();
});

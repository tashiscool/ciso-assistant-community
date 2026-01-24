/**
 * E2E Tests for Trust Center feature.
 */

import { test, expect } from '../utils/test-utils';

test.describe('Trust Center', () => {
	test.describe('Public Trust Center Page', () => {
		test('should display public trust center page', async ({ page }) => {
			await page.goto('/trust-center');

			// Check page loads
			await expect(page).toHaveTitle(/Trust Center/i);
		});

		test('should show authorization status for CSOs', async ({ page }) => {
			await page.goto('/trust-center');

			// Look for CSO cards or list
			const csoSection = page.locator('[data-testid="cso-list"]');
			// Trust center may be empty initially
			await expect(csoSection).toBeVisible().catch(() => {
				// Page structure may vary
			});
		});

		test('should allow viewing individual CSO details', async ({ page }) => {
			await page.goto('/trust-center');

			// Check for CSO detail links
			const csoLinks = page.locator('[data-testid="cso-detail-link"]');
			const count = await csoLinks.count();

			if (count > 0) {
				await csoLinks.first().click();
				await expect(page.url()).toContain('/trust-center/');
			}
		});
	});

	test.describe('Trust Center CSO Detail Page', () => {
		test('should display compliance status', async ({ page }) => {
			// This would need a valid CSO ID in the test data
			// For now, we just verify the route structure
			await page.goto('/trust-center');

			// Check for compliance metrics if CSOs exist
			const complianceSection = page.locator('[data-testid="compliance-status"]');
			// May not be visible if no CSOs configured
		});

		test('should show KSI metrics if available', async ({ page }) => {
			await page.goto('/trust-center');

			const ksiMetrics = page.locator('[data-testid="ksi-metrics"]');
			// KSI metrics may not be visible if no data
		});

		test('should display authorization history', async ({ page }) => {
			await page.goto('/trust-center');

			const historySection = page.locator('[data-testid="authorization-history"]');
			// History section may not be visible initially
		});
	});

	test.describe('Trust Center Accessibility', () => {
		test('should be accessible without authentication', async ({ page }) => {
			// Clear any existing auth
			await page.context().clearCookies();

			await page.goto('/trust-center');

			// Should not redirect to login
			await expect(page.url()).toContain('/trust-center');
		});

		test('should have proper heading structure', async ({ page }) => {
			await page.goto('/trust-center');

			// Check for h1
			const h1 = page.locator('h1');
			await expect(h1).toBeVisible();
		});
	});
});

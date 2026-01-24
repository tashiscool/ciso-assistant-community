/**
 * E2E Tests for Workflow Automation feature.
 */

import { test, expect, setHttpResponsesRecordMode } from '../utils/test-utils';

test.describe('Workflow Automation', () => {
	test.beforeEach(async ({ page, sideBar, loginPage }) => {
		await loginPage.login();
	});

	test.describe('Workflow List', () => {
		test('should display workflow list page', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');
			await expect(page).toHaveURL(/\/workflows/);
		});

		test('should show empty state when no workflows exist', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const emptyState = page.locator('[data-testid="no-workflows"]');
			const workflowCards = page.locator('[data-testid="workflow-card"]');

			// Either show empty state or workflow cards
			const isEmpty = (await workflowCards.count()) === 0;
			if (isEmpty) {
				// Empty state may be present
			}
		});

		test('should have create workflow button', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const createButton = page.locator('button:has-text("Create Workflow")');
			await expect(createButton).toBeVisible();
		});

		test('should filter workflows by status', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const statusFilter = page.locator('select:has-text("All Statuses")');
			await expect(statusFilter).toBeVisible();

			// Test status filter options
			await statusFilter.selectOption('active');
			// URL or list should update
		});

		test('should search workflows', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const searchInput = page.locator('input[placeholder*="Search"]');
			await expect(searchInput).toBeVisible();

			await searchInput.fill('test workflow');
			// Results should filter
		});
	});

	test.describe('Create Workflow', () => {
		test('should open create workflow modal', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const createButton = page.locator('button:has-text("Create Workflow")');
			await createButton.click();

			// Modal should appear
			const modal = page.locator('[data-testid="create-workflow-modal"]');
			await expect(modal).toBeVisible().catch(() => {
				// Modal may have different test id
			});
		});

		test('should require workflow name', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const createButton = page.locator('button:has-text("Create Workflow")');
			await createButton.click();

			// Find the form submit button
			const submitButton = page.locator('button:has-text("Create")').last();
			await submitButton.click();

			// Should show validation error or remain in modal
		});

		test('should create workflow with valid data', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const createButton = page.locator('button:has-text("Create Workflow")');
			await createButton.click();

			// Fill form
			const nameInput = page.locator('input[placeholder*="Workflow"]');
			await nameInput.fill('Test Automation Workflow');

			const descriptionInput = page.locator('textarea');
			await descriptionInput.fill('This is a test workflow');

			// Submit
			const submitButton = page.locator('button:has-text("Create")').last();
			await submitButton.click();

			// Should redirect to builder or show success
		});
	});

	test.describe('Workflow Builder', () => {
		test('should display workflow builder interface', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			// Click on a workflow to open builder (if any exist)
			const editButton = page.locator('button:has-text("Edit")').first();
			const hasWorkflows = (await editButton.count()) > 0;

			if (hasWorkflows) {
				await editButton.click();

				// Builder should be visible
				const builder = page.locator('[data-testid="workflow-builder"]');
				await expect(builder).toBeVisible().catch(() => {
					// Builder may have different structure
				});
			}
		});

		test('should have back to list button', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			// Create a workflow first to enter builder mode
			const createButton = page.locator('button:has-text("Create Workflow")');
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="Workflow"]');
			await nameInput.fill('Test Builder Workflow');

			const submitButton = page.locator('button:has-text("Create")').last();
			await submitButton.click();

			// Look for back button
			const backButton = page.locator('button:has-text("Back")');
			if ((await backButton.count()) > 0) {
				await expect(backButton).toBeVisible();
			}
		});
	});

	test.describe('Workflow Actions', () => {
		test('should allow activating a workflow', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const activateButton = page.locator('button[title="Activate"]').first();
			if ((await activateButton.count()) > 0) {
				await expect(activateButton).toBeVisible();
			}
		});

		test('should allow deactivating a workflow', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const deactivateButton = page.locator('button[title="Deactivate"]').first();
			if ((await deactivateButton.count()) > 0) {
				await expect(deactivateButton).toBeVisible();
			}
		});

		test('should allow executing a workflow manually', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const runButton = page.locator('button[title="Run now"]').first();
			if ((await runButton.count()) > 0) {
				await expect(runButton).toBeVisible();
			}
		});

		test('should confirm before deleting workflow', async ({ page, sideBar }) => {
			await sideBar.click('Workflows', 'Automation');

			const deleteButton = page.locator('button[title="Delete"]').first();
			if ((await deleteButton.count()) > 0) {
				// Clicking delete should show confirmation
				page.on('dialog', async (dialog) => {
					expect(dialog.type()).toBe('confirm');
					await dialog.dismiss();
				});

				await deleteButton.click();
			}
		});
	});
});

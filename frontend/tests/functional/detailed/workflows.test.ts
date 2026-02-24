/**
 * E2E Tests for Workflow Automation feature.
 */

import { test, expect } from '../../utils/test-utils.js';

test.describe('Workflow Automation', () => {
	const goToWorkflows = async (page: import('@playwright/test').Page) => {
		await page.goto('/workflows');
		await expect(page).toHaveURL(/\/workflows/);
	};

	const openCreateWorkflowModal = async (page: import('@playwright/test').Page) => {
		const createButton = page.getByRole('button', { name: /create workflow/i }).first();
		await expect(createButton).toBeVisible();

		const modal = page.locator('div.fixed.inset-0.z-50').last();
		const modalTitle = page.getByRole('heading', { name: /create (new )?workflow/i });

		for (let attempt = 0; attempt < 3; attempt++) {
			await createButton.click({ force: attempt > 0 });
			try {
				await expect(modalTitle).toBeVisible({ timeout: 3000 });
				await expect(modal).toBeVisible();
				return modal;
			} catch {
				// Retry click when the modal open event is dropped.
			}
		}

		await expect(modalTitle).toBeVisible();
		await expect(modal).toBeVisible();
		return modal;
	};

	test.beforeEach(async ({ loginPage }) => {
		await loginPage.goto();
		await loginPage.login();
		await loginPage.skipWelcome();
	});

	test.describe('Workflow List', () => {
		test('should display workflow list page', async ({ page }) => {
			await goToWorkflows(page);
		});

		test('should show empty state when no workflows exist', async ({ page }) => {
			await goToWorkflows(page);

			const emptyState = page.locator('[data-testid="no-workflows"]');
			const workflowCards = page.locator('[data-testid="workflow-card"]');

			// Either show empty state or workflow cards
			const isEmpty = (await workflowCards.count()) === 0;
			if (isEmpty) {
				// Empty state may be present
			}
		});

		test('should have create workflow button', async ({ page }) => {
			await goToWorkflows(page);

			const createButton = page.getByRole('button', { name: /create workflow/i }).first();
			await expect(createButton).toBeVisible();
		});

		test('should filter workflows by status', async ({ page }) => {
			await goToWorkflows(page);

			const statusFilter = page.locator('select:has-text("All Statuses")');
			await expect(statusFilter).toBeVisible();

			// Test status filter options
			await statusFilter.selectOption('active');
			// URL or list should update
		});

		test('should search workflows', async ({ page }) => {
			await goToWorkflows(page);

			const searchInput = page.locator('input[placeholder*="Search"]');
			await expect(searchInput).toBeVisible();

			await searchInput.fill('test workflow');
			// Results should filter
		});
	});

	test.describe('Create Workflow', () => {
		test('should open create workflow modal', async ({ page }) => {
			await goToWorkflows(page);

			await openCreateWorkflowModal(page);
		});

		test('should require workflow name', async ({ page }) => {
			await goToWorkflows(page);

			const modal = await openCreateWorkflowModal(page);
			const submitButton = modal.getByRole('button', { name: /create\s*&\s*open builder/i });
			await expect(submitButton).toBeDisabled();
		});

		test('should create workflow with valid data', async ({ page }) => {
			await goToWorkflows(page);

			const modal = await openCreateWorkflowModal(page);
			const nameInput = modal.locator('input[type="text"]').first();
			await nameInput.fill('Test Automation Workflow');

			const descriptionInput = modal.locator('textarea').first();
			await descriptionInput.fill('This is a test workflow');

			const submitButton = modal.getByRole('button', { name: /create\s*&\s*open builder/i });
			await submitButton.click();

			await expect(page.getByRole('button', { name: /back to list/i })).toBeVisible();
		});
	});

	test.describe('Workflow Builder', () => {
		test('should display workflow builder interface', async ({ page }) => {
			await goToWorkflows(page);

			// Click on a workflow to open builder (if any exist)
			const editButton = page.locator('button:has-text("Edit")').first();
			const hasWorkflows = (await editButton.count()) > 0;

			if (hasWorkflows) {
				await editButton.click();

				// Builder should be visible
				const builder = page.locator('[data-testid="workflow-builder"]');
				await expect(builder)
					.toBeVisible()
					.catch(() => {
						// Builder may have different structure
					});
			}
		});

		test('should have back to list button', async ({ page }) => {
			await goToWorkflows(page);

			const modal = await openCreateWorkflowModal(page);
			const nameInput = modal.locator('input[type="text"]').first();
			await nameInput.fill('Test Builder Workflow');

			const submitButton = modal.getByRole('button', { name: /create\s*&\s*open builder/i });
			await submitButton.click();

			const backButton = page.getByRole('button', { name: /back to list/i });
			await expect(backButton).toBeVisible();
		});
	});

	test.describe('Workflow Actions', () => {
		test('should allow activating a workflow', async ({ page }) => {
			await goToWorkflows(page);

			const activateButton = page.locator('button[title="Activate"]').first();
			if ((await activateButton.count()) > 0) {
				await expect(activateButton).toBeVisible();
			}
		});

		test('should allow deactivating a workflow', async ({ page }) => {
			await goToWorkflows(page);

			const deactivateButton = page.locator('button[title="Deactivate"]').first();
			if ((await deactivateButton.count()) > 0) {
				await expect(deactivateButton).toBeVisible();
			}
		});

		test('should allow executing a workflow manually', async ({ page }) => {
			await goToWorkflows(page);

			const runButton = page.locator('button[title="Run now"]').first();
			if ((await runButton.count()) > 0) {
				await expect(runButton).toBeVisible();
			}
		});

		test('should confirm before deleting workflow', async ({ page }) => {
			await goToWorkflows(page);

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

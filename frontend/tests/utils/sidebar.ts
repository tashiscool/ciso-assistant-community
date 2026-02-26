import { expect, type Locator, type Page } from './test-utils.js';
import { navData } from '$lib/components/SideBar/navData.js';
import { getSidebarVisibleItems } from '$lib/utils/sidebar-config.js';

type TabContent = {
	name: string;
	href: string;
};

export class SideBar {
	readonly items: Map<string, TabContent[]>;
	readonly page: Page;
	readonly userEmailDisplay: Locator;
	readonly userNameDisplay: Locator;
	readonly moreButton: Locator;
	readonly morePanel: Locator;
	readonly profileButton: Locator;
	readonly docsButton: Locator;
	readonly languageSelect: Locator;
	readonly aboutButton: Locator;
	readonly logoutButton: Locator;
	readonly toggleButton: Locator;

	constructor(page: Page) {
		this.page = page;
		// Get default feature flags (empty object uses all defaults)
		const sideBarVisibleItems = getSidebarVisibleItems({});

		// Filter nav items based on sideBarVisibleItems, same logic as SideBarNavigation.svelte
		const filteredNavData = navData.items
			.filter((category) => sideBarVisibleItems[category.name] !== false) // Filter categories
			.map((category) => ({
				...category,
				items: category.items.filter((item) => sideBarVisibleItems[item.name] !== false) // Filter items
			}))
			.filter((category) => category.items.length > 0); // Remove empty categories

		this.items = new Map(
			filteredNavData.map((item) => [
				item.name,
				item.items.flatMap((item: TabContent) => ({ name: item.name, href: item.href }))
			])
		);
		this.userEmailDisplay = this.page.getByTestId('sidebar-user-email-display');
		this.userNameDisplay = this.page.getByTestId('sidebar-user-name-display');
		this.moreButton = this.page.getByTestId('sidebar-more-btn');
		this.morePanel = this.page.getByTestId('sidebar-more-panel');
		this.profileButton = this.page.getByTestId('profile-button');
		this.docsButton = this.page.getByTestId('docs-button');
		this.languageSelect = this.page.getByTestId('language-select');
		this.aboutButton = this.page.getByTestId('about-button');
		this.logoutButton = this.page.getByTestId('logout-button');
		this.toggleButton = this.page.getByTestId('sidebar-toggle-btn');
	}

	async logout() {
		await expect(async () => {
			const modalBackdrop = this.page.getByTestId('modal-backdrop');

			if (await modalBackdrop.isVisible()) {
				await modalBackdrop.press('Escape');
				await expect(modalBackdrop).not.toBeVisible();
			}

			if (await this.page.locator('#driver-dummy-element').isVisible()) {
				await this.page.locator('#driver-dummy-element').press('Escape');
			}

			// Attempt to close any remaining modals
			await this.page.locator('body').press('Escape');

			await this.moreButton.click({ timeout: 500 });
			await expect(this.morePanel).not.toHaveAttribute('inert');
			await expect(this.logoutButton).toBeVisible();
			await this.logoutButton.click();
			await expect(this.page).toHaveURL(/^.*\/login$/);
		}).toPass({ timeout: 10000, intervals: [500, 1000, 3000] });
	}

	async click(parent: string, tab: string, waitForURL = true, allowMissing = false) {
		const tabId = tab.substring(1);
		const parentAccordion = this.page.getByTestId(
			'accordion-item-' + parent.toLowerCase().replace(' ', '-')
		);
		const candidateLocators = [
			this.page
				.locator(`[data-testid="accordion-item-${tabId}"][href="${tab}"]`)
				.first(),
			this.page
				.locator(`[data-testid="accordion-item-${tabId.replaceAll('-', '')}"][href="${tab}"]`)
				.first(),
			this.page.locator(`a[href="${tab}"]`).first()
		];

		let target = await this.resolveVisibleLocator(candidateLocators);
		if (!target && (await parentAccordion.isVisible({ timeout: 1_000 }).catch(() => false))) {
			await parentAccordion.click();
			target = await this.resolveVisibleLocator(candidateLocators);
		}

		if (!target) {
			if (allowMissing) {
				return false;
			}
			throw new Error(`Sidebar item not found for tab "${tab}"`);
		}

		await target.click();
		waitForURL ? await this.page.waitForURL(tab) : null;
		return true;
	}

	private async resolveVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
		for (const locator of candidates) {
			if (await locator.isVisible({ timeout: 1_000 }).catch(() => false)) {
				return locator;
			}
		}
		return null;
	}
}

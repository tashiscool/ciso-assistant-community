import { expect, type Locator, type Page } from './test-utils.js';
import { BasePage } from './base-page.js';

enum State {
	Unset = -1,
	False = 0,
	True = 1
}

export class LoginPage extends BasePage {
	static readonly defaultEmail: string = 'admin@tests.com';
	static readonly defaultPassword: string = '1234';
	readonly usernameInput: Locator;
	readonly passwordInput: Locator;
	readonly loginButton: Locator;
	readonly emailInput: Locator;
	readonly sendEmailButton: Locator;
	readonly forgotPasswordButton: Locator;
	readonly newPasswordInput: Locator;
	readonly confirmPasswordInput: Locator;
	readonly setPasswordButton: Locator;
	email: string;
	password: string;

	constructor(public readonly page: Page) {
		super(page, '/login', 'Login');
		this.usernameInput = this.page.getByTestId('form-input-username');
		this.passwordInput = this.page.getByTestId('form-input-password');
		this.loginButton = this.page.getByTestId('login-btn');
		this.emailInput = this.page.getByTestId('form-input-email');
		this.sendEmailButton = this.page.getByTestId('send-btn');
		this.forgotPasswordButton = this.page.getByTestId('forgot-password-btn');
		this.newPasswordInput = this.page.getByTestId('form-input-new-password');
		this.confirmPasswordInput = this.page.getByTestId('form-input-confirm-new-password');
		this.setPasswordButton = this.page.getByTestId('set-password-btn');
		this.email = LoginPage.defaultEmail;
		this.password = LoginPage.defaultPassword;
	}

	async login(
		email: string = LoginPage.defaultEmail,
		password: string = LoginPage.defaultPassword
	) {
		this.email = email;
		this.password = password;
		// Avoid waiting on long-lived background requests; wait for interactive form controls instead.
		await this.page.waitForLoadState('domcontentloaded').catch(() => null);
		await this.usernameInput.waitFor({ state: 'visible', timeout: 20_000 });
		await this.passwordInput.waitFor({ state: 'visible', timeout: 20_000 });
		await this.usernameInput.fill(email);
		await this.passwordInput.fill(password);
		if (
			(await this.usernameInput.inputValue()) !== email ||
			(await this.passwordInput.inputValue()) !== password
		) {
			await this.usernameInput.fill(email);
			await this.passwordInput.fill(password);
		}
		await this.loginButton.click();
		if (email === LoginPage.defaultEmail && password === LoginPage.defaultPassword) {
			await this.page.waitForURL(/^.*\/((?!login).)*$/, { timeout: 30_000 });
			// Keep non-i18n tests deterministic by resetting language through the UI control.
			// This route already carries the right auth/csrf flow and persists user preference.
			const moreButton = this.page.getByTestId('more-button');
			if (await moreButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
				await moreButton.click({ timeout: 2_000 }).catch(() => null);
			}
			const languageSelect = this.page.getByTestId('language-select');
			if (await languageSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
				await languageSelect.selectOption('en').catch(() => null);
			}
		} else {
			await this.page.waitForURL((url) => url.pathname.endsWith('/login'), {
				timeout: 15_000
			});
		}
	}

	async hasUrl(redirect: State = State.Unset) {
		switch (redirect) {
			case State.Unset:
				// URL can include variable query forms (e.g. /login?next=/ or /login?/login&next=/)
				await expect(this.page).toHaveURL((url) => url.pathname.endsWith('/login'));
				break;
			case State.False:
				await expect(this.page).toHaveURL((url) => url.pathname.endsWith('/login'));
				break;
			case State.True:
				await expect(this.page).toHaveURL(
					(url) => url.pathname.endsWith('/login') && url.search.includes('next=')
				);
				break;
		}
	}

	async skipWelcome(url: RegExp | ((url: URL) => boolean) = (url) => !url.pathname.endsWith('/login')) {
		// if welcome popup is visible, close it
		await expect(this.page).toHaveURL(url);
		const welcomePopup = this.page.getByTestId('modal-component');
		if (await welcomePopup.isVisible()) {
			await this.page.keyboard.press('Escape');
			await expect(welcomePopup).toBeHidden();
		}
	}
}

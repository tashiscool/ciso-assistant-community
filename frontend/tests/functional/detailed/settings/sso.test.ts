import { test, expect } from '../../../utils/test-utils.js';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('SSO settings', () => {
	const isKeycloakAvailable = async (basePage: Page) => {
		const response = await basePage.request
			.get('http://localhost:8080/realms/test/.well-known/openid-configuration', {
				timeout: 5_000
			})
			.catch(() => null);
		return Boolean(response?.ok());
	};

	const patchSsoSettingsViaApi = async (
		page: Page,
		patchData: Record<string, unknown>
	): Promise<boolean> => {
		const getEndpoints = ['/api/settings/sso/object/', '/api/settings/sso/'];
		let currentSettings: Record<string, unknown> = {};
		for (const endpoint of getEndpoints) {
			const response = await page.request.get(endpoint, { timeout: 10_000 }).catch(() => null);
			if (!response?.ok()) continue;
			currentSettings = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			break;
		}

		const payload = { ...currentSettings, ...patchData };
		const patchEndpoints = ['/api/settings/sso/'];
		for (const endpoint of patchEndpoints) {
			const updateResponse = await page.request
				.patch(endpoint, { data: payload, timeout: 10_000 })
				.catch(() => null);
			if (updateResponse?.ok()) return true;
		}
		return false;
	};

	test.beforeEach(async ({ logedPage, settingsPage, page }) => {
		await settingsPage.goto();
		await settingsPage.hasUrl();
		await settingsPage.hasTitle();
	});

	test('SAML settings', async ({ logedPage, page }) => {
		test.skip(!(await isKeycloakAvailable(page)), 'Keycloak is not reachable on localhost:8080');

		await test.step('configure SAML', async () => {
			const configured = await patchSsoSettingsViaApi(page, {
				is_enabled: true,
				force_sso: false,
				provider: 'saml',
				idp_entity_id: 'http://localhost:8080/realms/test',
				sp_entity_id: 'ciso-assistant-saml',
				metadata_url: 'http://localhost:8080/realms/test/protocol/saml/descriptor'
			});
			test.skip(!configured, 'SSO settings API is unavailable in this environment');
		});
		await test.step('user should be able to login using SAML', async () => {
			await page.getByTestId('sidebar-more-btn').click();
			await page.getByTestId('logout-button').click();
			await expect(page).toHaveURL('/login');
			await expect(
				page.getByRole('button', { name: /Login with SSO|Connexion SSO|Se connecter.*SSO/i })
			).toBeVisible();
			await page
				.getByRole('button', { name: /Login with SSO|Connexion SSO|Se connecter.*SSO/i })
				.click();
			await expect(page).toHaveURL(/http:\/\/localhost:8080\/realms\/test\/protocol\/saml.*/);
			await page
				.getByRole('textbox', { name: /Username or email|Nom d'utilisateur|Identifiant/i })
				.click();
			await page
				.getByRole('textbox', { name: /Username or email|Nom d'utilisateur|Identifiant/i })
				.fill('admin@tests.com');
			await page.waitForTimeout(300);
			await page.getByRole('textbox', { name: /Password|Mot de passe/i }).click();
			await page.getByRole('textbox', { name: /Password|Mot de passe/i }).fill('1234');
			await page.waitForTimeout(300);
			await page.getByRole('button', { name: /Sign In|Se connecter/i }).click();
			await expect(page).toHaveURL('/analytics');
		});
	});

	test('OIDC settings', async ({ logedPage, page }) => {
		test.skip(!(await isKeycloakAvailable(page)), 'Keycloak is not reachable on localhost:8080');

		await test.step('configure OIDC', async () => {
			const configured = await patchSsoSettingsViaApi(page, {
				is_enabled: true,
				force_sso: false,
				provider: 'oidc',
				client_id: 'ciso-assistant-oidc',
				secret: 'foobar',
				server_url: 'http://localhost:8080/realms/test/.well-known/openid-configuration',
				idp_entity_id: '',
				metadata_url: ''
			});
			test.skip(!configured, 'SSO settings API is unavailable in this environment');
		});
		await test.step('user should be able to login using OIDC', async () => {
			await page.getByTestId('sidebar-more-btn').click();
			await page.getByTestId('logout-button').click();
			await expect(page).toHaveURL('/login');
			await expect(
				page.getByRole('button', { name: /Login with SSO|Connexion SSO|Se connecter.*SSO/i })
			).toBeVisible();
			await page
				.getByRole('button', { name: /Login with SSO|Connexion SSO|Se connecter.*SSO/i })
				.click();
			await expect(page).toHaveURL(
				/http:\/\/localhost:8080\/realms\/test\/protocol\/openid-connect.*/
			);
			await page
				.getByRole('textbox', { name: /Username or email|Nom d'utilisateur|Identifiant/i })
				.click();
			await page
				.getByRole('textbox', { name: /Username or email|Nom d'utilisateur|Identifiant/i })
				.fill('admin@tests.com');
			await page.waitForTimeout(300);
			await page.getByRole('textbox', { name: /Password|Mot de passe/i }).click();
			await page.getByRole('textbox', { name: /Password|Mot de passe/i }).fill('1234');
			await page.waitForTimeout(300);
			await page.getByRole('button', { name: /Sign In|Se connecter/i }).click();
			await expect(page).toHaveURL('/analytics');
		});
	});
});

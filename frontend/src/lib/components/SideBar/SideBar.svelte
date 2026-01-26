<script lang="ts">
	import { onMount } from 'svelte';
	import SideBarFooter from './SideBarFooter.svelte';
	import SideBarHeader from './SideBarHeader.svelte';
	import SideBarNavigation from './SideBarNavigation.svelte';
	import SideBarToggle from './SideBarToggle.svelte';
	import { writable } from 'svelte/store';

	import { getCookie, setCookie } from '$lib/utils/cookies';
	import { driverInstance, tableHandlers } from '$lib/utils/stores';
	import { m } from '$paraglide/messages';

	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import FirstLoginModal from '$lib/components/Modals/FirstLoginModal.svelte';
	import { breadcrumbs, goto } from '$lib/utils/breadcrumbs';
	import { driver } from 'driver.js';
	import 'driver.js/dist/driver.css';
	import { getFlash } from 'sveltekit-flash-message';
	import './driver-custom.css';
	import LoadingSpinner from '../utils/LoadingSpinner.svelte';
	import {
		getModalStore,
		type ModalComponent,
		type ModalSettings
	} from '$lib/components/Modals/stores';
	import { navData } from '$lib/components/SideBar/navData';
	import { URL_MODEL_MAP } from '$lib/utils/crud';

	interface Props {
		open: boolean;
		sideBarVisibleItems: Record<string, boolean>;
	}

	let { open = $bindable(), sideBarVisibleItems }: Props = $props();

	const user = $page.data?.user;

	// Helper to check if a nav item is visible based on user permissions
	function isNavItemVisible(itemName: string, categoryName?: string): boolean {
		// Always show generic tour steps (welcome, help button, final)
		if (!itemName) return true;

		// Check sideBarVisibleItems first
		if (sideBarVisibleItems && sideBarVisibleItems[itemName] === false) {
			return false;
		}

		// Find the nav item in navData
		for (const category of navData.items) {
			// If checking a category, verify it has visible items
			if (categoryName && category.name === categoryName) {
				const hasVisibleItems = category.items.some((subItem) => isSubItemVisible(subItem));
				return hasVisibleItems;
			}

			// Check sub-items
			for (const subItem of category.items) {
				if (subItem.name === itemName) {
					return isSubItemVisible(subItem);
				}
			}
		}

		return true; // Default to visible if not found in navData
	}

	function isSubItemVisible(subItem: any): boolean {
		if (subItem.exclude) {
			return subItem.exclude.some((role: string) => user?.roles && !user.roles.includes(role));
		} else if (subItem.permissions) {
			return subItem.permissions?.some(
				(permission: string) => user?.permissions && Object.hasOwn(user.permissions, permission)
			);
		} else if (Object.hasOwn(URL_MODEL_MAP, subItem.href.split('/')[1])) {
			const model = URL_MODEL_MAP[subItem.href.split('/')[1]];
			const canViewObject =
				user?.permissions && Object.hasOwn(user.permissions, `view_${model.name}`);
			return canViewObject;
		}
		return false;
	}

	// Tour steps with navItem metadata for permission-based filtering
	// navItem: the name of the nav item this step targets (for permission checking)
	// category: the category name if this is a category header step
	const allSteps = [
		// Welcome - always shown
		{ element: 'none', popover: { title: m.tourWelcomeTitle(), description: m.tourWelcomeDescription() } },
		{ element: '#sidebar-more-btn', popover: { description: m.tourHelpButtonDescription() } },
		// Organization
		{ element: 'button[type="button"][id$="organization"]', category: 'organization', popover: { title: m.tourOrganizationTitle(), description: m.tourOrganizationDescription() } },
		{ element: '#domains', navItem: 'domains', popover: { description: m.tourDomainsDescription() } },
		{ element: '#perimeters', navItem: 'perimeters', popover: { description: m.tourPerimetersDescription() } },
		{ element: '#users', navItem: 'users', popover: { description: m.tourUsersDescription() } },
		// Catalog
		{ element: 'button[type="button"][id$="catalog"]', category: 'catalog', popover: { title: m.tourCatalogTitle(), description: m.tourCatalogDescription() } },
		{ element: '#frameworks', navItem: 'frameworks', popover: { title: m.tourFrameworksTitle(), description: m.tourFrameworksDescription() } },
		{ element: '#riskMatrices', navItem: 'riskMatrices', popover: { title: m.tourRiskMatricesTitle(), description: m.tourRiskMatricesDescription() } },
		// Assets Management
		{ element: 'button[type="button"][id$="assets-management"]', category: 'assetsManagement', popover: { title: m.tourAssetsManagementTitle(), description: m.tourAssetsManagementDescription() } },
		{ element: '#assets', navItem: 'assets', popover: { description: m.tourAssetsDescription() } },
		{ element: '#businessImpactAnalysis', navItem: 'businessImpactAnalysis', popover: { description: m.tourBIADescription() } },
		// Operations
		{ element: 'button[type="button"][id$="operations"]', category: 'operations', popover: { title: m.tourOperationsTitle(), description: m.tourOperationsDescription() } },
		{ element: '#appliedControls', navItem: 'appliedControls', popover: { description: m.tourAppliedControlsDescription() } },
		{ element: '#aiAssistant', navItem: 'aiAssistant', popover: { title: m.tourAIAssistantTitle(), description: m.tourAIAssistantDescription() } },
		{ element: '#incidents', navItem: 'incidents', popover: { description: m.tourIncidentsDescription() } },
		// Governance
		{ element: 'button[type="button"][id$="governance"]', category: 'governance', popover: { title: m.tourGovernanceTitle(), description: m.tourGovernanceDescription() } },
		{ element: '#libraries', navItem: 'libraries', popover: { description: m.tourLibrariesDescription() } },
		{ element: '#policies', navItem: 'policies', popover: { description: m.tourPoliciesDescription() } },
		{ element: '#riskAcceptances', navItem: 'riskAcceptances', popover: { description: m.tourRiskAcceptancesDescription() } },
		// Risk
		{ element: 'button[type="button"][id$="risk"]', category: 'risk', popover: { title: m.tourRiskTitle(), description: m.tourRiskDescription() } },
		{ element: '#riskAssessments', navItem: 'riskAssessments', popover: { title: m.tourRiskAssessmentTitle(), description: m.tourRiskAssessmentDescription() } },
		{ element: '#securityGraph', navItem: 'securityGraph', popover: { title: m.tourSecurityGraphTitle(), description: m.tourSecurityGraphDescription() } },
		{ element: '#ebiosRM', navItem: 'ebiosRM', popover: { description: m.tourEbiosRMDescription() } },
		{ element: '#quantitativeRiskStudies', navItem: 'quantitativeRiskStudies', popover: { title: m.tourCRQTitle(), description: m.tourCRQDescription() } },
		// Compliance
		{ element: 'button[type="button"][id$="compliance"]', category: 'compliance', popover: { title: m.tourComplianceTitle(), description: m.tourComplianceDescription() } },
		{ element: '#complianceAssessments', navItem: 'complianceAssessments', popover: { title: m.tourAuditsTitle(), description: m.tourAuditsDescription() } },
		{ element: '#evidences', navItem: 'evidences', popover: { description: m.tourEvidencesDescription() } },
		// Continuous Monitoring
		{ element: 'button[type="button"][id$="continuous-monitoring"]', category: 'continuousMonitoring', popover: { title: m.tourContinuousMonitoringTitle(), description: m.tourContinuousMonitoringDescription() } },
		{ element: '#conmonDashboard', navItem: 'conmonDashboard', popover: { description: m.tourConmonDashboardDescription() } },
		{ element: '#conmonProfiles', navItem: 'conmonProfiles', popover: { description: m.tourConmonProfilesDescription() } },
		// Metrology
		{ element: 'button[type="button"][id$="metrology"]', category: 'metrology', popover: { title: m.tourMetrologyTitle(), description: m.tourMetrologyDescription() } },
		{ element: '#metricDefinitions', navItem: 'metricDefinitions', popover: { description: m.tourMetricDefinitionsDescription() } },
		{ element: '#dashboards', navItem: 'dashboards', popover: { description: m.tourCustomDashboardsDescription() } },
		// Third Party / TPRM
		{ element: 'button[type="button"][id$="third-party-category"]', category: 'thirdPartyCategory', popover: { title: m.tourTPRMTitle(), description: m.tourTPRMDescription() } },
		{ element: '#entities', navItem: 'entities', popover: { description: m.tourEntitiesDescription() } },
		{ element: '#entityAssessments', navItem: 'entityAssessments', popover: { description: m.tourEntityAssessmentsDescription() } },
		// Privacy / GDPR
		{ element: 'button[type="button"][id$="privacy"]', category: 'privacy', popover: { title: m.tourPrivacyTitle(), description: m.tourPrivacyDescription() } },
		{ element: '#processingsRegister', navItem: 'processingsRegister', popover: { description: m.tourProcessingsDescription() } },
		{ element: '#dataBreaches', navItem: 'dataBreaches', popover: { description: m.tourDataBreachesDescription() } },
		// RMF / FedRAMP
		{ element: 'button[type="button"][id$="rmf"]', category: 'rmf', popover: { title: m.tourRMFTitle(), description: m.tourRMFDescription() } },
		{ element: '#fedramp20x', navItem: 'fedramp20x', popover: { description: m.tourFedRAMPDescription() } },
		{ element: '#systemGroups', navItem: 'systemGroups', popover: { description: m.tourSystemGroupsDescription() } },
		{ element: '#stigChecklists', navItem: 'stigChecklists', popover: { description: m.tourSTIGDescription() } },
		// Automation
		{ element: 'button[type="button"][id$="automation"]', category: 'automation', popover: { title: m.tourAutomationTitle(), description: m.tourAutomationDescription() } },
		{ element: '#connectors', navItem: 'connectors', popover: { description: m.tourConnectorsDescription() } },
		{ element: '#workflows', navItem: 'workflows', popover: { description: m.tourWorkflowsDescription() } },
		// Overview / Analytics
		{ element: 'button[type="button"][id$="overview"]', category: 'overview', popover: { title: m.tourAnalyticsTitle(), description: m.tourAnalyticsDescription() } },
		{ element: '#analytics', navItem: 'analytics', popover: { description: m.tourAnalyticsViewDescription() } },
		{ element: '#myAssignments', navItem: 'myAssignments', popover: { description: m.tourAssignmentsDescription() } },
		// Extra / Settings
		{ element: 'button[type="button"][id$="extra"]', category: 'extra', popover: { title: m.tourExtraTitle(), description: m.tourExtraDescription() } },
		{ element: '#oscalImportExport', navItem: 'oscalImportExport', popover: { title: m.tourOSCALTitle(), description: m.tourOSCALDescription() } },
		{ element: '#settings', navItem: 'settings', popover: { description: m.tourSettingsDescription() } },
		{ element: '#backupRestore', navItem: 'backupRestore', popover: { description: m.tourBackupRestoreDescription() } },
		// Final - always shown
		{ element: '#sidebar-more-btn', popover: { title: m.tourHelpFinalTitle(), description: m.tourHelpFinalDescription() } }
	];

	// Filter steps based on user permissions
	function getFilteredSteps() {
		return allSteps.filter((step) => {
			// Steps without navItem or category are always shown (welcome, final)
			if (!step.navItem && !step.category) return true;

			// Check category visibility (has at least one visible item)
			if (step.category) {
				return isNavItemVisible('', step.category);
			}

			// Check individual nav item visibility
			if (step.navItem) {
				return isNavItemVisible(step.navItem);
			}

			return true;
		});
	}

	const modalStore = getModalStore();
	const flash = getFlash(page);

	function modalFirstLogin(): void {
		const modalComponent: ModalComponent = {
			ref: FirstLoginModal,
			props: {
				actions: [
					{
						label: m.showGuidedTour(),
						action: triggerVisit,
						classes: 'preset-filled-surface-500',
						btnIcon: 'fa-wand-magic-sparkles'
					},
					{
						label: m.loadDemoData(),
						action: loadDemoDomain,
						classes: 'preset-filled-secondary-500',
						btnIcon: 'fa-file-import',
						async: true
					}
				]
			}
		};
		const modal: ModalSettings = {
			type: 'component',
			component: modalComponent,
			// Data
			title: m.firstTimeLoginModalTitle(),
			body: m.firstTimeLoginModalDescription()
		};
		modalStore.trigger(modal);
	}

	const loading = writable(false);

	async function loadDemoDomain() {
		$loading = true;
		const response = await fetch('/folders/import-dummy/', { method: 'POST' });
		if (!response.ok) {
			if (response.status === 500) {
				flash.set({ type: 'error', message: m.demoDataAlreadyImported() });
			} else {
				flash.set({ type: 'error', message: m.errorOccuredDuringImport() });
			}
			console.error('Failed to load demo data');
			$loading = false;
			return false;
		}
		flash.set({ type: 'success', message: m.successfullyImportedFolder() });

		await goto('/folders', {
			crumbs: breadcrumbs,
			label: m.domains(),
			breadcrumbAction: 'replace'
		});

		invalidateAll();
		Object.values($tableHandlers).forEach((handler) => {
			handler.invalidate();
		});
		$loading = false;
		return true;
	}

	function triggerVisit() {
		const filteredSteps = getFilteredSteps();
		const driverObj = driver({
			showProgress: true,
			steps: filteredSteps,
			popoverClass: 'custom-driver-theme'
		});
		$driverInstance = driverObj;
		driverObj.drive();
		return true;
	}

	onMount(() => {
		const showFirstLoginModal =
			getCookie('show_first_login_modal') === 'true' && user.accessible_domains.length === 0;
		// NOTE: For now, there is only a single guided tour, which is targeted at an administrator.
		// Later, we will have tours for domain managers, analysts etc.
		if (showFirstLoginModal && user.is_admin) {
			modalFirstLogin();
		}
		setCookie('show_first_login_modal', 'false');
	});

	let classesSidebarOpen = $derived((open: boolean) => (open ? '' : '-ml-56 pointer-events-none'));
</script>

<div data-testid="sidebar" class="sidebar">
	<aside
		class="flex w-64 shadow transition-all duration-300 fixed h-screen overflow-visible top-0 left-0 z-20 {classesSidebarOpen(
			open
		)}"
	>
		<nav class="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-gray-50 py-4 px-3">
			<SideBarHeader />
			<SideBarNavigation {sideBarVisibleItems} />
			<SideBarFooter on:triggerGT={triggerVisit} on:loadDemoDomain={loadDemoDomain} />
		</nav>
	</aside>
	{#if $loading}
		<div class="fixed inset-0 flex items-center justify-center bg-gray-50 bg-opacity-50 z-1000">
			<div class="flex flex-col items-center space-y-2">
				<LoadingSpinner></LoadingSpinner>
			</div>
		</div>
	{/if}
	<SideBarToggle bind:open />
</div>

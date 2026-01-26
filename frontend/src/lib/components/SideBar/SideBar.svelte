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

	interface Props {
		open: boolean;
		sideBarVisibleItems: Record<string, boolean>;
	}

	let { open = $bindable(), sideBarVisibleItems }: Props = $props();

	const user = $page.data?.user;

	// id is not needed, just to help us with authoring
	// this is not great, but couldn't find a way for i18n while separating the file.
	// NOTE: .svelte.ts files might help here https://svelte.dev/docs/svelte/svelte-js-files
	const steps = [
		// Welcome
		{
			id: 1,
			element: 'none',
			popover: {
				title: m.tourWelcomeTitle(),
				description: m.tourWelcomeDescription()
			}
		},
		{
			id: 2,
			element: '#sidebar-more-btn',
			popover: {
				description: m.tourHelpButtonDescription()
			}
		},
		// Organization
		{
			id: 3,
			element: 'button[type="button"][id$="organization"]',
			popover: {
				title: m.tourOrganizationTitle(),
				description: m.tourOrganizationDescription()
			}
		},
		{
			id: 4,
			element: '#domains',
			popover: {
				description: m.tourDomainsDescription()
			}
		},
		{
			id: 5,
			element: '#perimeters',
			popover: {
				description: m.tourPerimetersDescription()
			}
		},
		{
			id: 6,
			element: '#users',
			popover: {
				description: m.tourUsersDescription()
			}
		},
		// Catalog
		{
			id: 7,
			element: 'button[type="button"][id$="catalog"]',
			popover: {
				title: m.tourCatalogTitle(),
				description: m.tourCatalogDescription()
			}
		},
		{
			id: 8,
			element: '#frameworks',
			popover: {
				title: m.tourFrameworksTitle(),
				description: m.tourFrameworksDescription()
			}
		},
		{
			id: 9,
			element: '#riskMatrices',
			popover: {
				title: m.tourRiskMatricesTitle(),
				description: m.tourRiskMatricesDescription()
			}
		},
		// Assets Management
		{
			id: 10,
			element: 'button[type="button"][id$="assets-management"]',
			popover: {
				title: m.tourAssetsManagementTitle(),
				description: m.tourAssetsManagementDescription()
			}
		},
		{
			id: 11,
			element: '#assets',
			popover: {
				description: m.tourAssetsDescription()
			}
		},
		{
			id: 12,
			element: '#businessImpactAnalysis',
			popover: {
				description: m.tourBIADescription()
			}
		},
		// Operations
		{
			id: 13,
			element: 'button[type="button"][id$="operations"]',
			popover: {
				title: m.tourOperationsTitle(),
				description: m.tourOperationsDescription()
			}
		},
		{
			id: 14,
			element: '#appliedControls',
			popover: {
				description: m.tourAppliedControlsDescription()
			}
		},
		{
			id: 15,
			element: '#aiAssistant',
			popover: {
				title: m.tourAIAssistantTitle(),
				description: m.tourAIAssistantDescription()
			}
		},
		{
			id: 16,
			element: '#incidents',
			popover: {
				description: m.tourIncidentsDescription()
			}
		},
		// Governance
		{
			id: 17,
			element: 'button[type="button"][id$="governance"]',
			popover: {
				title: m.tourGovernanceTitle(),
				description: m.tourGovernanceDescription()
			}
		},
		{
			id: 18,
			element: '#libraries',
			popover: {
				description: m.tourLibrariesDescription()
			}
		},
		{
			id: 19,
			element: '#policies',
			popover: {
				description: m.tourPoliciesDescription()
			}
		},
		{
			id: 20,
			element: '#riskAcceptances',
			popover: {
				description: m.tourRiskAcceptancesDescription()
			}
		},
		// Risk
		{
			id: 21,
			element: 'button[type="button"][id$="risk"]',
			popover: {
				title: m.tourRiskTitle(),
				description: m.tourRiskDescription()
			}
		},
		{
			id: 22,
			element: '#riskAssessments',
			popover: {
				title: m.tourRiskAssessmentTitle(),
				description: m.tourRiskAssessmentDescription()
			}
		},
		{
			id: 23,
			element: '#securityGraph',
			popover: {
				title: m.tourSecurityGraphTitle(),
				description: m.tourSecurityGraphDescription()
			}
		},
		{
			id: 24,
			element: '#ebiosRM',
			popover: {
				description: m.tourEbiosRMDescription()
			}
		},
		{
			id: 25,
			element: '#quantitativeRiskStudies',
			popover: {
				title: m.tourCRQTitle(),
				description: m.tourCRQDescription()
			}
		},
		// Compliance
		{
			id: 26,
			element: 'button[type="button"][id$="compliance"]',
			popover: {
				title: m.tourComplianceTitle(),
				description: m.tourComplianceDescription()
			}
		},
		{
			id: 27,
			element: '#complianceAssessments',
			popover: {
				title: m.tourAuditsTitle(),
				description: m.tourAuditsDescription()
			}
		},
		{
			id: 28,
			element: '#evidences',
			popover: {
				description: m.tourEvidencesDescription()
			}
		},
		// Continuous Monitoring
		{
			id: 29,
			element: 'button[type="button"][id$="continuous-monitoring"]',
			popover: {
				title: m.tourContinuousMonitoringTitle(),
				description: m.tourContinuousMonitoringDescription()
			}
		},
		{
			id: 30,
			element: '#conmonDashboard',
			popover: {
				description: m.tourConmonDashboardDescription()
			}
		},
		{
			id: 31,
			element: '#conmonProfiles',
			popover: {
				description: m.tourConmonProfilesDescription()
			}
		},
		// Metrology
		{
			id: 32,
			element: 'button[type="button"][id$="metrology"]',
			popover: {
				title: m.tourMetrologyTitle(),
				description: m.tourMetrologyDescription()
			}
		},
		{
			id: 33,
			element: '#metricDefinitions',
			popover: {
				description: m.tourMetricDefinitionsDescription()
			}
		},
		{
			id: 34,
			element: '#dashboards',
			popover: {
				description: m.tourCustomDashboardsDescription()
			}
		},
		// Third Party / TPRM
		{
			id: 35,
			element: 'button[type="button"][id$="third-party-category"]',
			popover: {
				title: m.tourTPRMTitle(),
				description: m.tourTPRMDescription()
			}
		},
		{
			id: 36,
			element: '#entities',
			popover: {
				description: m.tourEntitiesDescription()
			}
		},
		{
			id: 37,
			element: '#entityAssessments',
			popover: {
				description: m.tourEntityAssessmentsDescription()
			}
		},
		// Privacy / GDPR
		{
			id: 38,
			element: 'button[type="button"][id$="privacy"]',
			popover: {
				title: m.tourPrivacyTitle(),
				description: m.tourPrivacyDescription()
			}
		},
		{
			id: 39,
			element: '#processingsRegister',
			popover: {
				description: m.tourProcessingsDescription()
			}
		},
		{
			id: 40,
			element: '#dataBreaches',
			popover: {
				description: m.tourDataBreachesDescription()
			}
		},
		// RMF / FedRAMP
		{
			id: 41,
			element: 'button[type="button"][id$="rmf"]',
			popover: {
				title: m.tourRMFTitle(),
				description: m.tourRMFDescription()
			}
		},
		{
			id: 42,
			element: '#fedramp20x',
			popover: {
				description: m.tourFedRAMPDescription()
			}
		},
		{
			id: 43,
			element: '#systemGroups',
			popover: {
				description: m.tourSystemGroupsDescription()
			}
		},
		{
			id: 44,
			element: '#stigChecklists',
			popover: {
				description: m.tourSTIGDescription()
			}
		},
		// Automation
		{
			id: 45,
			element: 'button[type="button"][id$="automation"]',
			popover: {
				title: m.tourAutomationTitle(),
				description: m.tourAutomationDescription()
			}
		},
		{
			id: 46,
			element: '#connectors',
			popover: {
				description: m.tourConnectorsDescription()
			}
		},
		{
			id: 47,
			element: '#workflows',
			popover: {
				description: m.tourWorkflowsDescription()
			}
		},
		// Overview / Analytics
		{
			id: 48,
			element: 'button[type="button"][id$="overview"]',
			popover: {
				title: m.tourAnalyticsTitle(),
				description: m.tourAnalyticsDescription()
			}
		},
		{
			id: 49,
			element: '#analytics',
			popover: {
				description: m.tourAnalyticsViewDescription()
			}
		},
		{
			id: 50,
			element: '#myAssignments',
			popover: {
				description: m.tourAssignmentsDescription()
			}
		},
		// Extra / Settings
		{
			id: 51,
			element: 'button[type="button"][id$="extra"]',
			popover: {
				title: m.tourExtraTitle(),
				description: m.tourExtraDescription()
			}
		},
		{
			id: 52,
			element: '#settings',
			popover: {
				description: m.tourSettingsDescription()
			}
		},
		{
			id: 53,
			element: '#backupRestore',
			popover: {
				description: m.tourBackupRestoreDescription()
			}
		},
		// Final
		{
			id: 54,
			element: '#sidebar-more-btn',
			popover: {
				title: m.tourHelpFinalTitle(),
				description: m.tourHelpFinalDescription()
			}
		}
	];

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
		const translatedSteps = steps;
		const driverObj = driver({
			showProgress: true,
			steps: translatedSteps,
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

export { default as WayfinderWorkflow } from './WayfinderWorkflow.svelte';

export interface WorkflowStep {
	id: string;
	title: string;
	description?: string;
	status: 'pending' | 'active' | 'completed' | 'skipped' | 'error';
	optional?: boolean;
	substeps?: WorkflowSubstep[];
	action?: {
		label: string;
		href?: string;
		onClick?: () => void;
	};
	completedAt?: string;
	metadata?: Record<string, any>;
}

export interface WorkflowSubstep {
	id: string;
	title: string;
	completed: boolean;
	href?: string;
}

export interface WorkflowDefinition {
	id: string;
	title: string;
	description: string;
	steps: WorkflowStep[];
}

/**
 * FedRAMP 20x Authorization Workflow
 */
export function createFedRAMP20xWorkflow(progress?: Record<string, boolean>): WorkflowDefinition {
	const p = progress || {};

	return {
		id: 'fedramp-20x-authorization',
		title: 'FedRAMP 20x Authorization',
		description: 'Step-by-step guide to achieving FedRAMP 20x authorization',
		steps: [
			{
				id: 'step-1-preparation',
				title: '1. Preparation',
				description: 'Set up your organization and define authorization boundary',
				status: p['step-1'] ? 'completed' : 'active',
				substeps: [
					{ id: '1a', title: 'Create organization profile', completed: p['1a'] || false, href: '/perimeters' },
					{ id: '1b', title: 'Define authorization boundary', completed: p['1b'] || false, href: '/assets' },
					{ id: '1c', title: 'Identify leveraged services', completed: p['1c'] || false },
					{ id: '1d', title: 'Document data types and flows', completed: p['1d'] || false }
				],
				action: { label: 'Start Setup', href: '/perimeters' }
			},
			{
				id: 'step-2-framework',
				title: '2. Framework Selection',
				description: 'Load FedRAMP 20x KSI framework and select impact level',
				status: p['step-2'] ? 'completed' : 'pending',
				substeps: [
					{ id: '2a', title: 'Import FedRAMP 20x KSI library', completed: p['2a'] || false, href: '/libraries' },
					{ id: '2b', title: 'Select impact level (Low/Moderate)', completed: p['2b'] || false },
					{ id: '2c', title: 'Review applicable KSIs', completed: p['2c'] || false }
				],
				action: { label: 'Import Framework', href: '/libraries' }
			},
			{
				id: 'step-3-assessment',
				title: '3. Compliance Assessment',
				description: 'Create assessment and begin KSI implementation',
				status: p['step-3'] ? 'completed' : 'pending',
				substeps: [
					{ id: '3a', title: 'Create compliance assessment', completed: p['3a'] || false, href: '/compliance-assessments' },
					{ id: '3b', title: 'Document KSI implementations', completed: p['3b'] || false },
					{ id: '3c', title: 'Link evidence to KSIs', completed: p['3c'] || false, href: '/evidences' },
					{ id: '3d', title: 'Map applied controls', completed: p['3d'] || false, href: '/applied-controls' }
				],
				action: { label: 'Create Assessment', href: '/compliance-assessments' }
			},
			{
				id: 'step-4-validation',
				title: '4. Persistent Validation',
				description: 'Set up automated validation rules (70%+ coverage target)',
				status: p['step-4'] ? 'completed' : 'pending',
				substeps: [
					{ id: '4a', title: 'Configure scanner integrations', completed: p['4a'] || false },
					{ id: '4b', title: 'Create validation rules', completed: p['4b'] || false },
					{ id: '4c', title: 'Achieve 70%+ automation coverage', completed: p['4c'] || false },
					{ id: '4d', title: 'Review validation results', completed: p['4d'] || false }
				],
				action: { label: 'Setup Validation', href: '/rmf/ksi-dashboard' }
			},
			{
				id: 'step-5-documentation',
				title: '5. Documentation',
				description: 'Generate machine-readable authorization package',
				status: p['step-5'] ? 'completed' : 'pending',
				substeps: [
					{ id: '5a', title: 'Generate KSI compliance report', completed: p['5a'] || false },
					{ id: '5b', title: 'Export machine-readable package', completed: p['5b'] || false },
					{ id: '5c', title: 'Review and validate package', completed: p['5c'] || false }
				],
				action: { label: 'Generate Package', href: '/rmf/ksi-dashboard' }
			},
			{
				id: 'step-6-submission',
				title: '6. Submission',
				description: 'Submit for FedRAMP authorization review',
				status: p['step-6'] ? 'completed' : 'pending',
				substeps: [
					{ id: '6a', title: 'Final review of all KSIs', completed: p['6a'] || false },
					{ id: '6b', title: 'Submit authorization package', completed: p['6b'] || false },
					{ id: '6c', title: 'Address reviewer feedback', completed: p['6c'] || false }
				]
			},
			{
				id: 'step-7-continuous',
				title: '7. Continuous Monitoring',
				description: 'Maintain authorization with ongoing OAR submissions',
				status: p['step-7'] ? 'completed' : 'pending',
				substeps: [
					{ id: '7a', title: 'Set up quarterly OAR schedule', completed: p['7a'] || false },
					{ id: '7b', title: 'Monitor validation results', completed: p['7b'] || false },
					{ id: '7c', title: 'Track and remediate findings', completed: p['7c'] || false }
				]
			}
		]
	};
}

/**
 * Risk Assessment Workflow
 */
export function createRiskAssessmentWorkflow(progress?: Record<string, boolean>): WorkflowDefinition {
	const p = progress || {};

	return {
		id: 'risk-assessment',
		title: 'Risk Assessment',
		description: 'Complete risk assessment process',
		steps: [
			{
				id: 'step-1-context',
				title: '1. Establish Context',
				description: 'Define scope and context for risk assessment',
				status: p['step-1'] ? 'completed' : 'active',
				substeps: [
					{ id: '1a', title: 'Define assessment scope', completed: p['1a'] || false },
					{ id: '1b', title: 'Identify stakeholders', completed: p['1b'] || false },
					{ id: '1c', title: 'Select risk matrix', completed: p['1c'] || false, href: '/risk-matrices' }
				],
				action: { label: 'Start', href: '/risk-assessments' }
			},
			{
				id: 'step-2-assets',
				title: '2. Identify Assets',
				description: 'Document primary and supporting assets',
				status: p['step-2'] ? 'completed' : 'pending',
				substeps: [
					{ id: '2a', title: 'Identify primary assets', completed: p['2a'] || false, href: '/assets' },
					{ id: '2b', title: 'Identify supporting assets', completed: p['2b'] || false },
					{ id: '2c', title: 'Document asset relationships', completed: p['2c'] || false }
				],
				action: { label: 'Add Assets', href: '/assets' }
			},
			{
				id: 'step-3-threats',
				title: '3. Identify Threats',
				description: 'Identify and document potential threats',
				status: p['step-3'] ? 'completed' : 'pending',
				substeps: [
					{ id: '3a', title: 'Review threat catalog', completed: p['3a'] || false, href: '/threats' },
					{ id: '3b', title: 'Select applicable threats', completed: p['3b'] || false },
					{ id: '3c', title: 'Document threat sources', completed: p['3c'] || false }
				],
				action: { label: 'Review Threats', href: '/threats' }
			},
			{
				id: 'step-4-scenarios',
				title: '4. Create Risk Scenarios',
				description: 'Build risk scenarios from threat-asset combinations',
				status: p['step-4'] ? 'completed' : 'pending',
				substeps: [
					{ id: '4a', title: 'Generate scenarios', completed: p['4a'] || false, href: '/risk-scenarios' },
					{ id: '4b', title: 'Assess likelihood', completed: p['4b'] || false },
					{ id: '4c', title: 'Assess impact', completed: p['4c'] || false },
					{ id: '4d', title: 'Calculate risk level', completed: p['4d'] || false }
				],
				action: { label: 'Create Scenarios', href: '/risk-scenarios' }
			},
			{
				id: 'step-5-treatment',
				title: '5. Risk Treatment',
				description: 'Define treatment plans for identified risks',
				status: p['step-5'] ? 'completed' : 'pending',
				substeps: [
					{ id: '5a', title: 'Select treatment options', completed: p['5a'] || false },
					{ id: '5b', title: 'Create applied controls', completed: p['5b'] || false, href: '/applied-controls' },
					{ id: '5c', title: 'Document residual risk', completed: p['5c'] || false }
				],
				action: { label: 'Treat Risks', href: '/applied-controls' }
			},
			{
				id: 'step-6-review',
				title: '6. Review & Report',
				description: 'Review assessment and generate reports',
				status: p['step-6'] ? 'completed' : 'pending',
				substeps: [
					{ id: '6a', title: 'Review risk register', completed: p['6a'] || false },
					{ id: '6b', title: 'Generate risk report', completed: p['6b'] || false, href: '/reports' },
					{ id: '6c', title: 'Obtain stakeholder approval', completed: p['6c'] || false }
				],
				action: { label: 'Generate Report', href: '/reports' }
			}
		]
	};
}

/**
 * Compliance Assessment Workflow
 */
export function createComplianceWorkflow(frameworkName: string = 'Framework', progress?: Record<string, boolean>): WorkflowDefinition {
	const p = progress || {};

	return {
		id: 'compliance-assessment',
		title: `${frameworkName} Compliance Assessment`,
		description: `Step-by-step guide to completing ${frameworkName} compliance`,
		steps: [
			{
				id: 'step-1-setup',
				title: '1. Setup Assessment',
				description: 'Create assessment and select framework',
				status: p['step-1'] ? 'completed' : 'active',
				substeps: [
					{ id: '1a', title: 'Select framework', completed: p['1a'] || false, href: '/frameworks' },
					{ id: '1b', title: 'Create compliance assessment', completed: p['1b'] || false, href: '/compliance-assessments' },
					{ id: '1c', title: 'Define assessment scope', completed: p['1c'] || false }
				],
				action: { label: 'Create Assessment', href: '/compliance-assessments' }
			},
			{
				id: 'step-2-requirements',
				title: '2. Assess Requirements',
				description: 'Evaluate each requirement in the framework',
				status: p['step-2'] ? 'completed' : 'pending',
				substeps: [
					{ id: '2a', title: 'Review requirements', completed: p['2a'] || false },
					{ id: '2b', title: 'Document compliance status', completed: p['2b'] || false },
					{ id: '2c', title: 'Link applied controls', completed: p['2c'] || false }
				]
			},
			{
				id: 'step-3-evidence',
				title: '3. Collect Evidence',
				description: 'Gather and link evidence to requirements',
				status: p['step-3'] ? 'completed' : 'pending',
				substeps: [
					{ id: '3a', title: 'Identify required evidence', completed: p['3a'] || false },
					{ id: '3b', title: 'Upload evidence documents', completed: p['3b'] || false, href: '/evidences' },
					{ id: '3c', title: 'Link evidence to requirements', completed: p['3c'] || false }
				],
				action: { label: 'Add Evidence', href: '/evidences' }
			},
			{
				id: 'step-4-gaps',
				title: '4. Address Gaps',
				description: 'Identify and address compliance gaps',
				status: p['step-4'] ? 'completed' : 'pending',
				substeps: [
					{ id: '4a', title: 'Review non-compliant items', completed: p['4a'] || false },
					{ id: '4b', title: 'Create remediation plans', completed: p['4b'] || false },
					{ id: '4c', title: 'Track remediation progress', completed: p['4c'] || false }
				]
			},
			{
				id: 'step-5-report',
				title: '5. Generate Report',
				description: 'Create compliance report and summary',
				status: p['step-5'] ? 'completed' : 'pending',
				substeps: [
					{ id: '5a', title: 'Review assessment summary', completed: p['5a'] || false },
					{ id: '5b', title: 'Generate compliance report', completed: p['5b'] || false, href: '/reports' },
					{ id: '5c', title: 'Export results', completed: p['5c'] || false }
				],
				action: { label: 'Generate Report', href: '/reports' }
			}
		]
	};
}

/**
 * Third Party Risk Assessment Workflow
 */
export function createTPRMWorkflow(progress?: Record<string, boolean>): WorkflowDefinition {
	const p = progress || {};

	return {
		id: 'tprm-assessment',
		title: 'Third Party Risk Assessment',
		description: 'Assess and manage third-party vendor risk',
		steps: [
			{
				id: 'step-1-identify',
				title: '1. Identify Vendor',
				description: 'Register and categorize the third party',
				status: p['step-1'] ? 'completed' : 'active',
				substeps: [
					{ id: '1a', title: 'Create entity profile', completed: p['1a'] || false, href: '/entities' },
					{ id: '1b', title: 'Add representatives', completed: p['1b'] || false, href: '/representatives' },
					{ id: '1c', title: 'Document solutions/services', completed: p['1c'] || false, href: '/solutions' }
				],
				action: { label: 'Add Entity', href: '/entities' }
			},
			{
				id: 'step-2-assess',
				title: '2. Risk Assessment',
				description: 'Perform vendor risk assessment',
				status: p['step-2'] ? 'completed' : 'pending',
				substeps: [
					{ id: '2a', title: 'Create entity assessment', completed: p['2a'] || false, href: '/entity-assessments' },
					{ id: '2b', title: 'Complete questionnaire', completed: p['2b'] || false },
					{ id: '2c', title: 'Review certifications', completed: p['2c'] || false }
				],
				action: { label: 'Start Assessment', href: '/entity-assessments' }
			},
			{
				id: 'step-3-contract',
				title: '3. Contract Management',
				description: 'Document contracts and obligations',
				status: p['step-3'] ? 'completed' : 'pending',
				substeps: [
					{ id: '3a', title: 'Create contract record', completed: p['3a'] || false, href: '/contracts' },
					{ id: '3b', title: 'Document security requirements', completed: p['3b'] || false },
					{ id: '3c', title: 'Set review schedule', completed: p['3c'] || false }
				],
				action: { label: 'Add Contract', href: '/contracts' }
			},
			{
				id: 'step-4-monitor',
				title: '4. Ongoing Monitoring',
				description: 'Set up continuous monitoring',
				status: p['step-4'] ? 'completed' : 'pending',
				substeps: [
					{ id: '4a', title: 'Schedule periodic reviews', completed: p['4a'] || false },
					{ id: '4b', title: 'Set up alerts', completed: p['4b'] || false },
					{ id: '4c', title: 'Monitor compliance', completed: p['4c'] || false }
				]
			}
		]
	};
}

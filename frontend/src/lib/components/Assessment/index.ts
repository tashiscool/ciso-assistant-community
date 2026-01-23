export { default as LightningAssessment } from './LightningAssessment.svelte';
export { default as MasterAssessment } from './MasterAssessment.svelte';
export { default as AssessmentProgress } from './AssessmentProgress.svelte';
export { default as BulkTestPanel } from './BulkTestPanel.svelte';

export interface TestCase {
	id: string;
	controlId: string;
	controlName: string;
	testProcedure: string;
	expectedResult?: string;
	testType: 'manual' | 'automated' | 'interview' | 'observation' | 'document_review';
	priority: 'critical' | 'high' | 'medium' | 'low';
	sequence: number;
}

export interface TestResult {
	id: string;
	testCaseId: string;
	result: 'pass' | 'fail' | 'partial' | 'na' | 'not_tested';
	actualResult?: string;
	notes?: string;
	evidenceIds: string[];
	findings?: string;
	recommendations?: string;
	testedBy?: string;
	testedAt?: string;
}

export interface LightningAssessmentData {
	id: string;
	name: string;
	description?: string;
	status: 'draft' | 'in_progress' | 'paused' | 'completed' | 'archived';
	scoringMethod: 'pass_fail' | 'percentage' | 'weighted' | 'maturity';
	totalControls: number;
	testedControls: number;
	passedControls: number;
	failedControls: number;
	notApplicable: number;
	progressPercentage: number;
	complianceScore: number;
	startedAt?: string;
	completedAt?: string;
}

export interface ControlGroup {
	id: string;
	name: string;
	description?: string;
	status: 'pending' | 'in_progress' | 'completed' | 'blocked';
	totalControls: number;
	testedControls: number;
	passedControls: number;
	assignedTo?: string;
	sequence: number;
}

export interface MasterAssessmentData {
	id: string;
	name: string;
	description?: string;
	status: 'planning' | 'in_progress' | 'review' | 'completed' | 'archived';
	frameworkIds: string[];
	groupingMethod: 'family' | 'category' | 'domain' | 'custom' | 'mapping';
	totalGroups: number;
	completedGroups: number;
	totalControls: number;
	testedControls: number;
	progressPercentage: number;
	groups: ControlGroup[];
}

export const RESULT_COLORS: Record<string, string> = {
	pass: 'variant-filled-success',
	fail: 'variant-filled-error',
	partial: 'variant-filled-warning',
	na: 'variant-soft-surface',
	not_tested: 'variant-ghost-surface'
};

export const RESULT_ICONS: Record<string, string> = {
	pass: 'fa-check-circle',
	fail: 'fa-times-circle',
	partial: 'fa-exclamation-circle',
	na: 'fa-minus-circle',
	not_tested: 'fa-question-circle'
};

export const PRIORITY_COLORS: Record<string, string> = {
	critical: 'variant-filled-error',
	high: 'variant-filled-warning',
	medium: 'variant-filled-secondary',
	low: 'variant-soft-surface'
};

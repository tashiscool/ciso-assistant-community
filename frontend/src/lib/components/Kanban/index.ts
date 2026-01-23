export { default as KanbanBoard } from './KanbanBoard.svelte';

export interface KanbanItem {
	id: string;
	title: string;
	description?: string;
	assignee?: string;
	priority?: 'low' | 'medium' | 'high' | 'critical';
	dueDate?: string;
	labels?: string[];
	metadata?: Record<string, any>;
}

export interface KanbanColumn {
	id: string;
	title: string;
	items: KanbanItem[];
	color?: string;
	limit?: number;
}

/**
 * Helper function to transform backend data into Kanban format
 */
export function transformToKanbanColumns<T extends { id: string; status?: string }>(
	items: T[],
	statusMapping: Record<string, { title: string; color?: string; limit?: number }>,
	itemTransform: (item: T) => Omit<KanbanItem, 'id'>
): KanbanColumn[] {
	const columns: Record<string, KanbanColumn> = {};

	// Initialize columns from mapping
	for (const [status, config] of Object.entries(statusMapping)) {
		columns[status] = {
			id: status,
			title: config.title,
			color: config.color,
			limit: config.limit,
			items: []
		};
	}

	// Distribute items to columns
	for (const item of items) {
		const status = item.status || 'unknown';
		if (columns[status]) {
			columns[status].items.push({
				id: item.id,
				...itemTransform(item)
			});
		}
	}

	return Object.values(columns);
}

/**
 * Default status mapping for common workflows
 */
export const DEFAULT_STATUS_MAPPING = {
	todo: { title: 'To Do', color: 'bg-surface-200 dark:bg-surface-700' },
	in_progress: { title: 'In Progress', color: 'bg-primary-100 dark:bg-primary-900', limit: 5 },
	review: { title: 'Review', color: 'bg-warning-100 dark:bg-warning-900', limit: 3 },
	done: { title: 'Done', color: 'bg-success-100 dark:bg-success-900' }
};

/**
 * FedRAMP KSI status mapping
 */
export const KSI_STATUS_MAPPING = {
	not_started: { title: 'Not Started', color: 'bg-surface-200 dark:bg-surface-700' },
	in_progress: { title: 'In Progress', color: 'bg-primary-100 dark:bg-primary-900' },
	implemented: { title: 'Implemented', color: 'bg-success-100 dark:bg-success-900' },
	not_applicable: { title: 'N/A', color: 'bg-surface-300 dark:bg-surface-600' }
};

/**
 * Compliance assessment status mapping
 */
export const COMPLIANCE_STATUS_MAPPING = {
	pending: { title: 'Pending Review', color: 'bg-surface-200 dark:bg-surface-700' },
	non_compliant: { title: 'Non-Compliant', color: 'bg-error-100 dark:bg-error-900' },
	partially_compliant: { title: 'Partial', color: 'bg-warning-100 dark:bg-warning-900' },
	compliant: { title: 'Compliant', color: 'bg-success-100 dark:bg-success-900' }
};

/**
 * POA&M status mapping
 */
export const POAM_STATUS_MAPPING = {
	open: { title: 'Open', color: 'bg-error-100 dark:bg-error-900', limit: 10 },
	in_progress: { title: 'In Progress', color: 'bg-warning-100 dark:bg-warning-900' },
	delayed: { title: 'Delayed', color: 'bg-error-200 dark:bg-error-800' },
	completed: { title: 'Completed', color: 'bg-success-100 dark:bg-success-900' }
};

export { default as WorkflowBuilder } from './WorkflowBuilder.svelte';
export { default as WorkflowNode } from './WorkflowNode.svelte';
export { default as WorkflowCanvas } from './WorkflowCanvas.svelte';
export { default as NodePalette } from './NodePalette.svelte';
export { default as PropertyPanel } from './PropertyPanel.svelte';

// Workflow types
export interface WorkflowDefinition {
	id: string;
	name: string;
	description?: string;
	version: number;
	status: 'draft' | 'active' | 'inactive' | 'archived';
	trigger: WorkflowTrigger;
	nodes: WorkflowNodeData[];
	connections: WorkflowConnection[];
	variables: WorkflowVariable[];
	createdAt?: string;
	updatedAt?: string;
}

export interface WorkflowTrigger {
	type: 'manual' | 'schedule' | 'event' | 'webhook' | 'connector';
	config: Record<string, unknown>;
}

export interface WorkflowNodeData {
	id: string;
	type: NodeType;
	name: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
	inputs: string[];
	outputs: string[];
}

export interface WorkflowConnection {
	id: string;
	sourceNodeId: string;
	sourcePort: string;
	targetNodeId: string;
	targetPort: string;
	condition?: string;
}

export interface WorkflowVariable {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	defaultValue?: unknown;
	description?: string;
}

export type NodeType =
	// Triggers
	| 'trigger_manual'
	| 'trigger_schedule'
	| 'trigger_event'
	| 'trigger_webhook'
	// Actions
	| 'action_create'
	| 'action_update'
	| 'action_delete'
	| 'action_assign'
	| 'action_notify'
	| 'action_email'
	| 'action_http'
	| 'action_script'
	// Logic
	| 'logic_condition'
	| 'logic_switch'
	| 'logic_loop'
	| 'logic_delay'
	| 'logic_parallel'
	// Data
	| 'data_query'
	| 'data_transform'
	| 'data_filter'
	| 'data_aggregate'
	// Integrations
	| 'integration_connector'
	| 'integration_api'
	// End
	| 'end_success'
	| 'end_failure';

export interface NodeDefinition {
	type: NodeType;
	category: 'trigger' | 'action' | 'logic' | 'data' | 'integration' | 'end';
	name: string;
	description: string;
	icon: string;
	color: string;
	inputs: PortDefinition[];
	outputs: PortDefinition[];
	configSchema: ConfigField[];
}

export interface PortDefinition {
	id: string;
	name: string;
	type: 'flow' | 'data';
	dataType?: string;
}

export interface ConfigField {
	name: string;
	label: string;
	type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json' | 'expression';
	required?: boolean;
	defaultValue?: unknown;
	options?: { value: string; label: string }[];
	placeholder?: string;
	helpText?: string;
}

// Node definitions registry
export const NODE_DEFINITIONS: NodeDefinition[] = [
	// Triggers
	{
		type: 'trigger_manual',
		category: 'trigger',
		name: 'Manual Trigger',
		description: 'Start workflow manually',
		icon: 'fa-hand-pointer',
		color: 'primary',
		inputs: [],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: []
	},
	{
		type: 'trigger_schedule',
		category: 'trigger',
		name: 'Schedule',
		description: 'Run on a schedule',
		icon: 'fa-clock',
		color: 'primary',
		inputs: [],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'cron', label: 'Cron Expression', type: 'text', required: true, placeholder: '0 9 * * *' },
			{ name: 'timezone', label: 'Timezone', type: 'select', options: [
				{ value: 'UTC', label: 'UTC' },
				{ value: 'America/New_York', label: 'Eastern Time' },
				{ value: 'America/Los_Angeles', label: 'Pacific Time' }
			]}
		]
	},
	{
		type: 'trigger_event',
		category: 'trigger',
		name: 'Event Trigger',
		description: 'Trigger on system event',
		icon: 'fa-bolt',
		color: 'primary',
		inputs: [],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'eventType', label: 'Event Type', type: 'select', required: true, options: [
				{ value: 'control.created', label: 'Control Created' },
				{ value: 'control.updated', label: 'Control Updated' },
				{ value: 'risk.created', label: 'Risk Created' },
				{ value: 'risk.updated', label: 'Risk Updated' },
				{ value: 'assessment.completed', label: 'Assessment Completed' },
				{ value: 'evidence.uploaded', label: 'Evidence Uploaded' },
				{ value: 'finding.created', label: 'Finding Created' }
			]}
		]
	},
	// Actions
	{
		type: 'action_create',
		category: 'action',
		name: 'Create Record',
		description: 'Create a new record',
		icon: 'fa-plus',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }, { id: 'record', name: 'Record', type: 'data' }],
		configSchema: [
			{ name: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [
				{ value: 'control', label: 'Control' },
				{ value: 'risk', label: 'Risk' },
				{ value: 'evidence', label: 'Evidence' },
				{ value: 'task', label: 'Task' }
			]},
			{ name: 'data', label: 'Record Data', type: 'json', required: true }
		]
	},
	{
		type: 'action_update',
		category: 'action',
		name: 'Update Record',
		description: 'Update an existing record',
		icon: 'fa-pen',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [
				{ value: 'control', label: 'Control' },
				{ value: 'risk', label: 'Risk' },
				{ value: 'evidence', label: 'Evidence' }
			]},
			{ name: 'recordId', label: 'Record ID', type: 'expression', required: true },
			{ name: 'updates', label: 'Updates', type: 'json', required: true }
		]
	},
	{
		type: 'action_assign',
		category: 'action',
		name: 'Assign',
		description: 'Assign to user or team',
		icon: 'fa-user-plus',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'assigneeType', label: 'Assignee Type', type: 'select', options: [
				{ value: 'user', label: 'User' },
				{ value: 'team', label: 'Team' },
				{ value: 'role', label: 'Role' }
			]},
			{ name: 'assignee', label: 'Assignee', type: 'expression', required: true }
		]
	},
	{
		type: 'action_notify',
		category: 'action',
		name: 'Send Notification',
		description: 'Send in-app notification',
		icon: 'fa-bell',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'recipients', label: 'Recipients', type: 'expression', required: true },
			{ name: 'title', label: 'Title', type: 'text', required: true },
			{ name: 'message', label: 'Message', type: 'textarea', required: true },
			{ name: 'priority', label: 'Priority', type: 'select', options: [
				{ value: 'low', label: 'Low' },
				{ value: 'medium', label: 'Medium' },
				{ value: 'high', label: 'High' }
			]}
		]
	},
	{
		type: 'action_email',
		category: 'action',
		name: 'Send Email',
		description: 'Send email notification',
		icon: 'fa-envelope',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'to', label: 'To', type: 'expression', required: true },
			{ name: 'subject', label: 'Subject', type: 'text', required: true },
			{ name: 'body', label: 'Body', type: 'textarea', required: true },
			{ name: 'template', label: 'Template', type: 'select', options: [] }
		]
	},
	{
		type: 'action_http',
		category: 'action',
		name: 'HTTP Request',
		description: 'Make HTTP API call',
		icon: 'fa-globe',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }, { id: 'response', name: 'Response', type: 'data' }],
		configSchema: [
			{ name: 'method', label: 'Method', type: 'select', required: true, options: [
				{ value: 'GET', label: 'GET' },
				{ value: 'POST', label: 'POST' },
				{ value: 'PUT', label: 'PUT' },
				{ value: 'PATCH', label: 'PATCH' },
				{ value: 'DELETE', label: 'DELETE' }
			]},
			{ name: 'url', label: 'URL', type: 'expression', required: true },
			{ name: 'headers', label: 'Headers', type: 'json' },
			{ name: 'body', label: 'Body', type: 'json' }
		]
	},
	// Logic
	{
		type: 'logic_condition',
		category: 'logic',
		name: 'Condition',
		description: 'Branch based on condition',
		icon: 'fa-code-branch',
		color: 'warning',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [
			{ id: 'true', name: 'True', type: 'flow' },
			{ id: 'false', name: 'False', type: 'flow' }
		],
		configSchema: [
			{ name: 'condition', label: 'Condition', type: 'expression', required: true, helpText: 'e.g., {{risk.severity}} == "high"' }
		]
	},
	{
		type: 'logic_switch',
		category: 'logic',
		name: 'Switch',
		description: 'Multiple branches',
		icon: 'fa-sitemap',
		color: 'warning',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [
			{ id: 'case1', name: 'Case 1', type: 'flow' },
			{ id: 'case2', name: 'Case 2', type: 'flow' },
			{ id: 'default', name: 'Default', type: 'flow' }
		],
		configSchema: [
			{ name: 'expression', label: 'Expression', type: 'expression', required: true },
			{ name: 'cases', label: 'Cases', type: 'json', required: true }
		]
	},
	{
		type: 'logic_loop',
		category: 'logic',
		name: 'Loop',
		description: 'Iterate over items',
		icon: 'fa-repeat',
		color: 'warning',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [
			{ id: 'item', name: 'Each Item', type: 'flow' },
			{ id: 'done', name: 'Done', type: 'flow' }
		],
		configSchema: [
			{ name: 'items', label: 'Items', type: 'expression', required: true },
			{ name: 'itemVar', label: 'Item Variable', type: 'text', defaultValue: 'item' }
		]
	},
	{
		type: 'logic_delay',
		category: 'logic',
		name: 'Delay',
		description: 'Wait before continuing',
		icon: 'fa-hourglass-half',
		color: 'warning',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }],
		configSchema: [
			{ name: 'duration', label: 'Duration', type: 'number', required: true },
			{ name: 'unit', label: 'Unit', type: 'select', options: [
				{ value: 'seconds', label: 'Seconds' },
				{ value: 'minutes', label: 'Minutes' },
				{ value: 'hours', label: 'Hours' },
				{ value: 'days', label: 'Days' }
			]}
		]
	},
	// Data
	{
		type: 'data_query',
		category: 'data',
		name: 'Query Data',
		description: 'Query records from database',
		icon: 'fa-database',
		color: 'secondary',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }, { id: 'results', name: 'Results', type: 'data' }],
		configSchema: [
			{ name: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [
				{ value: 'control', label: 'Controls' },
				{ value: 'risk', label: 'Risks' },
				{ value: 'evidence', label: 'Evidence' },
				{ value: 'assessment', label: 'Assessments' }
			]},
			{ name: 'filters', label: 'Filters', type: 'json' },
			{ name: 'limit', label: 'Limit', type: 'number', defaultValue: 100 }
		]
	},
	{
		type: 'data_transform',
		category: 'data',
		name: 'Transform',
		description: 'Transform data',
		icon: 'fa-wand-magic-sparkles',
		color: 'secondary',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }, { id: 'result', name: 'Result', type: 'data' }],
		configSchema: [
			{ name: 'input', label: 'Input', type: 'expression', required: true },
			{ name: 'transformation', label: 'Transformation', type: 'json', required: true }
		]
	},
	// Integration
	{
		type: 'integration_connector',
		category: 'integration',
		name: 'Connector',
		description: 'Run connector sync',
		icon: 'fa-plug',
		color: 'tertiary',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [{ id: 'out', name: 'Output', type: 'flow' }, { id: 'data', name: 'Data', type: 'data' }],
		configSchema: [
			{ name: 'connectorId', label: 'Connector', type: 'select', required: true, options: [] },
			{ name: 'operation', label: 'Operation', type: 'select', options: [
				{ value: 'sync', label: 'Full Sync' },
				{ value: 'fetch', label: 'Fetch Data' },
				{ value: 'push', label: 'Push Data' }
			]}
		]
	},
	// End nodes
	{
		type: 'end_success',
		category: 'end',
		name: 'Success',
		description: 'End workflow successfully',
		icon: 'fa-check-circle',
		color: 'success',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [],
		configSchema: [
			{ name: 'message', label: 'Success Message', type: 'text' }
		]
	},
	{
		type: 'end_failure',
		category: 'end',
		name: 'Failure',
		description: 'End with failure',
		icon: 'fa-times-circle',
		color: 'error',
		inputs: [{ id: 'in', name: 'Input', type: 'flow' }],
		outputs: [],
		configSchema: [
			{ name: 'message', label: 'Error Message', type: 'text' },
			{ name: 'notify', label: 'Notify on Failure', type: 'boolean', defaultValue: true }
		]
	}
];

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
	return NODE_DEFINITIONS.find((n) => n.type === type);
}

export function getNodesByCategory(category: string): NodeDefinition[] {
	return NODE_DEFINITIONS.filter((n) => n.category === category);
}

export const CATEGORY_COLORS: Record<string, string> = {
	trigger: 'primary',
	action: 'success',
	logic: 'warning',
	data: 'secondary',
	integration: 'tertiary',
	end: 'surface'
};

export const CATEGORY_ICONS: Record<string, string> = {
	trigger: 'fa-bolt',
	action: 'fa-play',
	logic: 'fa-code-branch',
	data: 'fa-database',
	integration: 'fa-plug',
	end: 'fa-flag-checkered'
};

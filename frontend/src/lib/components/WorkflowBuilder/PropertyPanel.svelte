<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkflowNodeData, NodeDefinition, ConfigField } from './index';
	import { getNodeDefinition, CATEGORY_COLORS } from './index';

	export let node: WorkflowNodeData | null = null;

	const dispatch = createEventDispatcher();

	$: definition = node ? getNodeDefinition(node.type) : null;
	$: config = node?.config || {};

	function updateConfig(field: string, value: unknown) {
		if (!node) return;
		dispatch('updateConfig', {
			nodeId: node.id,
			field,
			value
		});
	}

	function updateName(name: string) {
		if (!node) return;
		dispatch('updateName', { nodeId: node.id, name });
	}

	function parseJson(value: string): unknown {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	function stringifyJson(value: unknown): string {
		if (typeof value === 'string') return value;
		return JSON.stringify(value, null, 2);
	}
</script>

<div class="property-panel h-full flex flex-col">
	{#if node && definition}
		<!-- Header -->
		<div class="p-4 border-b border-surface-300 dark:border-surface-600">
			<div class="flex items-center gap-2 mb-2">
				<div class="w-8 h-8 rounded flex items-center justify-center variant-filled-{CATEGORY_COLORS[definition.category]}">
					<i class="fa-solid {definition.icon}"></i>
				</div>
				<div>
					<div class="font-semibold">{definition.name}</div>
					<div class="text-xs text-surface-500">{definition.category}</div>
				</div>
			</div>
			<p class="text-sm text-surface-500">{definition.description}</p>
		</div>

		<!-- Properties -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			<!-- Node Name -->
			<div class="form-field">
				<label class="label">
					<span class="text-sm font-medium">Node Name</span>
					<input
						type="text"
						class="input"
						value={node.name}
						oninput={(e) => updateName((e.target as HTMLInputElement).value)}
						placeholder={definition.name}
					/>
				</label>
			</div>

			<!-- Node ID (read-only) -->
			<div class="form-field">
				<label class="label">
					<span class="text-sm font-medium text-surface-500">Node ID</span>
					<input type="text" class="input input-sm" value={node.id} disabled />
				</label>
			</div>

			<!-- Config Fields -->
			{#if definition.configSchema.length > 0}
				<hr class="border-surface-300 dark:border-surface-600" />
				<h4 class="font-semibold text-sm">Configuration</h4>

				{#each definition.configSchema as field}
					<div class="form-field">
						<label class="label">
							<span class="text-sm font-medium">
								{field.label}
								{#if field.required}
									<span class="text-error-500">*</span>
								{/if}
							</span>

							{#if field.type === 'text'}
								<input
									type="text"
									class="input"
									value={config[field.name] || field.defaultValue || ''}
									oninput={(e) => updateConfig(field.name, (e.target as HTMLInputElement).value)}
									placeholder={field.placeholder}
								/>
							{:else if field.type === 'textarea'}
								<textarea
									class="textarea"
									rows="3"
									value={config[field.name] || field.defaultValue || ''}
									oninput={(e) => updateConfig(field.name, (e.target as HTMLTextAreaElement).value)}
									placeholder={field.placeholder}
								></textarea>
							{:else if field.type === 'number'}
								<input
									type="number"
									class="input"
									value={config[field.name] || field.defaultValue || ''}
									oninput={(e) => updateConfig(field.name, Number((e.target as HTMLInputElement).value))}
								/>
							{:else if field.type === 'boolean'}
								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										class="checkbox"
										checked={config[field.name] ?? field.defaultValue ?? false}
										onchange={(e) => updateConfig(field.name, (e.target as HTMLInputElement).checked)}
									/>
									<span class="text-sm">{field.helpText || ''}</span>
								</div>
							{:else if field.type === 'select'}
								<select
									class="select"
									value={config[field.name] || field.defaultValue || ''}
									onchange={(e) => updateConfig(field.name, (e.target as HTMLSelectElement).value)}
								>
									<option value="">Select...</option>
									{#each field.options || [] as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							{:else if field.type === 'multiselect'}
								<select
									class="select"
									multiple
									value={config[field.name] || []}
									onchange={(e) => {
										const select = e.target as HTMLSelectElement;
										const values = Array.from(select.selectedOptions).map((o) => o.value);
										updateConfig(field.name, values);
									}}
								>
									{#each field.options || [] as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							{:else if field.type === 'json'}
								<textarea
									class="textarea font-mono text-sm"
									rows="5"
									value={stringifyJson(config[field.name] || field.defaultValue || {})}
									oninput={(e) => updateConfig(field.name, parseJson((e.target as HTMLTextAreaElement).value))}
									placeholder={'{}'}
								></textarea>
							{:else if field.type === 'expression'}
								<div class="relative">
									<span class="absolute left-2 top-1/2 -translate-y-1/2 text-primary-500 text-sm">
										{'{{'}
									</span>
									<input
										type="text"
										class="input pl-7 pr-7 font-mono text-sm"
										value={config[field.name] || field.defaultValue || ''}
										oninput={(e) => updateConfig(field.name, (e.target as HTMLInputElement).value)}
										placeholder={field.placeholder}
									/>
									<span class="absolute right-2 top-1/2 -translate-y-1/2 text-primary-500 text-sm">
										{'}}'}
									</span>
								</div>
							{/if}

							{#if field.helpText && field.type !== 'boolean'}
								<span class="text-xs text-surface-500">{field.helpText}</span>
							{/if}
						</label>
					</div>
				{/each}
			{/if}

			<!-- Ports Info -->
			<hr class="border-surface-300 dark:border-surface-600" />
			<h4 class="font-semibold text-sm">Ports</h4>

			{#if definition.inputs.length > 0}
				<div class="text-sm">
					<span class="text-surface-500">Inputs:</span>
					{#each definition.inputs as port}
						<span class="badge variant-soft-surface ml-1">{port.name}</span>
					{/each}
				</div>
			{/if}

			{#if definition.outputs.length > 0}
				<div class="text-sm">
					<span class="text-surface-500">Outputs:</span>
					{#each definition.outputs as port}
						<span class="badge variant-soft-surface ml-1">{port.name}</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="p-4 border-t border-surface-300 dark:border-surface-600 space-y-2">
			<button class="btn variant-filled-primary w-full" onclick={() => dispatch('save', { nodeId: node?.id })}>
				<i class="fa-solid fa-save mr-1"></i>
				Save Changes
			</button>
			<button class="btn variant-ghost-error w-full" onclick={() => dispatch('delete', { nodeId: node?.id })}>
				<i class="fa-solid fa-trash mr-1"></i>
				Delete Node
			</button>
		</div>
	{:else}
		<!-- No Selection -->
		<div class="flex-1 flex flex-col items-center justify-center text-surface-500 p-4">
			<i class="fa-solid fa-mouse-pointer text-4xl mb-3"></i>
			<p class="text-center">Select a node to view and edit its properties</p>
		</div>
	{/if}
</div>

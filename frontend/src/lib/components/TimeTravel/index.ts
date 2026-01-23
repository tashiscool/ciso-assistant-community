export { default as TimeTravelPanel } from './TimeTravelPanel.svelte';
export { default as VersionTimeline } from './VersionTimeline.svelte';
export { default as VersionDiff } from './VersionDiff.svelte';
export { default as VersionCompare } from './VersionCompare.svelte';
export { default as SnapshotManager } from './SnapshotManager.svelte';

export interface Version {
	id: string;
	versionNumber: number;
	versionLabel?: string;
	changeType: 'create' | 'update' | 'delete' | 'restore' | 'import' | 'bulk';
	changeSummary: string;
	changeReason?: string;
	changedFields: string[];
	createdBy?: string;
	createdByName?: string;
	createdAt: string;
	snapshotData: Record<string, any>;
}

export interface Snapshot {
	id: string;
	versionNumber: number;
	name: string;
	description?: string;
	snapshotType: 'manual' | 'milestone' | 'release' | 'audit' | 'backup';
	externalReference?: string;
	createdBy?: string;
	createdByName?: string;
	createdAt: string;
	expiresAt?: string;
	isProtected: boolean;
}

export interface VersionDiffData {
	added: Record<string, any>;
	removed: Record<string, any>;
	changed: Record<string, { old: any; new: any }>;
}

export interface TimelineEntry {
	version: number;
	changeType: string;
	changeSummary: string;
	changedFields: string[];
	createdAt: string;
	createdBy?: string;
	diff?: VersionDiffData;
}

export const CHANGE_TYPE_COLORS: Record<string, string> = {
	create: 'variant-filled-success',
	update: 'variant-filled-primary',
	delete: 'variant-filled-error',
	restore: 'variant-filled-warning',
	import: 'variant-filled-secondary',
	bulk: 'variant-filled-tertiary'
};

export const CHANGE_TYPE_ICONS: Record<string, string> = {
	create: 'fa-plus-circle',
	update: 'fa-pen',
	delete: 'fa-trash',
	restore: 'fa-undo',
	import: 'fa-file-import',
	bulk: 'fa-layer-group'
};

export function formatVersionDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatFieldName(fieldName: string): string {
	return fieldName
		.replace(/_/g, ' ')
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

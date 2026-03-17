import type { User } from './types';

interface CanPerformActionParams {
	user: User;
	action: 'add' | 'view' | 'change' | 'delete';
	model: string; // lowercase domain name, e.g. riskassessment
	domain: string; // UUID
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
	if (!user) {
		return false;
	}
	if (user.is_admin) {
		return true;
	}
	const permissions = user.permissions as unknown;
	if (Array.isArray(permissions)) {
		return permissions.includes(permission);
	}
	if (permissions && typeof permissions === 'object') {
		return Object.hasOwn(permissions, permission);
	}
	return false;
}

export function hasModelPermission(
	user: User | null | undefined,
	action: 'add' | 'view' | 'change' | 'delete',
	model: string
): boolean {
	return hasPermission(user, `${action}_${model}`);
}

export function canPerformAction({ user, action, model, domain }: CanPerformActionParams): boolean {
	if (user.is_admin) {
		return true;
	}
	return (user.domain_permissions[domain] || []).includes(`${action}_${model}`);
}

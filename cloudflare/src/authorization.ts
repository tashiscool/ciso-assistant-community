import type { WorkerRequestContext } from './router';
import { json } from './utils/http';

const TENANT_ADMIN_PERMISSIONS = new Set([
  'add_user',
  'change_user',
  'delete_user',
  'add_role',
  'change_role',
  'delete_role',
]);

type PermissionRow = {
  permission: string;
};

type ScopedPermissionAssignmentRow = {
  permission: string;
  scope_folder_id: string;
  is_recursive: number;
};

type GroupMembershipIdRow = {
  group_id: string;
};

type RootFolderIdRow = {
  id: string;
};

type FolderRow = {
  id: string;
  parent_folder_id: string | null;
  content_type: string;
};

type PermissionContext = {
  tenantId: string;
  userId: string;
  permissions: string[];
};

export type ScopedPermissionContext = PermissionContext & {
  rootFolderId: string | null;
  accessibleFolderIds: string[];
  accessibleDomainIds: string[];
};

type FolderTreeContext = {
  rootFolderId: string | null;
  folderMap: Map<string, FolderRow>;
  getDescendantIds: (folderId: string, includeStart?: boolean) => string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

async function loadUserGroupIds(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const groupRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT membership.group_id
    FROM user_group_memberships AS membership
    INNER JOIN user_groups AS group_item
      ON group_item.id = membership.group_id
    WHERE membership.user_id = ? AND group_item.tenant_id = ?
    `,
  )
    .bind(userId, tenantId)
    .all<GroupMembershipIdRow>();

  return uniqueSorted(groupRows.results.map((row) => row.group_id));
}

async function loadFolderRows(ctx: WorkerRequestContext, tenantId: string): Promise<FolderRow[]> {
  const folderRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, parent_folder_id, content_type
    FROM folders
    WHERE tenant_id = ?
    `,
  )
    .bind(tenantId)
    .all<FolderRow>();

  return folderRows.results;
}

function buildFolderTree(rows: FolderRow[]): FolderTreeContext {
  const folderMap = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<string | null, string[]>();
  const rootFolderId =
    rows.find((row) => row.content_type === 'root' && row.parent_folder_id === null)?.id ?? null;

  for (const row of rows) {
    const children = childrenByParent.get(row.parent_folder_id) ?? [];
    children.push(row.id);
    childrenByParent.set(row.parent_folder_id, children);
  }

  function getDescendantIds(folderId: string, includeStart = true): string[] {
    const descendants: string[] = [];
    const queue = includeStart ? [folderId] : [...(childrenByParent.get(folderId) ?? [])];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }

      descendants.push(currentId);
      const children = childrenByParent.get(currentId) ?? [];
      for (const childId of children) {
        queue.push(childId);
      }
    }

    return descendants;
  }

  return {
    rootFolderId,
    folderMap,
    getDescendantIds,
  };
}

export async function loadPermissionContext(
  ctx: WorkerRequestContext,
  options: {
    scopeFolderId?: string | null;
  } = {},
): Promise<PermissionContext | Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const groupIds = await loadUserGroupIds(ctx, tenantId, userId);
  const conditions: string[] = ['assignment.user_id = ?'];
  const bindings: unknown[] = [tenantId];
  const scopeFolderId = options.scopeFolderId?.trim();

  if (scopeFolderId) {
    bindings.push(scopeFolderId);
  }

  bindings.push(userId);

  if (groupIds.length > 0) {
    conditions.push(`assignment.group_id IN (${groupIds.map(() => '?').join(', ')})`);
    bindings.push(...groupIds);
  }

  const permissionRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT DISTINCT role_permission.permission
    FROM role_assignments AS assignment
    INNER JOIN role_permissions AS role_permission
      ON role_permission.role_id = assignment.role_id
    WHERE assignment.tenant_id = ?
      ${scopeFolderId ? 'AND assignment.scope_folder_id = ?' : ''}
      AND (${conditions.join(' OR ')})
    `,
  )
    .bind(...bindings)
    .all<PermissionRow>();

  return {
    tenantId,
    userId,
    permissions: uniqueSorted(permissionRows.results.map((row) => row.permission)),
  };
}

export async function loadScopedPermissionContext(
  ctx: WorkerRequestContext,
  requiredPermissions: string[],
): Promise<ScopedPermissionContext | Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const normalizedPermissions = uniqueSorted(requiredPermissions);
  const [groupIds, folderRows] = await Promise.all([
    loadUserGroupIds(ctx, tenantId, userId),
    loadFolderRows(ctx, tenantId),
  ]);
  const folderTree = buildFolderTree(folderRows);

  if (normalizedPermissions.length === 0) {
    return {
      tenantId,
      userId,
      permissions: [],
      rootFolderId: folderTree.rootFolderId,
      accessibleFolderIds: [],
      accessibleDomainIds: [],
    };
  }

  const conditions: string[] = ['assignment.user_id = ?'];
  const bindings: unknown[] = [tenantId, userId];

  if (groupIds.length > 0) {
    conditions.push(`assignment.group_id IN (${groupIds.map(() => '?').join(', ')})`);
    bindings.push(...groupIds);
  }

  bindings.push(...normalizedPermissions);

  const assignmentRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT DISTINCT
      role_permission.permission,
      assignment.scope_folder_id,
      assignment.is_recursive
    FROM role_assignments AS assignment
    INNER JOIN role_permissions AS role_permission
      ON role_permission.role_id = assignment.role_id
    WHERE assignment.tenant_id = ?
      AND (${conditions.join(' OR ')})
      AND role_permission.permission IN (${normalizedPermissions.map(() => '?').join(', ')})
    `,
  )
    .bind(...bindings)
    .all<ScopedPermissionAssignmentRow>();

  const accessibleFolderIds = new Set<string>();
  const accessibleDomainIds = new Set<string>();

  for (const row of assignmentRows.results) {
    const affectedFolderIds = row.is_recursive
      ? folderTree.getDescendantIds(row.scope_folder_id)
      : [row.scope_folder_id];

    for (const folderId of affectedFolderIds) {
      const folder = folderTree.folderMap.get(folderId);
      if (!folder) {
        continue;
      }

      accessibleFolderIds.add(folderId);
      if (folder.content_type === 'domain') {
        accessibleDomainIds.add(folderId);
      }
    }
  }

  return {
    tenantId,
    userId,
    permissions: uniqueSorted(assignmentRows.results.map((row) => row.permission)),
    rootFolderId: folderTree.rootFolderId,
    accessibleFolderIds: uniqueSorted(accessibleFolderIds),
    accessibleDomainIds: uniqueSorted(accessibleDomainIds),
  };
}

export async function requireAnyPermission(
  ctx: WorkerRequestContext,
  requiredPermissions: string[],
  message = 'You do not have permission to perform this operation.',
): Promise<PermissionContext | Response> {
  const permissionContext = await loadPermissionContext(ctx);
  if (permissionContext instanceof Response) {
    return permissionContext;
  }

  const hasPermission = requiredPermissions.some((permission) =>
    permissionContext.permissions.includes(permission),
  );

  if (!hasPermission) {
    return json(
      {
        error: 'forbidden',
        message,
      },
      { status: 403 },
    );
  }

  return permissionContext;
}

export async function requireAnyScopedPermission(
  ctx: WorkerRequestContext,
  requiredPermissions: string[],
  message = 'You do not have permission to perform this operation.',
): Promise<ScopedPermissionContext | Response> {
  const permissionContext = await loadScopedPermissionContext(ctx, requiredPermissions);
  if (permissionContext instanceof Response) {
    return permissionContext;
  }

  const hasPermission = requiredPermissions.some((permission) =>
    permissionContext.permissions.includes(permission),
  );

  if (!hasPermission) {
    return json(
      {
        error: 'forbidden',
        message,
      },
      { status: 403 },
    );
  }

  return permissionContext;
}

export function requireTenant(ctx: WorkerRequestContext): string | Response {
  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }

  return ctx.tenantId;
}

export function requireUser(ctx: WorkerRequestContext): string | Response {
  if (!ctx.userId) {
    return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
  }

  return ctx.userId;
}

export async function requireRootAdminAccess(
  ctx: WorkerRequestContext,
  message = 'Tenant administrator access is required for this operation.',
): Promise<{ tenantId: string; userId: string; rootFolderId: string; permissions: string[] } | Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const rootFolder = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id
    FROM folders
    WHERE tenant_id = ? AND content_type = 'root'
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<RootFolderIdRow>();

  if (!rootFolder?.id) {
    return json(
      {
        error: 'missing_root_folder',
        message: 'Tenant root folder is required before this administrative surface can be used.',
      },
      { status: 409 },
    );
  }

  const permissionContext = await loadPermissionContext(ctx);
  if (permissionContext instanceof Response) {
    return permissionContext;
  }
  const { permissions } = permissionContext;
  const hasRootAdminAccess = permissions.some((permission) => TENANT_ADMIN_PERMISSIONS.has(permission));

  if (!hasRootAdminAccess) {
    return json(
      {
        error: 'forbidden',
        message,
      },
      { status: 403 },
    );
  }

  return {
    tenantId,
    userId,
    rootFolderId: rootFolder.id,
    permissions,
  };
}

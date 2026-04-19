import { requireRootAdminAccess } from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import type { EnvBindings } from '../../types/env';
import { sendWorkspaceAccessProvisionedEmail } from '../../email';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type FolderRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  content_type: string;
  parent_folder_id: string | null;
  is_builtin: number;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  locale: string | null;
  is_active: number;
  keep_local_login: number;
  is_third_party: number;
  is_auditee: number;
  preferences_json: string | null;
  created_at: string;
  updated_at: string;
};

type UserGroupRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  name: string;
  description: string | null;
  is_builtin: number;
  created_at: string;
  updated_at: string;
};

type UserMembershipRow = {
  user_id: string;
  group_id: string;
  group_name: string;
  group_description: string | null;
  folder_id: string;
  folder_name: string;
  is_builtin: number;
  user_email: string;
  user_display_name: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

type RoleRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  builtin: number;
  created_at: string;
};

type RolePermissionRow = {
  role_id: string;
  permission: string;
};

type RoleAssignmentRow = {
  id: string;
  tenant_id: string;
  role_id: string;
  role_name: string;
  role_description: string | null;
  role_builtin: number;
  user_id: string | null;
  group_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  group_name: string | null;
  scope_folder_id: string;
  scope_folder_name: string;
  scope_folder_content_type: string;
  assigned_by_user_id: string | null;
  is_recursive: number;
  is_builtin: number;
  created_at: string;
};

type CountRow = {
  key: string | null;
  count: number;
};

type FolderResponse = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  contentType: string;
  parentFolderId: string | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  pathLabel: string;
  depth: number;
  childCount: number;
};

type GroupSummary = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  isBuiltin: boolean;
};

type UserResponse = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  locale: string | null;
  isActive: boolean;
  keepLocalLogin: boolean;
  isThirdParty: boolean;
  isAuditee: boolean;
  preferences: {
    lang?: string;
  };
  createdAt: string;
  updatedAt: string;
  localPasswordConfigured: boolean;
  localPasswordResetRequired: boolean;
  localPasswordLockedUntil: string | null;
  localPasswordFailedAttempts: number;
  userGroups: GroupSummary[];
  groupCount: number;
  assignmentCount: number;
};

type LocalPasswordSummaryRow = {
  user_id: string;
  reset_required: number;
  failed_attempts: number;
  locked_until: string | null;
};

type UserGroupResponse = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  assignmentCount: number;
  members: Array<{
    id: string;
    displayName: string;
    email: string;
  }>;
};

type RoleResponse = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  createdAt: string;
  permissions: string[];
};

type RoleAssignmentResponse = {
  id: string;
  tenantId: string;
  roleId: string;
  roleName: string;
  roleDescription: string | null;
  isRoleBuiltin: boolean;
  principalType: 'user' | 'group';
  principalId: string;
  principalName: string;
  principalSecondary: string | null;
  scopeFolderId: string;
  scopeFolderName: string;
  scopeContentType: string;
  scopePathLabel: string;
  isRecursive: boolean;
  isBuiltin: boolean;
  createdAt: string;
  permissions: string[];
};

type IamMeData = {
  appEnv: string;
  authStrategy: string;
  isAuthenticated: boolean;
  userId: string | null;
  tenantId: string | null;
  profile: UserResponse | null;
  rootFolderId: string | null;
  permissions: string[];
  userGroups: GroupSummary[];
  accessibleDomains: FolderResponse[];
  domainPermissions: Record<string, string[]>;
  effectiveRoles: Array<{
    roleId: string;
    roleName: string;
    source: 'direct' | 'group';
    viaGroupId: string | null;
    viaGroupName: string | null;
    scopeFolderId: string;
    scopeFolderName: string;
    scopePathLabel: string;
    isRecursive: boolean;
    permissions: string[];
  }>;
  roleAssignments: RoleAssignmentResponse[];
};

type CreateFolderInput = {
  name?: string;
  description?: string;
  contentType?: string;
  parentFolderId?: string | null;
};

type CreateUserInput = {
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  keepLocalLogin?: boolean;
  isThirdParty?: boolean;
  isAuditee?: boolean;
  groupIds?: string[];
};

type CreateUserGroupInput = {
  name?: string;
  description?: string;
  folderId?: string;
  memberUserIds?: string[];
};

type CreateRoleInput = {
  name?: string;
  description?: string;
  permissions?: string[];
};

type CreateRoleAssignmentInput = {
  roleId?: string;
  userId?: string;
  groupId?: string;
  scopeFolderId?: string;
  isRecursive?: boolean;
};

type FolderTreeContext = {
  rootFolderId: string | null;
  folderMap: Map<string, FolderRow>;
  pathById: Map<string, string>;
  depthById: Map<string, number>;
  childCountById: Map<string, number>;
  getDescendantIds: (folderId: string, includeStart?: boolean) => string[];
};

const DEMO_IDS = {
  rootFolderId: 'folder-root-demo',
  governanceFolderId: 'folder-governance-demo',
  vendorFolderId: 'folder-vendor-demo',
  adminUserId: 'user-demo',
  analystUserId: 'user-analyst-demo',
  vendorUserId: 'user-vendor-demo',
  analystGroupId: 'user-group-analysts-demo',
  vendorGroupId: 'user-group-vendors-demo',
  administratorRoleId: 'role-administrator-demo',
  domainManagerRoleId: 'role-domain-manager-demo',
  analystRoleId: 'role-analyst-demo',
  readerRoleId: 'role-reader-demo',
  adminAssignmentId: 'role-assignment-admin-demo',
  analystAssignmentId: 'role-assignment-analyst-demo',
  vendorGroupAssignmentId: 'role-assignment-vendor-group-demo',
  vendorManagerAssignmentId: 'role-assignment-vendor-manager-demo',
};

const BUILTIN_ROLE_TEMPLATES = [
  {
    id: DEMO_IDS.administratorRoleId,
    name: 'Administrator',
    description: 'Full workspace administration across domains, teams, and operating modules.',
    permissions: [
      'view_folder',
      'add_folder',
      'change_folder',
      'delete_folder',
      'view_user',
      'add_user',
      'change_user',
      'delete_user',
      'view_usergroup',
      'add_usergroup',
      'change_usergroup',
      'delete_usergroup',
      'view_role',
      'add_role',
      'change_role',
      'delete_role',
      'view_roleassignment',
      'add_roleassignment',
      'change_roleassignment',
      'delete_roleassignment',
      'view_framework',
      'add_framework',
      'change_framework',
      'view_riskregister',
      'add_riskregister',
      'change_riskregister',
      'view_riskscenario',
      'add_riskscenario',
      'change_riskscenario',
      'view_entity',
      'add_entity',
      'change_entity',
      'view_solution',
      'add_solution',
      'change_solution',
      'view_contract',
      'add_contract',
      'change_contract',
      'view_entityassessment',
      'add_entityassessment',
      'change_entityassessment',
      'view_processing',
      'add_processing',
      'change_processing',
      'view_rightrequest',
      'add_rightrequest',
      'change_rightrequest',
      'view_databreach',
      'add_databreach',
      'change_databreach',
      'view_bia',
      'add_bia',
      'change_bia',
      'view_conmon',
      'run_conmon',
      'view_evidence',
      'collect_evidence',
    ],
  },
  {
    id: DEMO_IDS.domainManagerRoleId,
    name: 'Domain Manager',
    description: 'Manages a domain perimeter, team structure, and scoped access assignments.',
    permissions: [
      'view_folder',
      'add_folder',
      'change_folder',
      'view_user',
      'view_usergroup',
      'add_usergroup',
      'change_usergroup',
      'view_role',
      'view_roleassignment',
      'add_roleassignment',
      'change_roleassignment',
      'view_framework',
      'view_riskregister',
      'view_riskscenario',
      'view_entity',
      'view_solution',
      'view_contract',
      'view_entityassessment',
      'view_processing',
      'view_rightrequest',
      'view_databreach',
      'view_bia',
      'view_conmon',
      'view_evidence',
    ],
  },
  {
    id: DEMO_IDS.analystRoleId,
    name: 'Analyst',
    description: 'Operates the day-to-day governance, risk, monitoring, and evidence workflows.',
    permissions: [
      'view_folder',
      'view_framework',
      'add_framework',
      'change_framework',
      'view_riskregister',
      'add_riskregister',
      'change_riskregister',
      'view_riskscenario',
      'add_riskscenario',
      'change_riskscenario',
      'view_entity',
      'add_entity',
      'change_entity',
      'view_solution',
      'add_solution',
      'change_solution',
      'view_contract',
      'add_contract',
      'change_contract',
      'view_entityassessment',
      'add_entityassessment',
      'change_entityassessment',
      'view_processing',
      'add_processing',
      'change_processing',
      'view_rightrequest',
      'add_rightrequest',
      'change_rightrequest',
      'view_databreach',
      'add_databreach',
      'change_databreach',
      'view_bia',
      'add_bia',
      'change_bia',
      'view_conmon',
      'run_conmon',
      'view_evidence',
      'collect_evidence',
    ],
  },
  {
    id: DEMO_IDS.readerRoleId,
    name: 'Reader',
    description: 'Read-only access to a scoped domain perimeter.',
    permissions: [
      'view_folder',
      'view_framework',
      'view_riskregister',
      'view_riskscenario',
      'view_entity',
      'view_solution',
      'view_contract',
      'view_entityassessment',
      'view_processing',
      'view_rightrequest',
      'view_databreach',
      'view_bia',
      'view_conmon',
      'view_evidence',
    ],
  },
] as const;

function createPlaceholders(length: number): string {
  return Array.from({ length }, () => '?').join(', ');
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function isTruthy(value: boolean | undefined): number {
  return value ? 1 : 0;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeParsePreferences(value: string | null): { lang?: string } {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed.lang === 'string' ? { lang: parsed.lang } : {};
  } catch {
    return {};
  }
}

function getUserDisplayName(row: {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const explicit = row.display_name?.trim();
  if (explicit) {
    return explicit;
  }

  const fullName = [row.first_name?.trim(), row.last_name?.trim()].filter(Boolean).join(' ');
  if (fullName) {
    return fullName;
  }

  return row.email;
}

function toFolderTreeContext(rows: FolderRow[]): FolderTreeContext {
  const folderMap = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<string | null, FolderRow[]>();

  for (const row of rows) {
    const parentId = row.parent_folder_id;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(row);
    childrenByParent.set(parentId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.name.localeCompare(right.name));
  }

  const pathById = new Map<string, string>();
  const depthById = new Map<string, number>();
  const childCountById = new Map<string, number>();
  const rootFolderId =
    rows.find((row) => row.content_type === 'root' && row.parent_folder_id === null)?.id ?? null;

  function buildPath(folderId: string): string {
    const existing = pathById.get(folderId);
    if (existing) {
      return existing;
    }

    const row = folderMap.get(folderId);
    if (!row) {
      return '';
    }

    const parentPath = row.parent_folder_id ? buildPath(row.parent_folder_id) : '';
    const pathLabel = parentPath ? `${parentPath} / ${row.name}` : row.name;
    pathById.set(folderId, pathLabel);
    return pathLabel;
  }

  function buildDepth(folderId: string): number {
    const existing = depthById.get(folderId);
    if (existing !== undefined) {
      return existing;
    }

    const row = folderMap.get(folderId);
    if (!row) {
      return 0;
    }

    const depth = row.parent_folder_id ? buildDepth(row.parent_folder_id) + 1 : 0;
    depthById.set(folderId, depth);
    return depth;
  }

  function getDescendantIds(folderId: string, includeStart = true): string[] {
    const descendants: string[] = [];
    const queue = includeStart ? [folderId] : (childrenByParent.get(folderId) ?? []).map((row) => row.id);

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }

      descendants.push(currentId);
      const children = childrenByParent.get(currentId) ?? [];
      for (const child of children) {
        queue.push(child.id);
      }
    }

    return descendants;
  }

  for (const row of rows) {
    buildPath(row.id);
    buildDepth(row.id);
    childCountById.set(row.id, childrenByParent.get(row.id)?.length ?? 0);
  }

  return {
    rootFolderId,
    folderMap,
    pathById,
    depthById,
    childCountById,
    getDescendantIds,
  };
}

function toFolderResponse(row: FolderRow, tree: FolderTreeContext): FolderResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    contentType: row.content_type,
    parentFolderId: row.parent_folder_id,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pathLabel: tree.pathById.get(row.id) ?? row.name,
    depth: tree.depthById.get(row.id) ?? 0,
    childCount: tree.childCountById.get(row.id) ?? 0,
  };
}

async function fetchFolderRows(env: EnvBindings, tenantId: string): Promise<FolderRow[]> {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      name,
      description,
      content_type,
      parent_folder_id,
      is_builtin,
      created_at,
      updated_at
    FROM folders
    WHERE tenant_id = ?
    ORDER BY created_at ASC, name ASC
    `,
  )
    .bind(tenantId)
    .all<FolderRow>();

  return results;
}

async function fetchUserRows(env: EnvBindings, tenantId: string): Promise<UserRow[]> {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      email,
      display_name,
      first_name,
      last_name,
      locale,
      is_active,
      keep_local_login,
      is_third_party,
      is_auditee,
      preferences_json,
      created_at,
      updated_at
    FROM users
    WHERE tenant_id = ?
    ORDER BY COALESCE(display_name, email) ASC, email ASC
    `,
  )
    .bind(tenantId)
    .all<UserRow>();

  return results;
}

async function fetchUserMembershipRows(
  env: EnvBindings,
  tenantId: string,
): Promise<UserMembershipRow[]> {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      membership.user_id,
      group_item.id AS group_id,
      group_item.name AS group_name,
      group_item.description AS group_description,
      group_item.folder_id,
      folder_item.name AS folder_name,
      group_item.is_builtin,
      user_item.email AS user_email,
      user_item.display_name AS user_display_name,
      user_item.first_name AS user_first_name,
      user_item.last_name AS user_last_name
    FROM user_group_memberships AS membership
    INNER JOIN user_groups AS group_item
      ON group_item.id = membership.group_id
    INNER JOIN users AS user_item
      ON user_item.id = membership.user_id
    INNER JOIN folders AS folder_item
      ON folder_item.id = group_item.folder_id
    WHERE group_item.tenant_id = ? AND user_item.tenant_id = ?
    ORDER BY group_item.name ASC, user_item.email ASC
    `,
  )
    .bind(tenantId, tenantId)
    .all<UserMembershipRow>();

  return results;
}

async function fetchRoleRows(env: EnvBindings, tenantId: string): Promise<RoleRow[]> {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, name, description, builtin, created_at
    FROM roles
    WHERE tenant_id = ?
    ORDER BY builtin DESC, name ASC
    `,
  )
    .bind(tenantId)
    .all<RoleRow>();

  return results;
}

async function fetchRolePermissionMap(
  env: EnvBindings,
  roleIds: string[],
): Promise<Map<string, string[]>> {
  const permissionsByRole = new Map<string, string[]>();

  for (const roleId of roleIds) {
    permissionsByRole.set(roleId, []);
  }

  if (roleIds.length === 0) {
    return permissionsByRole;
  }

  const placeholders = createPlaceholders(roleIds.length);
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT role_id, permission
    FROM role_permissions
    WHERE role_id IN (${placeholders})
    ORDER BY permission ASC
    `,
  )
    .bind(...roleIds)
    .all<RolePermissionRow>();

  for (const row of results) {
    const permissions = permissionsByRole.get(row.role_id) ?? [];
    permissions.push(row.permission);
    permissionsByRole.set(row.role_id, permissions);
  }

  for (const [roleId, permissions] of permissionsByRole.entries()) {
    permissionsByRole.set(roleId, uniqueSorted(permissions));
  }

  return permissionsByRole;
}

async function fetchCountMap(
  env: EnvBindings,
  sql: string,
  bindings: unknown[],
): Promise<Map<string, number>> {
  const { results } = await env.D1_MAIN.prepare(sql).bind(...bindings).all<CountRow>();
  const counts = new Map<string, number>();

  for (const row of results) {
    if (row.key) {
      counts.set(row.key, row.count ?? 0);
    }
  }

  return counts;
}

async function fetchRoleAssignmentRows(
  env: EnvBindings,
  tenantId: string,
  options: {
    userId?: string;
    groupIds?: string[];
  } = {},
): Promise<RoleAssignmentRow[]> {
  const bindings: unknown[] = [tenantId];
  const conditions = ['assignment.tenant_id = ?'];

  if (options.userId && (options.groupIds?.length ?? 0) > 0) {
    const placeholders = createPlaceholders(options.groupIds!.length);
    conditions.push(`(assignment.user_id = ? OR assignment.group_id IN (${placeholders}))`);
    bindings.push(options.userId, ...options.groupIds!);
  } else if (options.userId) {
    conditions.push('assignment.user_id = ?');
    bindings.push(options.userId);
  } else if ((options.groupIds?.length ?? 0) > 0) {
    const placeholders = createPlaceholders(options.groupIds!.length);
    conditions.push(`assignment.group_id IN (${placeholders})`);
    bindings.push(...options.groupIds!);
  }

  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      assignment.id,
      assignment.tenant_id,
      assignment.role_id,
      role_item.name AS role_name,
      role_item.description AS role_description,
      role_item.builtin AS role_builtin,
      assignment.user_id,
      assignment.group_id,
      user_item.email AS user_email,
      user_item.display_name AS user_display_name,
      user_item.first_name AS user_first_name,
      user_item.last_name AS user_last_name,
      group_item.name AS group_name,
      assignment.scope_folder_id,
      scope_folder.name AS scope_folder_name,
      scope_folder.content_type AS scope_folder_content_type,
      assignment.assigned_by_user_id,
      assignment.is_recursive,
      assignment.is_builtin,
      assignment.created_at
    FROM role_assignments AS assignment
    INNER JOIN roles AS role_item
      ON role_item.id = assignment.role_id
    INNER JOIN folders AS scope_folder
      ON scope_folder.id = assignment.scope_folder_id
    LEFT JOIN users AS user_item
      ON user_item.id = assignment.user_id
    LEFT JOIN user_groups AS group_item
      ON group_item.id = assignment.group_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY assignment.created_at DESC, role_item.name ASC
    `,
  )
    .bind(...bindings)
    .all<RoleAssignmentRow>();

  return results;
}

function toGroupSummary(row: UserMembershipRow): GroupSummary {
  return {
    id: row.group_id,
    name: row.group_name,
    folderId: row.folder_id,
    folderName: row.folder_name,
    isBuiltin: row.is_builtin === 1,
  };
}

function toUserResponse(
  row: UserRow,
  groups: GroupSummary[],
  assignmentCount: number,
  localPasswordSummary?: LocalPasswordSummaryRow | null,
): UserResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: getUserDisplayName(row),
    firstName: row.first_name,
    lastName: row.last_name,
    locale: row.locale,
    isActive: row.is_active === 1,
    keepLocalLogin: row.keep_local_login === 1,
    isThirdParty: row.is_third_party === 1,
    isAuditee: row.is_auditee === 1,
    preferences: safeParsePreferences(row.preferences_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localPasswordConfigured: Boolean(localPasswordSummary),
    localPasswordResetRequired: localPasswordSummary?.reset_required === 1,
    localPasswordLockedUntil: localPasswordSummary?.locked_until ?? null,
    localPasswordFailedAttempts: localPasswordSummary?.failed_attempts ?? 0,
    userGroups: groups,
    groupCount: groups.length,
    assignmentCount,
  };
}

function toRoleResponse(row: RoleRow, permissions: string[]): RoleResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    isBuiltin: row.builtin === 1,
    createdAt: row.created_at,
    permissions,
  };
}

function toRoleAssignmentResponse(
  row: RoleAssignmentRow,
  permissions: string[],
  tree: FolderTreeContext,
): RoleAssignmentResponse {
  const principalType = row.user_id ? 'user' : 'group';
  const principalName = row.user_id
    ? getUserDisplayName({
        display_name: row.user_display_name,
        first_name: row.user_first_name,
        last_name: row.user_last_name,
        email: row.user_email ?? 'Unknown user',
      })
    : (row.group_name ?? 'Unknown group');

  return {
    id: row.id,
    tenantId: row.tenant_id,
    roleId: row.role_id,
    roleName: row.role_name,
    roleDescription: row.role_description,
    isRoleBuiltin: row.role_builtin === 1,
    principalType,
    principalId: row.user_id ?? row.group_id ?? '',
    principalName,
    principalSecondary: row.user_id ? row.user_email : null,
    scopeFolderId: row.scope_folder_id,
    scopeFolderName: row.scope_folder_name,
    scopeContentType: row.scope_folder_content_type,
    scopePathLabel: tree.pathById.get(row.scope_folder_id) ?? row.scope_folder_name,
    isRecursive: row.is_recursive === 1,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
    permissions,
  };
}

async function listFolders(
  env: EnvBindings,
  tenantId: string,
  contentTypes: string[] = [],
): Promise<FolderResponse[]> {
  const rows = await fetchFolderRows(env, tenantId);
  const tree = toFolderTreeContext(rows);
  const normalizedFilter = uniqueSorted(contentTypes.map((contentType) => contentType.toLowerCase()));

  return rows
    .filter((row) =>
      normalizedFilter.length === 0 ? true : normalizedFilter.includes(row.content_type.toLowerCase()),
    )
    .map((row) => toFolderResponse(row, tree))
    .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));
}

async function listUsers(env: EnvBindings, tenantId: string): Promise<UserResponse[]> {
  const [rows, membershipRows, directCounts, inheritedCounts, localPasswordRows] = await Promise.all([
    fetchUserRows(env, tenantId),
    fetchUserMembershipRows(env, tenantId),
    fetchCountMap(
      env,
      `
      SELECT user_id AS key, COUNT(*) AS count
      FROM role_assignments
      WHERE tenant_id = ? AND user_id IS NOT NULL
      GROUP BY user_id
      `,
      [tenantId],
    ),
    fetchCountMap(
      env,
      `
      SELECT membership.user_id AS key, COUNT(assignment.id) AS count
      FROM user_group_memberships AS membership
      INNER JOIN user_groups AS group_item
        ON group_item.id = membership.group_id
      INNER JOIN role_assignments AS assignment
        ON assignment.group_id = group_item.id
      WHERE group_item.tenant_id = ?
      GROUP BY membership.user_id
      `,
      [tenantId],
    ),
    env.D1_MAIN.prepare(
      `
      SELECT user_id, reset_required, failed_attempts, locked_until
      FROM local_password_credentials
      WHERE tenant_id = ?
      `,
    )
      .bind(tenantId)
      .all<LocalPasswordSummaryRow>(),
  ]);

  const groupsByUser = new Map<string, GroupSummary[]>();
  const passwordSummaryByUser = new Map<string, LocalPasswordSummaryRow>();

  for (const membershipRow of membershipRows) {
    const groups = groupsByUser.get(membershipRow.user_id) ?? [];
    groups.push(toGroupSummary(membershipRow));
    groupsByUser.set(membershipRow.user_id, groups);
  }

  for (const passwordRow of localPasswordRows.results ?? []) {
    if (passwordRow.user_id) {
      passwordSummaryByUser.set(passwordRow.user_id, passwordRow);
    }
  }

  return rows.map((row) => {
    const groups = groupsByUser.get(row.id) ?? [];
    const assignmentCount = (directCounts.get(row.id) ?? 0) + (inheritedCounts.get(row.id) ?? 0);
    return toUserResponse(row, groups, assignmentCount, passwordSummaryByUser.get(row.id));
  });
}

async function listUserGroups(env: EnvBindings, tenantId: string): Promise<UserGroupResponse[]> {
  const [groupsResult, membershipRows, assignmentCounts] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT
        group_item.id,
        group_item.tenant_id,
        group_item.folder_id,
        folder_item.name AS folder_name,
        group_item.name,
        group_item.description,
        group_item.is_builtin,
        group_item.created_at,
        group_item.updated_at
      FROM user_groups AS group_item
      INNER JOIN folders AS folder_item
        ON folder_item.id = group_item.folder_id
      WHERE group_item.tenant_id = ?
      ORDER BY folder_item.name ASC, group_item.name ASC
      `,
    )
      .bind(tenantId)
      .all<UserGroupRow>(),
    fetchUserMembershipRows(env, tenantId),
    fetchCountMap(
      env,
      `
      SELECT group_id AS key, COUNT(*) AS count
      FROM role_assignments
      WHERE tenant_id = ? AND group_id IS NOT NULL
      GROUP BY group_id
      `,
      [tenantId],
    ),
  ]);

  const membersByGroup = new Map<
    string,
    Array<{
      id: string;
      displayName: string;
      email: string;
    }>
  >();

  for (const membershipRow of membershipRows) {
    const members = membersByGroup.get(membershipRow.group_id) ?? [];
    members.push({
      id: membershipRow.user_id,
      displayName: getUserDisplayName({
        display_name: membershipRow.user_display_name,
        first_name: membershipRow.user_first_name,
        last_name: membershipRow.user_last_name,
        email: membershipRow.user_email,
      }),
      email: membershipRow.user_email,
    });
    membersByGroup.set(membershipRow.group_id, members);
  }

  return groupsResult.results.map((row) => {
    const members = membersByGroup.get(row.id) ?? [];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      folderId: row.folder_id,
      folderName: row.folder_name,
      name: row.name,
      description: row.description,
      isBuiltin: row.is_builtin === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: members.length,
      assignmentCount: assignmentCounts.get(row.id) ?? 0,
      members,
    };
  });
}

async function listRoles(env: EnvBindings, tenantId: string): Promise<RoleResponse[]> {
  const rows = await fetchRoleRows(env, tenantId);
  const permissionsByRole = await fetchRolePermissionMap(
    env,
    rows.map((row) => row.id),
  );

  return rows.map((row) => toRoleResponse(row, permissionsByRole.get(row.id) ?? []));
}

async function listRoleAssignments(
  env: EnvBindings,
  tenantId: string,
): Promise<RoleAssignmentResponse[]> {
  const [folderRows, assignmentRows] = await Promise.all([
    fetchFolderRows(env, tenantId),
    fetchRoleAssignmentRows(env, tenantId),
  ]);

  const tree = toFolderTreeContext(folderRows);
  const permissionsByRole = await fetchRolePermissionMap(
    env,
    uniqueSorted(assignmentRows.map((row) => row.role_id)),
  );

  return assignmentRows.map((row) =>
    toRoleAssignmentResponse(row, permissionsByRole.get(row.role_id) ?? [], tree),
  );
}

async function buildIamMeData(
  env: EnvBindings,
  ctx: WorkerRequestContext,
): Promise<IamMeData> {
  if (!ctx.tenantId || !ctx.userId) {
    return {
      appEnv: ctx.env.APP_ENV,
      authStrategy: ctx.authStrategy,
      isAuthenticated: false,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      profile: null,
      rootFolderId: null,
      permissions: [],
      userGroups: [],
      accessibleDomains: [],
      domainPermissions: {},
      effectiveRoles: [],
      roleAssignments: [],
    };
  }

  const [folderRows, userRow, membershipRows, localPasswordSummary] = await Promise.all([
    fetchFolderRows(env, ctx.tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT
        id,
        tenant_id,
        email,
        display_name,
        first_name,
        last_name,
        locale,
        is_active,
        keep_local_login,
        is_third_party,
        is_auditee,
        preferences_json,
        created_at,
        updated_at
      FROM users
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(ctx.tenantId, ctx.userId)
      .first<UserRow>(),
    fetchUserMembershipRows(env, ctx.tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT user_id, reset_required, failed_attempts, locked_until
      FROM local_password_credentials
      WHERE tenant_id = ? AND user_id = ?
      LIMIT 1
      `,
    )
      .bind(ctx.tenantId, ctx.userId)
      .first<LocalPasswordSummaryRow>(),
  ]);

  const tree = toFolderTreeContext(folderRows);

  if (!userRow) {
    return {
      appEnv: ctx.env.APP_ENV,
      authStrategy: ctx.authStrategy,
      isAuthenticated: false,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      profile: null,
      rootFolderId: tree.rootFolderId,
      permissions: [],
      userGroups: [],
      accessibleDomains: [],
      domainPermissions: {},
      effectiveRoles: [],
      roleAssignments: [],
    };
  }

  const userMemberships = membershipRows.filter((membership) => membership.user_id === ctx.userId);
  const userGroups = userMemberships.map((membership) => toGroupSummary(membership));
  const groupIds = userMemberships.map((membership) => membership.group_id);
  const assignmentRows = await fetchRoleAssignmentRows(env, ctx.tenantId, {
    userId: ctx.userId,
    groupIds,
  });
  const permissionsByRole = await fetchRolePermissionMap(
    env,
    uniqueSorted(assignmentRows.map((row) => row.role_id)),
  );

  const roleAssignments = assignmentRows.map((row) =>
    toRoleAssignmentResponse(row, permissionsByRole.get(row.role_id) ?? [], tree),
  );

  const profile = toUserResponse(userRow, userGroups, roleAssignments.length, localPasswordSummary);
  const permissionSet = new Set<string>();
  const domainPermissions = new Map<string, Set<string>>();

  for (const assignment of roleAssignments) {
    for (const permission of assignment.permissions) {
      permissionSet.add(permission);
    }

    const affectedFolderIds = assignment.isRecursive
      ? tree.getDescendantIds(assignment.scopeFolderId)
      : [assignment.scopeFolderId];

    for (const folderId of affectedFolderIds) {
      const folder = tree.folderMap.get(folderId);
      if (!folder || folder.content_type !== 'domain') {
        continue;
      }

      const permissions = domainPermissions.get(folderId) ?? new Set<string>();
      for (const permission of assignment.permissions) {
        permissions.add(permission);
      }
      domainPermissions.set(folderId, permissions);
    }
  }

  const accessibleDomains = [...domainPermissions.keys()]
    .map((folderId) => tree.folderMap.get(folderId))
    .filter((row): row is FolderRow => Boolean(row))
    .map((row) => toFolderResponse(row, tree))
    .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));

  return {
    appEnv: ctx.env.APP_ENV,
    authStrategy: ctx.authStrategy,
    isAuthenticated: true,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    profile,
    rootFolderId: tree.rootFolderId,
    permissions: uniqueSorted(permissionSet),
    userGroups,
    accessibleDomains,
    domainPermissions: Object.fromEntries(
      [...domainPermissions.entries()].map(([folderId, permissions]) => [
        folderId,
        uniqueSorted(permissions),
      ]),
    ),
    effectiveRoles: assignmentRows.map((row) => ({
      roleId: row.role_id,
      roleName: row.role_name,
      source: row.user_id ? ('direct' as const) : ('group' as const),
      viaGroupId: row.group_id,
      viaGroupName: row.group_name,
      scopeFolderId: row.scope_folder_id,
      scopeFolderName: row.scope_folder_name,
      scopePathLabel: tree.pathById.get(row.scope_folder_id) ?? row.scope_folder_name,
      isRecursive: row.is_recursive === 1,
      permissions: permissionsByRole.get(row.role_id) ?? [],
    })),
    roleAssignments,
  };
}

async function ensureFolderExists(
  env: EnvBindings,
  tenantId: string,
  folderId: string,
): Promise<FolderRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      name,
      description,
      content_type,
      parent_folder_id,
      is_builtin,
      created_at,
      updated_at
    FROM folders
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, folderId)
    .first<FolderRow>();
}

async function ensureUserExists(
  env: EnvBindings,
  tenantId: string,
  userId: string,
): Promise<UserRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      email,
      display_name,
      first_name,
      last_name,
      locale,
      is_active,
      keep_local_login,
      is_third_party,
      is_auditee,
      preferences_json,
      created_at,
      updated_at
    FROM users
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<UserRow>();
}

async function ensureGroupExists(
  env: EnvBindings,
  tenantId: string,
  groupId: string,
): Promise<UserGroupRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT
      group_item.id,
      group_item.tenant_id,
      group_item.folder_id,
      folder_item.name AS folder_name,
      group_item.name,
      group_item.description,
      group_item.is_builtin,
      group_item.created_at,
      group_item.updated_at
    FROM user_groups AS group_item
    INNER JOIN folders AS folder_item
      ON folder_item.id = group_item.folder_id
    WHERE group_item.tenant_id = ? AND group_item.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, groupId)
    .first<UserGroupRow>();
}

async function ensureRoleExists(
  env: EnvBindings,
  tenantId: string,
  roleId: string,
): Promise<RoleRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, name, description, builtin, created_at
    FROM roles
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, roleId)
    .first<RoleRow>();
}

async function loadSingleFolderResponse(
  env: EnvBindings,
  tenantId: string,
  folderId: string,
): Promise<FolderResponse | null> {
  const rows = await fetchFolderRows(env, tenantId);
  const tree = toFolderTreeContext(rows);
  const row = tree.folderMap.get(folderId);
  return row ? toFolderResponse(row, tree) : null;
}

async function loadSingleUserResponse(
  env: EnvBindings,
  tenantId: string,
  userId: string,
): Promise<UserResponse | null> {
  const users = await listUsers(env, tenantId);
  return users.find((user) => user.id === userId) ?? null;
}

async function loadSingleGroupResponse(
  env: EnvBindings,
  tenantId: string,
  groupId: string,
): Promise<UserGroupResponse | null> {
  const groups = await listUserGroups(env, tenantId);
  return groups.find((group) => group.id === groupId) ?? null;
}

async function loadSingleRoleResponse(
  env: EnvBindings,
  tenantId: string,
  roleId: string,
): Promise<RoleResponse | null> {
  const roles = await listRoles(env, tenantId);
  return roles.find((role) => role.id === roleId) ?? null;
}

async function loadSingleRoleAssignmentResponse(
  env: EnvBindings,
  tenantId: string,
  assignmentId: string,
): Promise<RoleAssignmentResponse | null> {
  const assignments = await listRoleAssignments(env, tenantId);
  return assignments.find((assignment) => assignment.id === assignmentId) ?? null;
}

export async function seedDemoIamWorkspace(env: EnvBindings): Promise<void> {
  const roleIds = BUILTIN_ROLE_TEMPLATES.map((role) => role.id);

  await env.D1_MAIN.prepare(
    `
    INSERT INTO folders (id, tenant_id, name, description, content_type, parent_folder_id, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      content_type = excluded.content_type,
      parent_folder_id = excluded.parent_folder_id,
      is_builtin = excluded.is_builtin,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `,
  )
    .bind(
      DEMO_IDS.rootFolderId,
      'tenant-demo',
      'Global Workspace',
      'Root perimeter for shared governance assets and tenant-wide administration.',
      'root',
      null,
    )
    .run();

  for (const [id, name, description] of [
    [
      DEMO_IDS.governanceFolderId,
      'Corporate Governance',
      'Primary domain for governance, risk, and compliance operations.',
    ],
    [
      DEMO_IDS.vendorFolderId,
      'Vendor Assurance',
      'Third-party oversight domain for suppliers, evidence, and external reviews.',
    ],
  ] as const) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO folders (id, tenant_id, name, description, content_type, parent_folder_id, is_builtin)
      VALUES (?, ?, ?, ?, 'domain', ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        content_type = excluded.content_type,
        parent_folder_id = excluded.parent_folder_id,
        is_builtin = excluded.is_builtin,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    )
      .bind(id, 'tenant-demo', name, description, DEMO_IDS.rootFolderId)
      .run();
  }

  for (const user of [
    {
      id: DEMO_IDS.adminUserId,
      email: 'demo@ciso-assistant.local',
      displayName: 'Demo Administrator',
      firstName: 'Demo',
      lastName: 'Administrator',
      locale: 'en',
      keepLocalLogin: 1,
      isThirdParty: 0,
      isAuditee: 0,
    },
    {
      id: DEMO_IDS.analystUserId,
      email: 'analyst@ciso-assistant.local',
      displayName: 'Governance Analyst',
      firstName: 'Governance',
      lastName: 'Analyst',
      locale: 'en',
      keepLocalLogin: 1,
      isThirdParty: 0,
      isAuditee: 0,
    },
    {
      id: DEMO_IDS.vendorUserId,
      email: 'vendor.owner@ciso-assistant.local',
      displayName: 'Vendor Owner',
      firstName: 'Vendor',
      lastName: 'Owner',
      locale: 'en',
      keepLocalLogin: 1,
      isThirdParty: 1,
      isAuditee: 1,
    },
  ] as const) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO users (
        id,
        tenant_id,
        email,
        display_name,
        first_name,
        last_name,
        locale,
        is_active,
        keep_local_login,
        is_third_party,
        is_auditee,
        preferences_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        locale = excluded.locale,
        is_active = excluded.is_active,
        keep_local_login = excluded.keep_local_login,
        is_third_party = excluded.is_third_party,
        is_auditee = excluded.is_auditee,
        preferences_json = excluded.preferences_json,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    )
      .bind(
        user.id,
        'tenant-demo',
        user.email,
        user.displayName,
        user.firstName,
        user.lastName,
        user.locale,
        user.keepLocalLogin,
        user.isThirdParty,
        user.isAuditee,
        JSON.stringify({ lang: user.locale }),
      )
      .run();
  }

  for (const role of BUILTIN_ROLE_TEMPLATES) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO roles (id, tenant_id, name, description, builtin)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        builtin = excluded.builtin
      `,
    )
      .bind(role.id, 'tenant-demo', role.name, role.description)
      .run();
  }

  const rolePlaceholders = createPlaceholders(roleIds.length);
  await env.D1_MAIN.prepare(
    `
    DELETE FROM role_permissions
    WHERE role_id IN (${rolePlaceholders})
    `,
  )
    .bind(...roleIds)
    .run();

  for (const role of BUILTIN_ROLE_TEMPLATES) {
    for (const permission of role.permissions) {
      await env.D1_MAIN.prepare(
        `
        INSERT OR IGNORE INTO role_permissions (role_id, permission)
        VALUES (?, ?)
        `,
      )
        .bind(role.id, permission)
        .run();
    }
  }

  for (const group of [
    {
      id: DEMO_IDS.analystGroupId,
      folderId: DEMO_IDS.governanceFolderId,
      name: 'Domain Analysts',
      description: 'Analysts who operate the primary governance and risk domain.',
    },
    {
      id: DEMO_IDS.vendorGroupId,
      folderId: DEMO_IDS.vendorFolderId,
      name: 'Vendor Reviewers',
      description: 'Reviewers and external stakeholders for the vendor assurance domain.',
    },
  ] as const) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO user_groups (id, tenant_id, folder_id, name, description, is_builtin)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        folder_id = excluded.folder_id,
        name = excluded.name,
        description = excluded.description,
        is_builtin = excluded.is_builtin,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    )
      .bind(group.id, 'tenant-demo', group.folderId, group.name, group.description)
      .run();
  }

  for (const [groupId, userId] of [
    [DEMO_IDS.analystGroupId, DEMO_IDS.analystUserId],
    [DEMO_IDS.vendorGroupId, DEMO_IDS.vendorUserId],
  ] as const) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO user_group_memberships (user_id, group_id)
      VALUES (?, ?)
      `,
    )
      .bind(userId, groupId)
      .run();
  }

  for (const assignment of [
    {
      id: DEMO_IDS.adminAssignmentId,
      roleId: DEMO_IDS.administratorRoleId,
      userId: DEMO_IDS.adminUserId,
      groupId: null,
      scopeFolderId: DEMO_IDS.rootFolderId,
      isRecursive: 1,
    },
    {
      id: DEMO_IDS.analystAssignmentId,
      roleId: DEMO_IDS.analystRoleId,
      userId: null,
      groupId: DEMO_IDS.analystGroupId,
      scopeFolderId: DEMO_IDS.governanceFolderId,
      isRecursive: 1,
    },
    {
      id: DEMO_IDS.vendorGroupAssignmentId,
      roleId: DEMO_IDS.readerRoleId,
      userId: null,
      groupId: DEMO_IDS.vendorGroupId,
      scopeFolderId: DEMO_IDS.vendorFolderId,
      isRecursive: 1,
    },
    {
      id: DEMO_IDS.vendorManagerAssignmentId,
      roleId: DEMO_IDS.domainManagerRoleId,
      userId: DEMO_IDS.vendorUserId,
      groupId: null,
      scopeFolderId: DEMO_IDS.vendorFolderId,
      isRecursive: 1,
    },
  ] as const) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO role_assignments (
        id,
        tenant_id,
        role_id,
        user_id,
        group_id,
        scope_folder_id,
        assigned_by_user_id,
        is_recursive,
        is_builtin
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        role_id = excluded.role_id,
        user_id = excluded.user_id,
        group_id = excluded.group_id,
        scope_folder_id = excluded.scope_folder_id,
        assigned_by_user_id = excluded.assigned_by_user_id,
        is_recursive = excluded.is_recursive,
        is_builtin = excluded.is_builtin
      `,
    )
      .bind(
        assignment.id,
        'tenant-demo',
        assignment.roleId,
        assignment.userId,
        assignment.groupId,
        assignment.scopeFolderId,
        DEMO_IDS.adminUserId,
        assignment.isRecursive,
      )
      .run();
  }
}

export async function handleIamRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id] = segments;

  if (resource === 'me') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const data = await buildIamMeData(ctx.env, ctx);
    return json({ data });
  }

  const adminAccess = await requireRootAdminAccess(
    ctx,
    'Tenant administrator access is required for workspace administration operations.',
  );
  if (adminAccess instanceof Response) {
    return adminAccess;
  }
  const { tenantId, userId: actorUserId } = adminAccess;

  if (resource === 'folders') {
    if (ctx.request.method === 'GET') {
      const contentTypes = ctx.url.searchParams.getAll('contentType');
      return json({
        data: await listFolders(ctx.env, tenantId, contentTypes),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = await readJson<CreateFolderInput>(ctx.request);
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_folder', message: 'Folder name is required.' },
          { status: 400 },
        );
      }

      const contentType = body.contentType?.trim().toLowerCase() || 'domain';
      if (!['root', 'domain', 'enclave'].includes(contentType)) {
        return json(
          { error: 'invalid_folder', message: 'contentType must be root, domain, or enclave.' },
          { status: 400 },
        );
      }

      const folderRows = await fetchFolderRows(ctx.env, tenantId);
      const tree = toFolderTreeContext(folderRows);
      let parentFolderId = body.parentFolderId?.trim() || null;

      if (contentType === 'root') {
        if (tree.rootFolderId) {
          return json(
            { error: 'root_exists', message: 'This tenant already has a root workspace folder.' },
            { status: 409 },
          );
        }
        parentFolderId = null;
      } else {
        parentFolderId ??= tree.rootFolderId;
        if (!parentFolderId) {
          return json(
            {
              error: 'missing_parent_folder',
              message: 'Create a root folder before adding domain or enclave folders.',
            },
            { status: 400 },
          );
        }

        const parentFolder = tree.folderMap.get(parentFolderId);
        if (!parentFolder) {
          return json(
            { error: 'parent_not_found', message: 'Selected parent folder was not found.' },
            { status: 404 },
          );
        }
      }

      const existingName = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM folders
        WHERE tenant_id = ?
          AND name = ?
          AND (
            (parent_folder_id IS NULL AND ? IS NULL)
            OR parent_folder_id = ?
          )
        LIMIT 1
        `,
      )
        .bind(tenantId, name, parentFolderId, parentFolderId)
        .first<{ id: string }>();

      if (existingName) {
        return json(
          {
            error: 'folder_exists',
            message: 'A folder with the same name already exists in that part of the workspace.',
          },
          { status: 409 },
        );
      }

      const folderId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO folders (id, tenant_id, name, description, content_type, parent_folder_id, is_builtin)
        VALUES (?, ?, ?, ?, ?, ?, 0)
        `,
      )
        .bind(
          folderId,
          tenantId,
          name,
          body.description?.trim() || null,
          contentType,
          parentFolderId,
        )
        .run();

      return json(
        {
          data: await loadSingleFolderResponse(ctx.env, tenantId, folderId),
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = await readJson<CreateFolderInput>(ctx.request);
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_folder', message: 'Folder name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE folders
        SET name = ?,
            description = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(name, body.description?.trim() || null, id, tenantId)
        .run();

      const updated = await loadSingleFolderResponse(ctx.env, tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM folders WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      )
        .bind(id, tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'users') {
    if (ctx.request.method === 'GET') {
      return json({
        data: await listUsers(ctx.env, tenantId),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = await readJson<CreateUserInput>(ctx.request);
      const email = body.email?.trim().toLowerCase();

      if (!email || !isValidEmail(email)) {
        return json(
          { error: 'invalid_user', message: 'A valid email address is required.' },
          { status: 400 },
        );
      }

      const existingUser = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM users
        WHERE tenant_id = ? AND email = ?
        LIMIT 1
        `,
      )
        .bind(tenantId, email)
        .first<{ id: string }>();

      if (existingUser) {
        return json(
          { error: 'user_exists', message: 'That email address already exists in this tenant.' },
          { status: 409 },
        );
      }

      const groupIds = uniqueSorted(body.groupIds ?? []);
      for (const groupId of groupIds) {
        const group = await ensureGroupExists(ctx.env, tenantId, groupId);
        if (!group) {
          return json(
            { error: 'group_not_found', message: `User group ${groupId} was not found.` },
            { status: 404 },
          );
        }
      }

      const firstName = body.firstName?.trim() || null;
      const lastName = body.lastName?.trim() || null;
      const displayName =
        body.displayName?.trim() ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        email;
      const locale = body.locale?.trim() || 'en';
      const userId = crypto.randomUUID();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO users (
          id,
          tenant_id,
          email,
          display_name,
          first_name,
          last_name,
          locale,
          is_active,
          keep_local_login,
          is_third_party,
          is_auditee,
          preferences_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `,
      )
        .bind(
          userId,
          tenantId,
          email,
          displayName,
          firstName,
          lastName,
          locale,
          isTruthy(body.keepLocalLogin),
          isTruthy(body.isThirdParty),
          isTruthy(body.isAuditee),
          JSON.stringify({ lang: locale }),
        )
        .run();

      for (const groupId of groupIds) {
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT OR IGNORE INTO user_group_memberships (user_id, group_id)
          VALUES (?, ?)
          `,
        )
          .bind(userId, groupId)
          .run();
      }

      const actorProfile = actorUserId
        ? await ctx.env.D1_MAIN.prepare(
            `
            SELECT display_name, email
            FROM users
            WHERE tenant_id = ? AND id = ?
            LIMIT 1
            `,
          )
            .bind(tenantId, actorUserId)
            .first<{ display_name: string | null; email: string | null }>()
        : null;

      try {
        await sendWorkspaceAccessProvisionedEmail(ctx.env, {
          tenantId,
          userId,
          email,
          displayName,
          actorName: actorProfile?.display_name?.trim() || actorProfile?.email?.trim() || 'Workspace administrator',
          baseOrigin: ctx.url.origin,
        });
      } catch (error) {
        console.error('Workspace access email failed', error);
      }

      return json(
        {
          data: await loadSingleUserResponse(ctx.env, tenantId, userId),
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = await readJson<CreateUserInput>(ctx.request);
      const firstName = body.firstName?.trim() || null;
      const lastName = body.lastName?.trim() || null;
      const displayName =
        body.displayName?.trim() ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        null;
      const locale = body.locale?.trim() || null;

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE users
        SET display_name = COALESCE(?, display_name),
            first_name = ?,
            last_name = ?,
            locale = COALESCE(?, locale),
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(displayName, firstName, lastName, locale, id, tenantId)
        .run();

      const updated = await loadSingleUserResponse(ctx.env, tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM users WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'user-groups') {
    if (ctx.request.method === 'GET') {
      return json({
        data: await listUserGroups(ctx.env, tenantId),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = await readJson<CreateUserGroupInput>(ctx.request);
      const name = body.name?.trim();
      const folderId = body.folderId?.trim();

      if (!name || !folderId) {
        return json(
          {
            error: 'invalid_user_group',
            message: 'User group name and folder scope are required.',
          },
          { status: 400 },
        );
      }

      const folder = await ensureFolderExists(ctx.env, tenantId, folderId);
      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'Selected folder scope was not found.' },
          { status: 404 },
        );
      }

      const existingGroup = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM user_groups
        WHERE tenant_id = ? AND folder_id = ? AND name = ?
        LIMIT 1
        `,
      )
        .bind(tenantId, folderId, name)
        .first<{ id: string }>();

      if (existingGroup) {
        return json(
          {
            error: 'group_exists',
            message: 'That group name already exists for the selected workspace folder.',
          },
          { status: 409 },
        );
      }

      const memberUserIds = uniqueSorted(body.memberUserIds ?? []);
      for (const userId of memberUserIds) {
        const user = await ensureUserExists(ctx.env, tenantId, userId);
        if (!user) {
          return json(
            { error: 'user_not_found', message: `User ${userId} was not found.` },
            { status: 404 },
          );
        }
      }

      const groupId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO user_groups (id, tenant_id, folder_id, name, description, is_builtin)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
      )
        .bind(groupId, tenantId, folderId, name, body.description?.trim() || null)
        .run();

      for (const userId of memberUserIds) {
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT OR IGNORE INTO user_group_memberships (user_id, group_id)
          VALUES (?, ?)
          `,
        )
          .bind(userId, groupId)
          .run();
      }

      return json(
        {
          data: await loadSingleGroupResponse(ctx.env, tenantId, groupId),
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = await readJson<CreateUserGroupInput>(ctx.request);
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_user_group', message: 'User group name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE user_groups
        SET name = ?,
            description = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(name, body.description?.trim() || null, id, tenantId)
        .run();

      const updated = await loadSingleGroupResponse(ctx.env, tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM user_groups WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      )
        .bind(id, tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'roles') {
    if (ctx.request.method === 'GET') {
      return json({
        data: await listRoles(ctx.env, tenantId),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = await readJson<CreateRoleInput>(ctx.request);
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_role', message: 'Role name is required.' },
          { status: 400 },
        );
      }

      const existingRole = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM roles
        WHERE tenant_id = ? AND name = ?
        LIMIT 1
        `,
      )
        .bind(tenantId, name)
        .first<{ id: string }>();

      if (existingRole) {
        return json(
          { error: 'role_exists', message: 'That role name already exists in this tenant.' },
          { status: 409 },
        );
      }

      const roleId = crypto.randomUUID();
      const permissions = uniqueSorted(body.permissions ?? []);

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO roles (id, tenant_id, name, description, builtin)
        VALUES (?, ?, ?, ?, 0)
        `,
      )
        .bind(roleId, tenantId, name, body.description?.trim() || null)
        .run();

      for (const permission of permissions) {
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT OR IGNORE INTO role_permissions (role_id, permission)
          VALUES (?, ?)
          `,
        )
          .bind(roleId, permission)
          .run();
      }

      return json(
        {
          data: await loadSingleRoleResponse(ctx.env, tenantId, roleId),
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = await readJson<CreateRoleInput>(ctx.request);
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_role', message: 'Role name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE roles
        SET name = ?,
            description = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(name, body.description?.trim() || null, id, tenantId)
        .run();

      const updated = await loadSingleRoleResponse(ctx.env, tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM roles WHERE id = ? AND tenant_id = ? AND builtin = 0`,
      )
        .bind(id, tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'role-assignments') {
    if (ctx.request.method === 'GET') {
      return json({
        data: await listRoleAssignments(ctx.env, tenantId),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = await readJson<CreateRoleAssignmentInput>(ctx.request);
      const roleId = body.roleId?.trim();
      const scopeFolderId = body.scopeFolderId?.trim();
      const userId = body.userId?.trim() || null;
      const groupId = body.groupId?.trim() || null;

      if (!roleId || !scopeFolderId) {
        return json(
          {
            error: 'invalid_role_assignment',
            message: 'Role and folder scope are required.',
          },
          { status: 400 },
        );
      }

      if ((userId && groupId) || (!userId && !groupId)) {
        return json(
          {
            error: 'invalid_role_assignment',
            message: 'Select exactly one principal: a user or a user group.',
          },
          { status: 400 },
        );
      }

      const [role, folder] = await Promise.all([
        ensureRoleExists(ctx.env, tenantId, roleId),
        ensureFolderExists(ctx.env, tenantId, scopeFolderId),
      ]);

      if (!role) {
        return json(
          { error: 'role_not_found', message: 'Selected role was not found.' },
          { status: 404 },
        );
      }

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'Selected folder scope was not found.' },
          { status: 404 },
        );
      }

      if (userId) {
        const user = await ensureUserExists(ctx.env, tenantId, userId);
        if (!user) {
          return json(
            { error: 'user_not_found', message: 'Selected user was not found.' },
            { status: 404 },
          );
        }
      }

      if (groupId) {
        const group = await ensureGroupExists(ctx.env, tenantId, groupId);
        if (!group) {
          return json(
            { error: 'group_not_found', message: 'Selected user group was not found.' },
            { status: 404 },
          );
        }
      }

      const assignmentId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO role_assignments (
          id,
          tenant_id,
          role_id,
          user_id,
          group_id,
          scope_folder_id,
          assigned_by_user_id,
          is_recursive,
          is_builtin
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
      )
        .bind(
          assignmentId,
          tenantId,
          roleId,
          userId,
          groupId,
          scopeFolderId,
          actorUserId,
          body.isRecursive === false ? 0 : 1,
        )
        .run();

      return json(
        {
          data: await loadSingleRoleAssignmentResponse(ctx.env, tenantId, assignmentId),
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM role_assignments WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      )
        .bind(id, tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}

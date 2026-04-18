export type WorkspaceFolder = {
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

export type WorkspaceGroupSummary = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  isBuiltin: boolean;
};

export type WorkspaceUser = {
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
  userGroups: WorkspaceGroupSummary[];
  groupCount: number;
  assignmentCount: number;
};

export type WorkspaceUserGroup = {
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

export type WorkspaceRole = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  createdAt: string;
  permissions: string[];
};

export type WorkspaceRoleAssignment = {
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

export type IamMePayload = {
  appEnv: string;
  authStrategy: string;
  isAuthenticated: boolean;
  userId: string | null;
  tenantId: string | null;
  profile: WorkspaceUser | null;
  rootFolderId: string | null;
  permissions: string[];
  userGroups: WorkspaceGroupSummary[];
  accessibleDomains: WorkspaceFolder[];
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
  roleAssignments: WorkspaceRoleAssignment[];
};

import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  IamMePayload,
  WorkspaceFolder,
  WorkspaceRole,
  WorkspaceRoleAssignment,
  WorkspaceUser,
  WorkspaceUserGroup,
} from './types';

const client = new ApiClient();

const TENANT_ADMIN_PERMISSIONS = new Set([
  'add_user',
  'change_user',
  'delete_user',
  'add_role',
  'change_role',
  'delete_role',
]);

function parsePermissions(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((value) => value.trim()).filter(Boolean))];
}

export function AccessPage() {
  const { identity } = useEdgeIdentity();
  const [me, setMe] = useState<IamMePayload | null>(null);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceRoleAssignment[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [groups, setGroups] = useState<WorkspaceUserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [destructiveBusy, setDestructiveBusy] = useState<string | null>(null);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);
  const [inspectedRole, setInspectedRole] = useState<WorkspaceRole | null>(null);
  const [rolePendingEdit, setRolePendingEdit] = useState<WorkspaceRole | null>(null);
  const [rolePendingDelete, setRolePendingDelete] = useState<WorkspaceRole | null>(null);
  const [inspectedAssignment, setInspectedAssignment] = useState<WorkspaceRoleAssignment | null>(null);
  const [assignmentPendingEdit, setAssignmentPendingEdit] =
    useState<WorkspaceRoleAssignment | null>(null);
  const [assignmentPendingDelete, setAssignmentPendingDelete] =
    useState<WorkspaceRoleAssignment | null>(null);
  const [roleEditBusy, setRoleEditBusy] = useState(false);
  const [assignmentEditBusy, setAssignmentEditBusy] = useState(false);

  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissionText, setPermissionText] = useState('view_folder');
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDescription, setEditRoleDescription] = useState('');
  const [editRolePermissionText, setEditRolePermissionText] = useState('');

  const [principalType, setPrincipalType] = useState<'user' | 'group'>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedScopeFolderId, setSelectedScopeFolderId] = useState('');
  const [isRecursive, setIsRecursive] = useState(true);
  const [editAssignmentPrincipalType, setEditAssignmentPrincipalType] = useState<'user' | 'group'>(
    'user',
  );
  const [editAssignmentUserId, setEditAssignmentUserId] = useState('');
  const [editAssignmentGroupId, setEditAssignmentGroupId] = useState('');
  const [editAssignmentRoleId, setEditAssignmentRoleId] = useState('');
  const [editAssignmentScopeFolderId, setEditAssignmentScopeFolderId] = useState('');
  const [editAssignmentIsRecursive, setEditAssignmentIsRecursive] = useState(true);

  const scopeFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'root' || folder.contentType === 'domain'),
    [folders],
  );
  const rootFolder = useMemo(
    () => folders.find((folder) => folder.id === me?.rootFolderId) ?? null,
    [folders, me?.rootFolderId],
  );
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );
  const selectedScopeFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedScopeFolderId) ?? null,
    [folders, selectedScopeFolderId],
  );
  const selectedRoleCarriesTenantAdmin = Boolean(
    selectedRole?.permissions.some((permission) => TENANT_ADMIN_PERMISSIONS.has(permission)),
  );
  const selectedAssignmentIsRootScoped = selectedScopeFolderId === me?.rootFolderId;
  const editAssignmentRole = useMemo(
    () => roles.find((role) => role.id === editAssignmentRoleId) ?? null,
    [editAssignmentRoleId, roles],
  );
  const editAssignmentScopeFolder = useMemo(
    () => folders.find((folder) => folder.id === editAssignmentScopeFolderId) ?? null,
    [editAssignmentScopeFolderId, folders],
  );
  const editAssignmentCarriesTenantAdmin = Boolean(
    editAssignmentRole?.permissions.some((permission) => TENANT_ADMIN_PERMISSIONS.has(permission)),
  );
  const editAssignmentIsRootScoped = editAssignmentScopeFolderId === me?.rootFolderId;
  const roleAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((assignment) => {
      counts.set(assignment.roleId, (counts.get(assignment.roleId) ?? 0) + 1);
    });
    return counts;
  }, [assignments]);

  async function loadAccessWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [meResponse, roleResponse, assignmentResponse, folderResponse, userResponse, groupResponse] =
        await Promise.all([
          client.get<{ data: IamMePayload }>('/iam/me'),
          client.get<{ data: WorkspaceRole[] }>('/iam/roles'),
          client.get<{ data: WorkspaceRoleAssignment[] }>('/iam/role-assignments'),
          client.get<{ data: WorkspaceFolder[] }>('/iam/folders'),
          client.get<{ data: WorkspaceUser[] }>('/iam/users'),
          client.get<{ data: WorkspaceUserGroup[] }>('/iam/user-groups'),
        ]);

      setMe(meResponse.data);
      setRoles(roleResponse.data);
      setAssignments(assignmentResponse.data);
      setFolders(folderResponse.data);
      setUsers(userResponse.data);
      setGroups(groupResponse.data);

      if (!selectedRoleId && roleResponse.data[0]?.id) {
        setSelectedRoleId(roleResponse.data[0].id);
      }
      if (!selectedScopeFolderId) {
        const defaultScope =
          folderResponse.data.find((folder) => folder.contentType === 'root') ??
          folderResponse.data.find((folder) => folder.contentType === 'domain');
        if (defaultScope) {
          setSelectedScopeFolderId(defaultScope.id);
        }
      }
      if (!selectedUserId && userResponse.data[0]?.id) {
        setSelectedUserId(userResponse.data[0].id);
      }
      if (!selectedGroupId && groupResponse.data[0]?.id) {
        setSelectedGroupId(groupResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccessWorkspace();
  }, [identity.tenantId, identity.userId]);

  async function createRole() {
    try {
      setRoleBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/iam/roles', {
        name: roleName,
        description: roleDescription,
        permissions: parsePermissions(permissionText),
      });
      setRoleName('');
      setRoleDescription('');
      setPermissionText('view_folder');
      setRoleDrawerOpen(false);
      setNotice('Role added to the access catalog.');
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRoleBusy(false);
    }
  }

  async function createAssignment() {
    try {
      setAssignmentBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/iam/role-assignments', {
        roleId: selectedRoleId,
        userId: principalType === 'user' ? selectedUserId : undefined,
        groupId: principalType === 'group' ? selectedGroupId : undefined,
        scopeFolderId: selectedScopeFolderId,
        isRecursive,
      });
      setAssignmentDrawerOpen(false);
      setNotice('Access assignment created.');
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAssignmentBusy(false);
    }
  }

  function openEditRole(role: WorkspaceRole) {
    setError(null);
    setNotice(null);
    setInspectedRole(null);
    setEditRoleName(role.name);
    setEditRoleDescription(role.description ?? '');
    setEditRolePermissionText(role.permissions.join('\n'));
    setRolePendingEdit(role);
  }

  async function updateRole(role: WorkspaceRole) {
    if (role.isBuiltin) {
      setError('Built-in roles cannot be edited.');
      return;
    }

    try {
      setRoleEditBusy(true);
      setError(null);
      setNotice(null);
      await client.put<{ data: WorkspaceRole }>(`/iam/roles/${role.id}`, {
        name: editRoleName,
        description: editRoleDescription,
        permissions: parsePermissions(editRolePermissionText),
      });
      setRolePendingEdit(null);
      setNotice(`Role "${editRoleName || role.name}" was updated.`);
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRoleEditBusy(false);
    }
  }

  async function deleteRole(role: WorkspaceRole) {
    try {
      setDestructiveBusy(role.id);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(`/iam/roles/${role.id}`);
      setRolePendingDelete(null);
      setInspectedRole((current) => (current?.id === role.id ? null : current));
      setNotice(`Role "${role.name}" was deleted.`);
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDestructiveBusy(null);
    }
  }

  function openEditAssignment(assignment: WorkspaceRoleAssignment) {
    setError(null);
    setNotice(null);
    setInspectedAssignment(null);
    setEditAssignmentPrincipalType(assignment.principalType);
    setEditAssignmentRoleId(assignment.roleId);
    setEditAssignmentScopeFolderId(assignment.scopeFolderId);
    setEditAssignmentIsRecursive(assignment.isRecursive);
    setEditAssignmentUserId(assignment.principalType === 'user' ? assignment.principalId : selectedUserId);
    setEditAssignmentGroupId(assignment.principalType === 'group' ? assignment.principalId : selectedGroupId);
    setAssignmentPendingEdit(assignment);
  }

  async function updateAssignment(assignment: WorkspaceRoleAssignment) {
    if (assignment.isBuiltin) {
      setError('Built-in role assignments cannot be edited.');
      return;
    }

    try {
      setAssignmentEditBusy(true);
      setError(null);
      setNotice(null);
      await client.put<{ data: WorkspaceRoleAssignment }>(`/iam/role-assignments/${assignment.id}`, {
        roleId: editAssignmentRoleId,
        userId: editAssignmentPrincipalType === 'user' ? editAssignmentUserId : undefined,
        groupId: editAssignmentPrincipalType === 'group' ? editAssignmentGroupId : undefined,
        scopeFolderId: editAssignmentScopeFolderId,
        isRecursive: editAssignmentIsRecursive,
      });
      setAssignmentPendingEdit(null);
      setNotice(`Assignment for ${assignment.principalName} was updated.`);
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAssignmentEditBusy(false);
    }
  }

  async function deleteAssignment(assignment: WorkspaceRoleAssignment) {
    try {
      setDestructiveBusy(assignment.id);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(
        `/iam/role-assignments/${assignment.id}`,
      );
      setAssignmentPendingDelete(null);
      setInspectedAssignment((current) => (current?.id === assignment.id ? null : current));
      setNotice(`Assignment for ${assignment.principalName} was removed.`);
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDestructiveBusy(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading access control workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Access Control</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
              Build the role catalog, assign principals to workspace scopes, and verify what the active
              identity can actually see and operate.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setRoleDrawerOpen(true)} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Add role
            </button>
            <button className="button-primary" onClick={() => setAssignmentDrawerOpen(true)} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Assign role
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[#d7c3f1] bg-[#f2e8ff] px-4 py-3 text-sm text-[#5f1aa8]">
          Tenant administration follows administrator permissions, not only root-folder placement.
          Scope still controls the regular workspace perimeter, but any assignment carrying tenant-admin
          permissions can open setup, IAM, and other tenant administration surfaces.
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Effective permissions</div>
          <div className="metric-value">{me?.permissions.length ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Accessible domains</div>
          <div className="metric-value">{me?.accessibleDomains.length ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Roles in catalog</div>
          <div className="metric-value">{roles.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active assignments</div>
          <div className="metric-value">{assignments.length}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Current Identity</div>
            <div className="mt-4 space-y-3">
              <div className="panel-subtle">
                <div className="font-medium text-[#241232]">{me?.profile?.displayName ?? identity.userId}</div>
                <div className="mt-1 text-xs text-[#6d28d9]">{me?.profile?.email ?? 'No profile loaded'}</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Accessible domains</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {me?.accessibleDomains.map((domain) => (
                    <span className="status-pill-neutral" key={domain.id}>
                      {domain.name}
                    </span>
                  ))}
                  {(me?.accessibleDomains.length ?? 0) === 0 && (
                    <span className="text-sm text-[#62576a]">No domains granted to this identity.</span>
                  )}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Permissions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {me?.permissions.slice(0, 18).map((permission) => (
                    <span className="status-pill-neutral" key={permission}>
                      {permission}
                    </span>
                  ))}
                  {(me?.permissions.length ?? 0) > 18 && (
                    <span className="text-xs text-[#62576a]">
                      +{(me?.permissions.length ?? 0) - 18} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-6">
          <section className="panel overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Assignments</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-t border-[#eeeaf2] align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#241232]">{role.name}</div>
                      <div className="mt-1 text-xs text-[#62576a]">{role.description}</div>
                    </td>
                    <td className="px-4 py-4 text-[#4f435c]">{role.permissions.length}</td>
                    <td className="px-4 py-4 text-[#4f435c]">
                      <RegStatusPill tone={role.isBuiltin ? 'info' : 'purple'}>
                        {role.isBuiltin ? 'Built-in' : 'Custom'}
                      </RegStatusPill>
                    </td>
                    <td className="px-4 py-4 text-[#4f435c]">
                      {roleAssignmentCounts.get(role.id) ?? 0}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <RegActionMenu
                          actions={[
                            {
                              icon: Eye,
                              label: 'Inspect role',
                              onSelect: () => setInspectedRole(role),
                            },
                            {
                              disabled: role.isBuiltin,
                              icon: Pencil,
                              label: role.isBuiltin ? 'Built-in role cannot be edited' : 'Edit role',
                              onSelect: () => openEditRole(role),
                            },
                            {
                              destructive: true,
                              disabled: role.isBuiltin,
                              icon: Trash2,
                              label: role.isBuiltin ? 'Built-in role cannot be deleted' : 'Delete role',
                              onSelect: () => setRolePendingDelete(role),
                            },
                          ]}
                          label={`Open actions for ${role.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </section>

      <section className="panel overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
            <tr>
              <th className="px-4 py-3">Principal</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t border-[#eeeaf2] align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-[#241232]">{assignment.principalName}</div>
                  <div className="mt-1 text-xs text-[#6d28d9]">
                    {assignment.principalType === 'user' ? 'User' : 'Group'}
                  </div>
                  {assignment.principalSecondary && (
                    <div className="mt-1 text-xs text-[#62576a]">{assignment.principalSecondary}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-[#4f435c]">
                  <div>{assignment.roleName}</div>
                  <div className="mt-1 text-xs text-[#62576a]">
                    {assignment.isRecursive ? 'Recursive' : 'Direct only'}
                  </div>
                  {assignment.permissions.some((permission) => TENANT_ADMIN_PERMISSIONS.has(permission)) ? (
                    <div className="mt-1 text-xs text-[#7a3ccf]">
                      Tenant admin enabled
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-[#4f435c]">
                  <div>{assignment.scopeFolderName}</div>
                  <div className="mt-1 text-xs text-[#62576a]">{assignment.scopePathLabel}</div>
                  {assignment.permissions.some((permission) => TENANT_ADMIN_PERMISSIONS.has(permission)) &&
                  assignment.scopeFolderId !== me?.rootFolderId ? (
                    <div className="mt-1 text-xs text-[#62576a]">
                      Admin surface access with scoped data perimeter
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-[#4f435c]">{assignment.permissions.length}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end">
                    <RegActionMenu
                      actions={[
                        {
                          icon: Eye,
                          label: 'Inspect assignment',
                          onSelect: () => setInspectedAssignment(assignment),
                        },
                        {
                          disabled: assignment.isBuiltin,
                          icon: Pencil,
                          label: assignment.isBuiltin
                            ? 'Built-in assignment cannot be edited'
                            : 'Edit assignment',
                          onSelect: () => openEditAssignment(assignment),
                        },
                        {
                          destructive: true,
                          disabled: assignment.isBuiltin,
                          icon: Trash2,
                          label: assignment.isBuiltin
                            ? 'Built-in assignment cannot be removed'
                            : 'Remove assignment',
                          onSelect: () => setAssignmentPendingDelete(assignment),
                        },
                      ]}
                      label={`Open actions for ${assignment.principalName}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={5}>
                  No access assignments found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <RegRightDrawer
        description="Create a reusable role catalog entry. Permissions can be comma-separated or entered one per line."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setRoleDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={roleBusy} form="access-create-role" type="submit">
              {roleBusy ? 'Saving...' : 'Add role'}
            </button>
          </div>
        }
        onOpenChange={setRoleDrawerOpen}
        open={roleDrawerOpen}
        title="Add role"
      >
        <form
          className="space-y-4"
          id="access-create-role"
          onSubmit={(event) => {
            event.preventDefault();
            void createRole();
          }}
        >
          <label className="space-y-1">
            <span className="label">Role name</span>
            <input
              className="input"
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="Evidence Operator"
              value={roleName}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[92px]"
              onChange={(event) => setRoleDescription(event.target.value)}
              placeholder="What should this role be able to do in the workspace?"
              value={roleDescription}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Permissions</span>
            <textarea
              className="input min-h-[120px] font-mono text-xs"
              onChange={(event) => setPermissionText(event.target.value)}
              placeholder={'view_evidence\ncollect_evidence\nview_folder'}
              value={permissionText}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update custom role metadata and permissions. Built-in role definitions remain locked."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setRolePendingEdit(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!rolePendingEdit || roleEditBusy || !editRoleName.trim()}
              form="access-edit-role"
              type="submit"
            >
              {roleEditBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setRolePendingEdit(null);
        }}
        open={Boolean(rolePendingEdit)}
        title="Edit role"
      >
        {rolePendingEdit ? (
          <form
            className="space-y-4"
            id="access-edit-role"
            onSubmit={(event) => {
              event.preventDefault();
              void updateRole(rolePendingEdit);
            }}
          >
            <div className="panel-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <RegStatusPill tone={rolePendingEdit.isBuiltin ? 'info' : 'purple'}>
                  {rolePendingEdit.isBuiltin ? 'Built-in' : 'Custom'}
                </RegStatusPill>
                <RegStatusPill tone={(roleAssignmentCounts.get(rolePendingEdit.id) ?? 0) > 0 ? 'success' : 'neutral'}>
                  {roleAssignmentCounts.get(rolePendingEdit.id) ?? 0} assignments
                </RegStatusPill>
              </div>
              <div className="mt-3 text-xs leading-5 text-[#62576a]">
                Permission changes apply to future effective-access calculations for this custom role.
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Role name</span>
              <input
                className="input"
                onChange={(event) => setEditRoleName(event.target.value)}
                value={editRoleName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[92px]"
                onChange={(event) => setEditRoleDescription(event.target.value)}
                value={editRoleDescription}
              />
            </label>
            <div>
              <label className="space-y-1">
                <span className="label">Permissions</span>
                <textarea
                  className="input min-h-[140px] font-mono text-xs"
                  onChange={(event) => setEditRolePermissionText(event.target.value)}
                  placeholder={'view_evidence\ncollect_evidence\nview_folder'}
                  value={editRolePermissionText}
                />
              </label>
            </div>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Assign a role to a user or group while preserving scoped and recursive access behavior."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setAssignmentDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={assignmentBusy} form="access-create-assignment" type="submit">
              {assignmentBusy ? 'Saving...' : 'Assign role'}
            </button>
          </div>
        }
        onOpenChange={setAssignmentDrawerOpen}
        open={assignmentDrawerOpen}
        title="Assign role"
      >
        <form
          className="space-y-4"
          id="access-create-assignment"
          onSubmit={(event) => {
            event.preventDefault();
            void createAssignment();
          }}
        >
          <label className="space-y-1">
            <span className="label">Principal type</span>
            <select
              className="input"
              onChange={(event) => setPrincipalType(event.target.value as 'user' | 'group')}
              value={principalType}
            >
              <option value="user">User</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Role</span>
            <select className="input" onChange={(event) => setSelectedRoleId(event.target.value)} value={selectedRoleId}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          {principalType === 'user' ? (
            <label className="space-y-1">
              <span className="label">User</span>
              <select className="input" onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ({user.email})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="label">Group</span>
              <select className="input" onChange={(event) => setSelectedGroupId(event.target.value)} value={selectedGroupId}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.folderName})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1">
            <span className="label">Folder scope</span>
            <select
              className="input"
              onChange={(event) => setSelectedScopeFolderId(event.target.value)}
              value={selectedScopeFolderId}
            >
              {scopeFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.pathLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="panel-subtle flex items-center gap-3">
            <input
              checked={isRecursive}
              className="h-4 w-4 accent-[#8b35e6]"
              onChange={(event) => setIsRecursive(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm text-[#4f435c]">Recursive scope</span>
          </label>

          {selectedRoleCarriesTenantAdmin ? (
            <div className="rounded-2xl border border-[#d7c3f1] bg-[#f2e8ff] px-4 py-3 text-sm text-[#5f1aa8]">
              {selectedAssignmentIsRootScoped
                ? `This assignment grants tenant administration and full workspace visibility from ${rootFolder?.name ?? 'the tenant root'}.`
                : `This assignment still unlocks tenant administration because ${selectedRole?.name ?? 'the selected role'} carries administrator permissions. The chosen scope continues to define the user's normal content perimeter: ${selectedScopeFolder?.pathLabel ?? 'selected scope'}.`}
            </div>
          ) : null}
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update a custom principal-to-role mapping while preserving the same scope rules used by new assignments."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setAssignmentPendingEdit(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={
                !assignmentPendingEdit ||
                assignmentEditBusy ||
                !editAssignmentRoleId ||
                !editAssignmentScopeFolderId ||
                (editAssignmentPrincipalType === 'user'
                  ? !editAssignmentUserId
                  : !editAssignmentGroupId)
              }
              form="access-edit-assignment"
              type="submit"
            >
              {assignmentEditBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setAssignmentPendingEdit(null);
        }}
        open={Boolean(assignmentPendingEdit)}
        title="Edit assignment"
      >
        {assignmentPendingEdit ? (
          <form
            className="space-y-4"
            id="access-edit-assignment"
            onSubmit={(event) => {
              event.preventDefault();
              void updateAssignment(assignmentPendingEdit);
            }}
          >
            <div className="panel-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <RegStatusPill tone={assignmentPendingEdit.isBuiltin ? 'info' : 'purple'}>
                  {assignmentPendingEdit.isBuiltin ? 'Built-in assignment' : 'Custom assignment'}
                </RegStatusPill>
                <RegStatusPill tone={assignmentPendingEdit.isRecursive ? 'success' : 'neutral'}>
                  {assignmentPendingEdit.isRecursive ? 'Currently recursive' : 'Currently direct only'}
                </RegStatusPill>
              </div>
              <div className="mt-3 text-xs leading-5 text-[#62576a]">
                Updating this assignment changes the effective access for the selected principal.
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Principal type</span>
              <select
                className="input"
                onChange={(event) => {
                  const nextType = event.target.value as 'user' | 'group';
                  setEditAssignmentPrincipalType(nextType);
                  if (nextType === 'user' && !editAssignmentUserId && users[0]?.id) {
                    setEditAssignmentUserId(users[0].id);
                  }
                  if (nextType === 'group' && !editAssignmentGroupId && groups[0]?.id) {
                    setEditAssignmentGroupId(groups[0].id);
                  }
                }}
                value={editAssignmentPrincipalType}
              >
                <option value="user">User</option>
                <option value="group">Group</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Role</span>
              <select
                className="input"
                onChange={(event) => setEditAssignmentRoleId(event.target.value)}
                value={editAssignmentRoleId}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            {editAssignmentPrincipalType === 'user' ? (
              <label className="space-y-1">
                <span className="label">User</span>
                <select
                  className="input"
                  onChange={(event) => setEditAssignmentUserId(event.target.value)}
                  value={editAssignmentUserId}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-1">
                <span className="label">Group</span>
                <select
                  className="input"
                  onChange={(event) => setEditAssignmentGroupId(event.target.value)}
                  value={editAssignmentGroupId}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.folderName})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1">
              <span className="label">Folder scope</span>
              <select
                className="input"
                onChange={(event) => setEditAssignmentScopeFolderId(event.target.value)}
                value={editAssignmentScopeFolderId}
              >
                {scopeFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.pathLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="panel-subtle flex items-center gap-3">
              <input
                checked={editAssignmentIsRecursive}
                className="h-4 w-4 accent-[#8b35e6]"
                onChange={(event) => setEditAssignmentIsRecursive(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-[#4f435c]">Recursive scope</span>
            </label>

            {editAssignmentCarriesTenantAdmin ? (
              <div className="rounded-2xl border border-[#d7c3f1] bg-[#f2e8ff] px-4 py-3 text-sm text-[#5f1aa8]">
                {editAssignmentIsRootScoped
                  ? `This assignment grants tenant administration and full workspace visibility from ${rootFolder?.name ?? 'the tenant root'}.`
                  : `This assignment still unlocks tenant administration because ${editAssignmentRole?.name ?? 'the selected role'} carries administrator permissions. The chosen scope continues to define the principal's normal content perimeter: ${editAssignmentScopeFolder?.pathLabel ?? 'selected scope'}.`}
              </div>
            ) : null}
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Review the role definition, assignment usage, and permissions before changing access."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {inspectedRole && !inspectedRole.isBuiltin ? (
              <button
                className="button-secondary"
                onClick={() => openEditRole(inspectedRole)}
                type="button"
              >
                Edit role
              </button>
            ) : null}
            {inspectedRole && !inspectedRole.isBuiltin ? (
              <button
                className="button-secondary text-[#9d1f2c]"
                onClick={() => setRolePendingDelete(inspectedRole)}
                type="button"
              >
                Delete role
              </button>
            ) : null}
            <button className="button-primary" onClick={() => setInspectedRole(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedRole(null);
        }}
        open={Boolean(inspectedRole)}
        title={inspectedRole?.name ?? 'Role details'}
      >
        {inspectedRole ? (
          <div className="space-y-5 text-sm text-[#4f435c]">
            <div className="panel-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <RegStatusPill tone={inspectedRole.isBuiltin ? 'info' : 'purple'}>
                  {inspectedRole.isBuiltin ? 'Built-in' : 'Custom'}
                </RegStatusPill>
                <RegStatusPill tone={(roleAssignmentCounts.get(inspectedRole.id) ?? 0) > 0 ? 'success' : 'neutral'}>
                  {roleAssignmentCounts.get(inspectedRole.id) ?? 0} assignments
                </RegStatusPill>
              </div>
              <p className="mt-3 leading-6">
                {inspectedRole.description || 'No description has been added for this role.'}
              </p>
              <div className="mt-3 text-xs text-[#62576a]">Created {inspectedRole.createdAt}</div>
            </div>
            <div>
              <div className="label">Permissions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {inspectedRole.permissions.map((permission) => (
                  <RegStatusPill
                    key={permission}
                    tone={TENANT_ADMIN_PERMISSIONS.has(permission) ? 'warning' : 'neutral'}
                  >
                    {permission}
                  </RegStatusPill>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Review who receives the role, the scope perimeter, and whether access is recursive."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {inspectedAssignment && !inspectedAssignment.isBuiltin ? (
              <button
                className="button-secondary"
                onClick={() => openEditAssignment(inspectedAssignment)}
                type="button"
              >
                Edit assignment
              </button>
            ) : null}
            {inspectedAssignment && !inspectedAssignment.isBuiltin ? (
              <button
                className="button-secondary text-[#9d1f2c]"
                onClick={() => setAssignmentPendingDelete(inspectedAssignment)}
                type="button"
              >
                Remove assignment
              </button>
            ) : null}
            <button className="button-primary" onClick={() => setInspectedAssignment(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedAssignment(null);
        }}
        open={Boolean(inspectedAssignment)}
        title={inspectedAssignment?.principalName ?? 'Assignment details'}
      >
        {inspectedAssignment ? (
          <div className="space-y-5 text-sm text-[#4f435c]">
            <div className="panel-subtle">
              <div className="font-semibold text-[#241232]">{inspectedAssignment.roleName}</div>
              <div className="mt-1 text-xs text-[#62576a]">
                {inspectedAssignment.principalType === 'user' ? 'User' : 'Group'}
                {inspectedAssignment.principalSecondary ? ` - ${inspectedAssignment.principalSecondary}` : ''}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RegStatusPill tone={inspectedAssignment.isRecursive ? 'success' : 'neutral'}>
                  {inspectedAssignment.isRecursive ? 'Recursive' : 'Direct only'}
                </RegStatusPill>
                <RegStatusPill tone={inspectedAssignment.isBuiltin ? 'info' : 'purple'}>
                  {inspectedAssignment.isBuiltin ? 'Built-in assignment' : 'Custom assignment'}
                </RegStatusPill>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Scope</div>
                <div className="mt-2 font-medium text-[#241232]">{inspectedAssignment.scopeFolderName}</div>
                <div className="mt-1 text-xs text-[#62576a]">{inspectedAssignment.scopePathLabel}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Role source</div>
                <div className="mt-2 font-medium text-[#241232]">
                  {inspectedAssignment.isRoleBuiltin ? 'Built-in role' : 'Custom role'}
                </div>
                <div className="mt-1 text-xs text-[#62576a]">Created {inspectedAssignment.createdAt}</div>
              </div>
            </div>
            <div>
              <div className="label">Effective permissions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {inspectedAssignment.permissions.map((permission) => (
                  <RegStatusPill
                    key={permission}
                    tone={TENANT_ADMIN_PERMISSIONS.has(permission) ? 'warning' : 'neutral'}
                  >
                    {permission}
                  </RegStatusPill>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="This removes the role from the catalog. Existing assignments may need to be removed first if the backend rejects the deletion."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setRolePendingDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary bg-[#9d1f2c] hover:bg-[#7c1822]"
              disabled={!rolePendingDelete || destructiveBusy === rolePendingDelete?.id}
              onClick={() => {
                if (rolePendingDelete) void deleteRole(rolePendingDelete);
              }}
              type="button"
            >
              {destructiveBusy === rolePendingDelete?.id ? 'Deleting...' : 'Delete role'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setRolePendingDelete(null);
        }}
        open={Boolean(rolePendingDelete)}
        title="Delete role"
      >
        {rolePendingDelete ? (
          <div className="space-y-3 text-sm text-[#4f435c]">
            <p>
              You are deleting <span className="font-semibold text-[#241232]">{rolePendingDelete.name}</span>.
            </p>
            <div className="panel-subtle">
              <div>{roleAssignmentCounts.get(rolePendingDelete.id) ?? 0} current assignments</div>
              <div>{rolePendingDelete.permissions.length} permissions</div>
              <div>{rolePendingDelete.description || 'No role description.'}</div>
            </div>
          </div>
        ) : null}
      </RegModal>

      <RegModal
        description="This removes one principal-to-role mapping while leaving the principal and role catalog entry intact."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setAssignmentPendingDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary bg-[#9d1f2c] hover:bg-[#7c1822]"
              disabled={!assignmentPendingDelete || destructiveBusy === assignmentPendingDelete?.id}
              onClick={() => {
                if (assignmentPendingDelete) void deleteAssignment(assignmentPendingDelete);
              }}
              type="button"
            >
              {destructiveBusy === assignmentPendingDelete?.id ? 'Removing...' : 'Remove assignment'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setAssignmentPendingDelete(null);
        }}
        open={Boolean(assignmentPendingDelete)}
        title="Remove assignment"
      >
        {assignmentPendingDelete ? (
          <div className="space-y-3 text-sm text-[#4f435c]">
            <p>
              Remove <span className="font-semibold text-[#241232]">{assignmentPendingDelete.roleName}</span>{' '}
              from <span className="font-semibold text-[#241232]">{assignmentPendingDelete.principalName}</span>?
            </p>
            <div className="panel-subtle">
              <div>Scope: {assignmentPendingDelete.scopePathLabel}</div>
              <div>{assignmentPendingDelete.isRecursive ? 'Recursive scope' : 'Direct scope only'}</div>
              <div>{assignmentPendingDelete.permissions.length} effective permissions</div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}

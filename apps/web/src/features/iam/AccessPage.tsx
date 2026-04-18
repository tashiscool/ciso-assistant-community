import { useEffect, useMemo, useState } from 'react';
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

  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissionText, setPermissionText] = useState('view_folder');

  const [principalType, setPrincipalType] = useState<'user' | 'group'>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedScopeFolderId, setSelectedScopeFolderId] = useState('');
  const [isRecursive, setIsRecursive] = useState(true);

  const scopeFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'root' || folder.contentType === 'domain'),
    [folders],
  );

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
          folderResponse.data.find((folder) => folder.contentType === 'domain') ??
          folderResponse.data.find((folder) => folder.contentType === 'root');
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
      setNotice('Access assignment created.');
      await loadAccessWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAssignmentBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading access control workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Workspace</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Access Control</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Build the role catalog, assign principals to workspace scopes, and verify what the active
          identity can actually see and operate.
        </p>
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
                <div className="font-medium text-white">{me?.profile?.displayName ?? identity.userId}</div>
                <div className="mt-1 text-xs text-cyan-200">{me?.profile?.email ?? 'No profile loaded'}</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Accessible domains</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {me?.accessibleDomains.map((domain) => (
                    <span className="badge-neutral" key={domain.id}>
                      {domain.name}
                    </span>
                  ))}
                  {(me?.accessibleDomains.length ?? 0) === 0 && (
                    <span className="text-sm text-slate-500">No domains granted to this identity.</span>
                  )}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Permissions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {me?.permissions.slice(0, 18).map((permission) => (
                    <span className="badge-neutral" key={permission}>
                      {permission}
                    </span>
                  ))}
                  {(me?.permissions.length ?? 0) > 18 && (
                    <span className="text-xs text-slate-500">
                      +{(me?.permissions.length ?? 0) - 18} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">New Role</div>
            <form
              className="mt-4 space-y-3"
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
              <button className="button-primary" disabled={roleBusy} type="submit">
                {roleBusy ? 'Saving...' : 'Add Role'}
              </button>
            </form>
          </section>
        </div>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">New Assignment</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createAssignment();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <select
                    className="input"
                    onChange={(event) => setSelectedRoleId(event.target.value)}
                    value={selectedRoleId}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {principalType === 'user' ? (
                <label className="space-y-1">
                  <span className="label">User</span>
                  <select
                    className="input"
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    value={selectedUserId}
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
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                    value={selectedGroupId}
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.folderName})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
                <label className="panel-subtle flex items-center gap-3 self-end">
                  <input
                    checked={isRecursive}
                    className="h-4 w-4 accent-cyan-400"
                    onChange={(event) => setIsRecursive(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-sm text-slate-300">Recursive scope</span>
                </label>
              </div>

              <button className="button-primary" disabled={assignmentBusy} type="submit">
                {assignmentBusy ? 'Saving...' : 'Assign Role'}
              </button>
            </form>
          </section>

          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Scope</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{role.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{role.description}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{role.permissions.length}</td>
                    <td className="px-4 py-4 text-slate-300">
                      {role.isBuiltin ? 'Built-in' : 'Custom'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </section>

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Principal</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Permissions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{assignment.principalName}</div>
                  <div className="mt-1 text-xs text-cyan-200">
                    {assignment.principalType === 'user' ? 'User' : 'Group'}
                  </div>
                  {assignment.principalSecondary && (
                    <div className="mt-1 text-xs text-slate-500">{assignment.principalSecondary}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-300">
                  <div>{assignment.roleName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {assignment.isRecursive ? 'Recursive' : 'Direct only'}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-300">
                  <div>{assignment.scopeFolderName}</div>
                  <div className="mt-1 text-xs text-slate-500">{assignment.scopePathLabel}</div>
                </td>
                <td className="px-4 py-4 text-slate-300">{assignment.permissions.length}</td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No access assignments found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

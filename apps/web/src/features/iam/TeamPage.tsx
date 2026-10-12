import { useEffect, useMemo, useState } from 'react';
import { Eye, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { getSetupSso } from '../setup/api';
import type { SetupSsoSnapshot } from '../setup/types';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder, WorkspaceUser, WorkspaceUserGroup } from './types';

const client = new ApiClient();

export function TeamPage() {
  const { identity } = useEdgeIdentity();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [groups, setGroups] = useState<WorkspaceUserGroup[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [ssoSnapshot, setSsoSnapshot] = useState<SetupSsoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userBusy, setUserBusy] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [inspectedUser, setInspectedUser] = useState<WorkspaceUser | null>(null);
  const [inspectedGroup, setInspectedGroup] = useState<WorkspaceUserGroup | null>(null);
  const [userPendingEdit, setUserPendingEdit] = useState<WorkspaceUser | null>(null);
  const [groupPendingEdit, setGroupPendingEdit] = useState<WorkspaceUserGroup | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<WorkspaceUser | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<WorkspaceUserGroup | null>(null);
  const [destructiveBusy, setDestructiveBusy] = useState<string | null>(null);
  const [userEditBusy, setUserEditBusy] = useState(false);
  const [groupEditBusy, setGroupEditBusy] = useState(false);
  const [passwordBusyUserId, setPasswordBusyUserId] = useState<string | null>(null);
  const [passwordFormUserId, setPasswordFormUserId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState('');
  const [temporaryPasswordRequireReset, setTemporaryPasswordRequireReset] = useState(true);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locale, setLocale] = useState('en');
  const [keepLocalLogin, setKeepLocalLogin] = useState(true);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [isAuditee, setIsAuditee] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupFolderId, setGroupFolderId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [editUserDisplayName, setEditUserDisplayName] = useState('');
  const [editUserFirstName, setEditUserFirstName] = useState('');
  const [editUserLastName, setEditUserLastName] = useState('');
  const [editUserLocale, setEditUserLocale] = useState('en');
  const [editUserGroupIds, setEditUserGroupIds] = useState<string[]>([]);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupFolderId, setEditGroupFolderId] = useState('');
  const [editGroupMemberIds, setEditGroupMemberIds] = useState<string[]>([]);

  const domainFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'domain' || folder.contentType === 'root'),
    [folders],
  );
  const passwordDrawerUser = useMemo(
    () => users.find((user) => user.id === passwordFormUserId) ?? null,
    [passwordFormUserId, users],
  );

  async function loadWorkspaceTeam() {
    try {
      setLoading(true);
      setError(null);
      const [userResponse, groupResponse, folderResponse, ssoResponse] = await Promise.all([
        client.get<{ data: WorkspaceUser[] }>('/iam/users'),
        client.get<{ data: WorkspaceUserGroup[] }>('/iam/user-groups'),
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders'),
        getSetupSso(),
      ]);
      setUsers(userResponse.data);
      setGroups(groupResponse.data);
      setFolders(folderResponse.data);
      setSsoSnapshot(ssoResponse);
      if (!groupFolderId) {
        const defaultFolder =
          folderResponse.data.find((folder) => folder.contentType === 'domain') ??
          folderResponse.data.find((folder) => folder.contentType === 'root');
        if (defaultFolder) {
          setGroupFolderId(defaultFolder.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaceTeam();
  }, [identity.tenantId, identity.userId]);

  const ssoProviderLabel = ssoSnapshot?.config.providerType || 'OIDC SSO';
  const tenantRequiresSso = Boolean(
    ssoSnapshot?.config.authProtocol === 'oidc' &&
      ssoSnapshot.config.runtimeReady &&
      ssoSnapshot.config.loginEnforced,
  );
  const tenantAllowsLocalFallback = !tenantRequiresSso || Boolean(ssoSnapshot?.config.allowLocalFallback);
  const localFallbackPolicyLocked = tenantRequiresSso && !tenantAllowsLocalFallback;

  useEffect(() => {
    if (localFallbackPolicyLocked && keepLocalLogin) {
      setKeepLocalLogin(false);
    }
  }, [keepLocalLogin, localFallbackPolicyLocked]);

  function toggleSelection(
    currentValues: string[],
    nextValue: string,
    setter: (values: string[]) => void,
  ) {
    setter(
      currentValues.includes(nextValue)
        ? currentValues.filter((value) => value !== nextValue)
        : [...currentValues, nextValue],
    );
  }

  async function createUser() {
    try {
      setUserBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/iam/users', {
        email,
        displayName,
        firstName,
        lastName,
        locale,
        keepLocalLogin: localFallbackPolicyLocked ? false : keepLocalLogin,
        isThirdParty,
        isAuditee,
        groupIds: selectedGroupIds,
      });
      setEmail('');
      setDisplayName('');
      setFirstName('');
      setLastName('');
      setLocale('en');
      setKeepLocalLogin(localFallbackPolicyLocked ? false : true);
      setIsThirdParty(false);
      setIsAuditee(false);
      setSelectedGroupIds([]);
      setUserDrawerOpen(false);
      setNotice('Team member added to the workspace.');
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUserBusy(false);
    }
  }

  async function createGroup() {
    try {
      setGroupBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/iam/user-groups', {
        name: groupName,
        description: groupDescription,
        folderId: groupFolderId,
        memberUserIds: selectedMemberIds,
      });
      setGroupName('');
      setGroupDescription('');
      setSelectedMemberIds([]);
      setGroupDrawerOpen(false);
      setNotice('User group created.');
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGroupBusy(false);
    }
  }

  function openEditUser(user: WorkspaceUser) {
    setError(null);
    setNotice(null);
    setInspectedUser(null);
    setEditUserDisplayName(user.displayName);
    setEditUserFirstName(user.firstName ?? '');
    setEditUserLastName(user.lastName ?? '');
    setEditUserLocale(user.locale ?? user.preferences.lang ?? 'en');
    setEditUserGroupIds(user.userGroups.map((group) => group.id));
    setUserPendingEdit(user);
  }

  async function updateUser(user: WorkspaceUser) {
    try {
      setUserEditBusy(true);
      setError(null);
      setNotice(null);
      await client.put<{ data: WorkspaceUser }>(`/iam/users/${user.id}`, {
        displayName: editUserDisplayName,
        firstName: editUserFirstName,
        lastName: editUserLastName,
        locale: editUserLocale,
        groupIds: editUserGroupIds,
      });
      setUserPendingEdit(null);
      setNotice(`${editUserDisplayName || user.displayName} was updated.`);
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUserEditBusy(false);
    }
  }

  function openEditGroup(group: WorkspaceUserGroup) {
    setError(null);
    setNotice(null);
    setInspectedGroup(null);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description ?? '');
    setEditGroupFolderId(group.folderId);
    setEditGroupMemberIds(group.members.map((member) => member.id));
    setGroupPendingEdit(group);
  }

  async function updateGroup(group: WorkspaceUserGroup) {
    if (group.isBuiltin) {
      setError('Built-in groups cannot be edited.');
      return;
    }

    try {
      setGroupEditBusy(true);
      setError(null);
      setNotice(null);
      await client.put<{ data: WorkspaceUserGroup }>(`/iam/user-groups/${group.id}`, {
        name: editGroupName,
        description: editGroupDescription,
        folderId: editGroupFolderId,
        memberUserIds: editGroupMemberIds,
      });
      setGroupPendingEdit(null);
      setNotice(`Group "${editGroupName || group.name}" was updated.`);
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGroupEditBusy(false);
    }
  }

  async function setTemporaryPasswordForUser(user: WorkspaceUser) {
    if (temporaryPassword !== confirmTemporaryPassword) {
      setError('Temporary password and confirmation must match.');
      setNotice(null);
      return;
    }

    try {
      setPasswordBusyUserId(user.id);
      setError(null);
      setNotice(null);
      await client.post('/core/local-auth/admin-set-password', {
        userId: user.id,
        newPassword: temporaryPassword,
        requireReset: temporaryPasswordRequireReset,
      });
      setTemporaryPassword('');
      setConfirmTemporaryPassword('');
      setTemporaryPasswordRequireReset(true);
      setPasswordFormUserId(null);
      setNotice(`Temporary local password updated for ${user.displayName}.`);
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPasswordBusyUserId(null);
    }
  }

  async function deleteUser(user: WorkspaceUser) {
    try {
      setDestructiveBusy(user.id);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(`/iam/users/${user.id}`);
      setUserPendingDelete(null);
      setInspectedUser((current) => (current?.id === user.id ? null : current));
      setNotice(`${user.displayName} was removed from the workspace.`);
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDestructiveBusy(null);
    }
  }

  async function deleteGroup(group: WorkspaceUserGroup) {
    try {
      setDestructiveBusy(group.id);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(`/iam/user-groups/${group.id}`);
      setGroupPendingDelete(null);
      setInspectedGroup((current) => (current?.id === group.id ? null : current));
      setNotice(`Group "${group.name}" was deleted.`);
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDestructiveBusy(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading team workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Team & Groups</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
              Add workspace members, define shared groups, and prepare the principal layer that scoped
              access control builds on.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setGroupDrawerOpen(true)} type="button">
              Create group
            </button>
            <button className="button-primary" onClick={() => setUserDrawerOpen(true)} type="button">
              Add team member
            </button>
          </div>
        </div>
        {tenantRequiresSso ? (
          <div className="mt-4 rounded-2xl border border-[#d7c3f1] bg-[#f2e8ff] px-4 py-3 text-sm text-[#5f1aa8]">
            {tenantAllowsLocalFallback
              ? `${ssoProviderLabel} is the primary sign-in path for this tenant. Users can link their workspace account by signing in with the same email address, and only explicitly enabled accounts keep local fallback.`
              : `${ssoProviderLabel} is required for normal sign-in in this tenant. Users added here should sign in with the same workspace email, and local password or email-code access is disabled by tenant policy.`}
          </div>
        ) : null}
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Team member</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Groups</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3">Local sign-in</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[#eeeaf2] align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#241232]">{user.displayName}</div>
                    <div className="mt-1 text-xs text-[#6d28d9]">{user.email}</div>
                    <div className="mt-2 text-xs text-[#62576a]">Joined {user.createdAt}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <RegStatusPill tone={user.isActive ? 'success' : 'warning'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </RegStatusPill>
                      {user.isThirdParty ? <RegStatusPill tone="info">Third-party</RegStatusPill> : null}
                      {user.isAuditee ? <RegStatusPill tone="purple">Auditee</RegStatusPill> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    {user.userGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.userGroups.map((group) => (
                          <RegStatusPill key={group.id}>
                            {group.name}
                          </RegStatusPill>
                        ))}
                      </div>
                    ) : (
                      'No groups'
                    )}
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    <div>
                      {tenantRequiresSso
                        ? tenantAllowsLocalFallback && user.keepLocalLogin
                          ? 'SSO preferred with local fallback'
                          : 'SSO managed by tenant policy'
                        : user.keepLocalLogin
                          ? 'Local login enabled'
                          : 'SSO-only ready'}
                    </div>
                    {tenantAllowsLocalFallback && user.keepLocalLogin && (
                      <div>{user.localPasswordConfigured ? 'Password configured' : 'Password pending'}</div>
                    )}
                    {tenantAllowsLocalFallback && user.keepLocalLogin && user.localPasswordResetRequired && (
                      <div>Password reset required</div>
                    )}
                    {tenantAllowsLocalFallback && user.keepLocalLogin && user.localPasswordLockedUntil && (
                      <div>Temporarily locked</div>
                    )}
                    <div>{user.isThirdParty ? 'Third-party' : 'Internal'}</div>
                    <div>{user.isAuditee ? 'Auditee' : 'Standard view'}</div>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">{user.assignmentCount}</td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    {tenantAllowsLocalFallback && user.keepLocalLogin ? (
                      <div className="space-y-3">
                        <div className="text-xs text-[#62576a]">
                          {user.localPasswordConfigured
                            ? `Failed attempts: ${user.localPasswordFailedAttempts}`
                            : 'No local password has been provisioned yet.'}
                        </div>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setError(null);
                            setNotice(null);
                            setTemporaryPassword('');
                            setConfirmTemporaryPassword('');
                            setTemporaryPasswordRequireReset(true);
                            setPasswordFormUserId(user.id);
                          }}
                          type="button"
                        >
                          {user.localPasswordConfigured ? 'Rotate Temp Password' : 'Set Temp Password'}
                        </button>
                      </div>
                    ) : localFallbackPolicyLocked ? (
                      <span className="text-xs text-[#62576a]">
                        Disabled by tenant SSO policy.
                      </span>
                    ) : (
                      <span className="text-xs text-[#62576a]">Managed by SSO policy.</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <RegActionMenu
                        actions={[
                          {
                            icon: Eye,
                            label: 'Inspect user',
                            onSelect: () => setInspectedUser(user),
                          },
                          {
                            icon: Pencil,
                            label: 'Edit user',
                            onSelect: () => openEditUser(user),
                          },
                          {
                            disabled: !(tenantAllowsLocalFallback && user.keepLocalLogin),
                            icon: KeyRound,
                            label: user.localPasswordConfigured
                              ? 'Rotate temporary password'
                              : 'Set temporary password',
                            onSelect: () => {
                              setError(null);
                              setNotice(null);
                              setTemporaryPassword('');
                              setConfirmTemporaryPassword('');
                              setTemporaryPasswordRequireReset(true);
                              setPasswordFormUserId(user.id);
                            },
                          },
                          {
                            destructive: true,
                            icon: Trash2,
                            label: 'Delete user',
                            onSelect: () => setUserPendingDelete(user),
                          },
                        ]}
                        label={`Open actions for ${user.displayName}`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={7}>
                    No team members found for tenant <span className="font-mono">{identity.tenantId}</span>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="eyebrow">Groups</div>
          <div className="mt-4 space-y-3">
            {groups.map((group) => (
              <div className="panel-subtle" key={group.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-[#241232]">{group.name}</div>
                    <div className="mt-1 text-xs text-[#6d28d9]">{group.folderName}</div>
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    <div className="text-right text-xs text-[#62576a]">
                      <div>{group.memberCount} members</div>
                      <div>{group.assignmentCount} assignments</div>
                    </div>
                    <RegActionMenu
                      actions={[
                        {
                          icon: Eye,
                          label: 'Inspect group',
                          onSelect: () => setInspectedGroup(group),
                        },
                        {
                          disabled: group.isBuiltin,
                          icon: Pencil,
                          label: group.isBuiltin ? 'Built-in group cannot be edited' : 'Edit group',
                          onSelect: () => openEditGroup(group),
                        },
                        {
                          destructive: true,
                          disabled: group.isBuiltin,
                          icon: Trash2,
                          label: group.isBuiltin ? 'Built-in group cannot be deleted' : 'Delete group',
                          onSelect: () => setGroupPendingDelete(group),
                        },
                      ]}
                      label={`Open actions for ${group.name}`}
                    />
                  </div>
                </div>
                {group.description && (
                  <div className="mt-3 text-sm leading-6 text-[#4f435c]">{group.description}</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <RegStatusPill key={member.id}>
                      {member.displayName}
                    </RegStatusPill>
                  ))}
                  {group.members.length === 0 && (
                    <span className="text-xs text-[#62576a]">No members yet.</span>
                  )}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="text-sm text-[#6f6578]">No user groups created yet.</div>
            )}
          </div>
        </section>
      </section>

      <RegRightDrawer
        description="Invite a workspace principal and optionally place them in existing user groups."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setUserDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={userBusy || !email.trim() || !displayName.trim()}
              form="team-member-form"
              type="submit"
            >
              {userBusy ? 'Saving...' : 'Add team member'}
            </button>
          </div>
        }
        onOpenChange={setUserDrawerOpen}
        open={userDrawerOpen}
        title="Add team member"
      >
        <form
          className="space-y-5"
          id="team-member-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createUser();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Email</span>
              <input
                className="input"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@company.com"
                type="email"
                value={email}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Display name</span>
              <input
                className="input"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Security Program Owner"
                value={displayName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">First name</span>
              <input
                className="input"
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Security"
                value={firstName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Last name</span>
              <input
                className="input"
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Owner"
                value={lastName}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Locale</span>
              <input
                className="input"
                onChange={(event) => setLocale(event.target.value)}
                placeholder="en"
                value={locale}
              />
            </label>
          </div>

          <div className="space-y-3 rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <label className="flex items-start gap-3 text-sm text-[#4f435c]">
              <input
                checked={localFallbackPolicyLocked ? false : keepLocalLogin}
                className="mt-1 h-4 w-4 accent-[#8b35e6]"
                disabled={localFallbackPolicyLocked}
                onChange={(event) => setKeepLocalLogin(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold text-[#241232]">Keep local fallback sign-in</span>
                {localFallbackPolicyLocked
                  ? 'Disabled by tenant SSO policy.'
                  : 'Allow admins to set a temporary local password for this user.'}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-[#4f435c]">
              <input
                checked={isThirdParty}
                className="mt-1 h-4 w-4 accent-[#8b35e6]"
                onChange={(event) => setIsThirdParty(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold text-[#241232]">Third-party identity</span>
                Mark the user as an external collaborator.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-[#4f435c]">
              <input
                checked={isAuditee}
                className="mt-1 h-4 w-4 accent-[#8b35e6]"
                onChange={(event) => setIsAuditee(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold text-[#241232]">Auditee view</span>
                Enable the narrower evidence-response experience for this user.
              </span>
            </label>
          </div>

          <div>
            <div className="label">Initial groups</div>
            <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-lg border border-[#ded8e4] p-3">
              {groups.map((group) => (
                <label className="flex items-center gap-3 text-sm text-[#4f435c]" key={group.id}>
                  <input
                    checked={selectedGroupIds.includes(group.id)}
                    className="h-4 w-4 accent-[#8b35e6]"
                    onChange={() => toggleSelection(selectedGroupIds, group.id, setSelectedGroupIds)}
                    type="checkbox"
                  />
                  <span>
                    <span className="font-medium text-[#241232]">{group.name}</span>
                    <span className="ml-2 text-xs text-[#62576a]">{group.folderName}</span>
                  </span>
                </label>
              ))}
              {groups.length === 0 && (
                <div className="text-sm text-[#6f6578]">No groups are available yet.</div>
              )}
            </div>
          </div>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update workspace profile fields and group membership. Email and local sign-in policy stay in their dedicated flows."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setUserPendingEdit(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!userPendingEdit || userEditBusy || !editUserDisplayName.trim()}
              form="team-edit-user-form"
              type="submit"
            >
              {userEditBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setUserPendingEdit(null);
        }}
        open={Boolean(userPendingEdit)}
        title="Edit team member"
      >
        {userPendingEdit ? (
          <form
            className="space-y-5"
            id="team-edit-user-form"
            onSubmit={(event) => {
              event.preventDefault();
              void updateUser(userPendingEdit);
            }}
          >
            <div className="panel-subtle">
              <div className="label">Email</div>
              <div className="mt-1 font-medium text-[#241232]">{userPendingEdit.email}</div>
              <div className="mt-2 text-xs leading-5 text-[#62576a]">
                Email and sign-in policy are preserved by this edit flow.
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Display name</span>
              <input
                className="input"
                onChange={(event) => setEditUserDisplayName(event.target.value)}
                value={editUserDisplayName}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">First name</span>
                <input
                  className="input"
                  onChange={(event) => setEditUserFirstName(event.target.value)}
                  value={editUserFirstName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Last name</span>
                <input
                  className="input"
                  onChange={(event) => setEditUserLastName(event.target.value)}
                  value={editUserLastName}
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Locale</span>
              <input
                className="input"
                onChange={(event) => setEditUserLocale(event.target.value)}
                placeholder="en"
                value={editUserLocale}
              />
            </label>
            <div>
              <div className="label">Groups</div>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-lg border border-[#ded8e4] p-3">
                {groups.map((group) => (
                  <label className="flex items-center gap-3 text-sm text-[#4f435c]" key={group.id}>
                    <input
                      checked={editUserGroupIds.includes(group.id)}
                      className="h-4 w-4 accent-[#8b35e6]"
                      onChange={() => toggleSelection(editUserGroupIds, group.id, setEditUserGroupIds)}
                      type="checkbox"
                    />
                    <span>
                      <span className="font-medium text-[#241232]">{group.name}</span>
                      <span className="ml-2 text-xs text-[#62576a]">{group.folderName}</span>
                    </span>
                  </label>
                ))}
                {groups.length === 0 ? (
                  <div className="text-sm text-[#6f6578]">No groups are available yet.</div>
                ) : null}
              </div>
            </div>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description={
          passwordDrawerUser
            ? `Set a temporary local password for ${passwordDrawerUser.displayName}.`
            : 'Set a temporary local password for a workspace user.'
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              onClick={() => {
                setPasswordFormUserId(null);
                setTemporaryPassword('');
                setConfirmTemporaryPassword('');
                setTemporaryPasswordRequireReset(true);
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={
                !passwordDrawerUser ||
                passwordBusyUserId === passwordDrawerUser.id ||
                !temporaryPassword ||
                !confirmTemporaryPassword
              }
              form="temporary-password-form"
              type="submit"
            >
              {passwordDrawerUser && passwordBusyUserId === passwordDrawerUser.id ? 'Saving...' : 'Save password'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setPasswordFormUserId(null);
            setTemporaryPassword('');
            setConfirmTemporaryPassword('');
            setTemporaryPasswordRequireReset(true);
          }
        }}
        open={Boolean(passwordDrawerUser)}
        title="Set temporary password"
      >
        {passwordDrawerUser ? (
          <form
            className="space-y-5"
            id="temporary-password-form"
            onSubmit={(event) => {
              event.preventDefault();
              void setTemporaryPasswordForUser(passwordDrawerUser);
            }}
          >
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{passwordDrawerUser.displayName}</div>
              <div className="mt-1 text-sm text-[#6d28d9]">{passwordDrawerUser.email}</div>
              <div className="mt-3 text-xs leading-5 text-[#62576a]">
                Temporary passwords are only available when local fallback sign-in is allowed for the tenant and
                explicitly enabled for the user.
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Temporary password</span>
              <input
                className="input"
                onChange={(event) => setTemporaryPassword(event.target.value)}
                type="password"
                value={temporaryPassword}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Confirm password</span>
              <input
                className="input"
                onChange={(event) => setConfirmTemporaryPassword(event.target.value)}
                type="password"
                value={confirmTemporaryPassword}
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-[#4f435c]">
              <input
                checked={temporaryPasswordRequireReset}
                className="h-4 w-4 accent-[#8b35e6]"
                onChange={(event) => setTemporaryPasswordRequireReset(event.target.checked)}
                type="checkbox"
              />
              Require the user to rotate it after sign-in
            </label>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Group users under a scope so access and assignments can be managed together."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setGroupDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={groupBusy || !groupName.trim()}
              form="team-group-form"
              type="submit"
            >
              {groupBusy ? 'Saving...' : 'Create group'}
            </button>
          </div>
        }
        onOpenChange={setGroupDrawerOpen}
        open={groupDrawerOpen}
        title="Create group"
      >
        <form
          className="space-y-5"
          id="team-group-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createGroup();
          }}
        >
          <label className="space-y-1">
            <span className="label">Group name</span>
            <input
              className="input"
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Vendor Reviewers"
              value={groupName}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setGroupDescription(event.target.value)}
              placeholder="Review and approve vendor questionnaire responses."
              value={groupDescription}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Scope folder</span>
            <select
              className="input"
              onChange={(event) => setGroupFolderId(event.target.value)}
              value={groupFolderId}
            >
              {domainFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="label">Members</div>
            <div className="mt-2 max-h-64 space-y-2 overflow-auto rounded-lg border border-[#ded8e4] p-3">
              {users.map((user) => (
                <label className="flex items-center gap-3 text-sm text-[#4f435c]" key={user.id}>
                  <input
                    checked={selectedMemberIds.includes(user.id)}
                    className="h-4 w-4 accent-[#8b35e6]"
                    onChange={() => toggleSelection(selectedMemberIds, user.id, setSelectedMemberIds)}
                    type="checkbox"
                  />
                  <span>
                    <span className="font-medium text-[#241232]">{user.displayName}</span>
                    <span className="ml-2 text-xs text-[#62576a]">{user.email}</span>
                  </span>
                </label>
              ))}
              {users.length === 0 && (
                <div className="text-sm text-[#6f6578]">No team members are available yet.</div>
              )}
            </div>
          </div>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update custom group metadata, scope, and members while preserving role assignments."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setGroupPendingEdit(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!groupPendingEdit || groupEditBusy || !editGroupName.trim()}
              form="team-edit-group-form"
              type="submit"
            >
              {groupEditBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setGroupPendingEdit(null);
        }}
        open={Boolean(groupPendingEdit)}
        title="Edit group"
      >
        {groupPendingEdit ? (
          <form
            className="space-y-5"
            id="team-edit-group-form"
            onSubmit={(event) => {
              event.preventDefault();
              void updateGroup(groupPendingEdit);
            }}
          >
            <div className="panel-subtle">
              <div className="flex flex-wrap gap-2">
                <RegStatusPill tone={groupPendingEdit.isBuiltin ? 'info' : 'purple'}>
                  {groupPendingEdit.isBuiltin ? 'Built-in' : 'Custom'}
                </RegStatusPill>
                <RegStatusPill tone="neutral">{groupPendingEdit.folderName}</RegStatusPill>
              </div>
              <div className="mt-3 text-xs leading-5 text-[#62576a]">
                Existing role assignments remain attached to this group after the edit.
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Group name</span>
              <input
                className="input"
                onChange={(event) => setEditGroupName(event.target.value)}
                value={editGroupName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[120px]"
                onChange={(event) => setEditGroupDescription(event.target.value)}
                value={editGroupDescription}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Scope folder</span>
              <select
                className="input"
                onChange={(event) => setEditGroupFolderId(event.target.value)}
                value={editGroupFolderId}
              >
                {domainFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="label">Members</div>
              <div className="mt-2 max-h-64 space-y-2 overflow-auto rounded-lg border border-[#ded8e4] p-3">
                {users.map((user) => (
                  <label className="flex items-center gap-3 text-sm text-[#4f435c]" key={user.id}>
                    <input
                      checked={editGroupMemberIds.includes(user.id)}
                      className="h-4 w-4 accent-[#8b35e6]"
                      onChange={() => toggleSelection(editGroupMemberIds, user.id, setEditGroupMemberIds)}
                      type="checkbox"
                    />
                    <span>
                      <span className="font-medium text-[#241232]">{user.displayName}</span>
                      <span className="ml-2 text-xs text-[#62576a]">{user.email}</span>
                    </span>
                  </label>
                ))}
                {users.length === 0 ? (
                  <div className="text-sm text-[#6f6578]">No team members are available yet.</div>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Members</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">
                  {groupPendingEdit.memberCount}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Assignments</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">
                  {groupPendingEdit.assignmentCount}
                </div>
              </div>
            </div>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Inspect workspace profile state before changing sign-in or access assignments."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {inspectedUser && tenantAllowsLocalFallback && inspectedUser.keepLocalLogin ? (
              <button
                className="button-secondary"
                onClick={() => {
                  setPasswordFormUserId(inspectedUser.id);
                  setTemporaryPassword('');
                  setConfirmTemporaryPassword('');
                  setTemporaryPasswordRequireReset(true);
                }}
                type="button"
              >
                Set password
              </button>
            ) : null}
            {inspectedUser ? (
              <button
                className="button-secondary"
                onClick={() => openEditUser(inspectedUser)}
                type="button"
              >
                Edit user
              </button>
            ) : null}
            {inspectedUser ? (
              <button
                className="button-secondary text-[#9d1f2c]"
                onClick={() => setUserPendingDelete(inspectedUser)}
                type="button"
              >
                Delete user
              </button>
            ) : null}
            <button className="button-primary" onClick={() => setInspectedUser(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedUser(null);
        }}
        open={Boolean(inspectedUser)}
        title={inspectedUser?.displayName ?? 'User details'}
      >
        {inspectedUser ? (
          <div className="space-y-5 text-sm text-[#4f435c]">
            <div className="panel-subtle">
              <div className="font-semibold text-[#241232]">{inspectedUser.email}</div>
              <div className="mt-1 text-xs text-[#62576a]">
                Created {inspectedUser.createdAt} - Updated {inspectedUser.updatedAt}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RegStatusPill tone={inspectedUser.isActive ? 'success' : 'warning'}>
                  {inspectedUser.isActive ? 'Active' : 'Inactive'}
                </RegStatusPill>
                <RegStatusPill tone={inspectedUser.keepLocalLogin ? 'info' : 'neutral'}>
                  {inspectedUser.keepLocalLogin ? 'Local fallback' : 'SSO managed'}
                </RegStatusPill>
                {inspectedUser.isThirdParty ? <RegStatusPill tone="info">Third-party</RegStatusPill> : null}
                {inspectedUser.isAuditee ? <RegStatusPill tone="purple">Auditee</RegStatusPill> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Groups</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {inspectedUser.userGroups.map((group) => (
                    <RegStatusPill key={group.id}>{group.name}</RegStatusPill>
                  ))}
                  {inspectedUser.userGroups.length === 0 ? 'No groups' : null}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Assignments</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">
                  {inspectedUser.assignmentCount}
                </div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Local sign-in</div>
              <div className="mt-2">
                {tenantAllowsLocalFallback && inspectedUser.keepLocalLogin
                  ? inspectedUser.localPasswordConfigured
                    ? `Configured, ${inspectedUser.localPasswordFailedAttempts} failed attempts`
                    : 'Enabled but no temporary password has been provisioned.'
                  : localFallbackPolicyLocked
                    ? 'Disabled by tenant SSO policy.'
                    : 'Managed by SSO policy.'}
              </div>
              {inspectedUser.localPasswordResetRequired ? (
                <div className="mt-1 text-xs text-[#62576a]">Password reset required.</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Inspect group membership and scoped access before changing assignments or membership."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {inspectedGroup && !inspectedGroup.isBuiltin ? (
              <button
                className="button-secondary"
                onClick={() => openEditGroup(inspectedGroup)}
                type="button"
              >
                Edit group
              </button>
            ) : null}
            {inspectedGroup && !inspectedGroup.isBuiltin ? (
              <button
                className="button-secondary text-[#9d1f2c]"
                onClick={() => setGroupPendingDelete(inspectedGroup)}
                type="button"
              >
                Delete group
              </button>
            ) : null}
            <button className="button-primary" onClick={() => setInspectedGroup(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedGroup(null);
        }}
        open={Boolean(inspectedGroup)}
        title={inspectedGroup?.name ?? 'Group details'}
      >
        {inspectedGroup ? (
          <div className="space-y-5 text-sm text-[#4f435c]">
            <div className="panel-subtle">
              <div className="flex flex-wrap gap-2">
                <RegStatusPill tone={inspectedGroup.isBuiltin ? 'info' : 'purple'}>
                  {inspectedGroup.isBuiltin ? 'Built-in' : 'Custom'}
                </RegStatusPill>
                <RegStatusPill tone="neutral">{inspectedGroup.folderName}</RegStatusPill>
              </div>
              <p className="mt-3 leading-6">
                {inspectedGroup.description || 'No description has been added for this group.'}
              </p>
              <div className="mt-3 text-xs text-[#62576a]">
                Created {inspectedGroup.createdAt} - Updated {inspectedGroup.updatedAt}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Members</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">
                  {inspectedGroup.memberCount}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Assignments</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">
                  {inspectedGroup.assignmentCount}
                </div>
              </div>
            </div>
            <div>
              <div className="label">Current members</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {inspectedGroup.members.map((member) => (
                  <RegStatusPill key={member.id}>{member.displayName}</RegStatusPill>
                ))}
                {inspectedGroup.members.length === 0 ? (
                  <span className="text-sm text-[#62576a]">No members yet.</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="This removes the user profile from the workspace. Groups and assignments may need cleanup if the backend blocks deletion."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setUserPendingDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary bg-[#9d1f2c] hover:bg-[#7c1822]"
              disabled={!userPendingDelete || destructiveBusy === userPendingDelete?.id}
              onClick={() => {
                if (userPendingDelete) void deleteUser(userPendingDelete);
              }}
              type="button"
            >
              {destructiveBusy === userPendingDelete?.id ? 'Deleting...' : 'Delete user'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setUserPendingDelete(null);
        }}
        open={Boolean(userPendingDelete)}
        title="Delete user"
      >
        {userPendingDelete ? (
          <div className="space-y-3 text-sm text-[#4f435c]">
            <p>
              You are deleting <span className="font-semibold text-[#241232]">{userPendingDelete.displayName}</span>.
            </p>
            <div className="panel-subtle">
              <div>{userPendingDelete.email}</div>
              <div>{userPendingDelete.groupCount} groups</div>
              <div>{userPendingDelete.assignmentCount} direct assignments</div>
            </div>
          </div>
        ) : null}
      </RegModal>

      <RegModal
        description="This deletes the group while leaving the users themselves in the workspace."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setGroupPendingDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary bg-[#9d1f2c] hover:bg-[#7c1822]"
              disabled={!groupPendingDelete || destructiveBusy === groupPendingDelete?.id}
              onClick={() => {
                if (groupPendingDelete) void deleteGroup(groupPendingDelete);
              }}
              type="button"
            >
              {destructiveBusy === groupPendingDelete?.id ? 'Deleting...' : 'Delete group'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setGroupPendingDelete(null);
        }}
        open={Boolean(groupPendingDelete)}
        title="Delete group"
      >
        {groupPendingDelete ? (
          <div className="space-y-3 text-sm text-[#4f435c]">
            <p>
              You are deleting <span className="font-semibold text-[#241232]">{groupPendingDelete.name}</span>.
            </p>
            <div className="panel-subtle">
              <div>{groupPendingDelete.memberCount} members</div>
              <div>{groupPendingDelete.assignmentCount} assignments</div>
              <div>{groupPendingDelete.description || 'No group description.'}</div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}

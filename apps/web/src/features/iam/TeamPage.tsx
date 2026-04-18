import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder, WorkspaceUser, WorkspaceUserGroup } from './types';

const client = new ApiClient();

export function TeamPage() {
  const { identity } = useEdgeIdentity();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [groups, setGroups] = useState<WorkspaceUserGroup[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userBusy, setUserBusy] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
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

  const domainFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'domain' || folder.contentType === 'root'),
    [folders],
  );

  async function loadWorkspaceTeam() {
    try {
      setLoading(true);
      setError(null);
      const [userResponse, groupResponse, folderResponse] = await Promise.all([
        client.get<{ data: WorkspaceUser[] }>('/iam/users'),
        client.get<{ data: WorkspaceUserGroup[] }>('/iam/user-groups'),
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders'),
      ]);
      setUsers(userResponse.data);
      setGroups(groupResponse.data);
      setFolders(folderResponse.data);
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
        keepLocalLogin,
        isThirdParty,
        isAuditee,
        groupIds: selectedGroupIds,
      });
      setEmail('');
      setDisplayName('');
      setFirstName('');
      setLastName('');
      setLocale('en');
      setKeepLocalLogin(true);
      setIsThirdParty(false);
      setIsAuditee(false);
      setSelectedGroupIds([]);
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
      setNotice('User group created.');
      await loadWorkspaceTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGroupBusy(false);
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

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading team workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Workspace</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Team & Groups</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Add workspace members, define shared groups, and prepare the principal layer that scoped
          access control builds on.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">New Team Member</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createUser();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Email</span>
                <input
                  className="input"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@company.com"
                  value={email}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Display name</span>
                <input
                  className="input"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Security Program Owner"
                  value={displayName}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">First name</span>
                <input
                  className="input"
                  onChange={(event) => setFirstName(event.target.value)}
                  value={firstName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Last name</span>
                <input
                  className="input"
                  onChange={(event) => setLastName(event.target.value)}
                  value={lastName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Locale</span>
                <select className="input" onChange={(event) => setLocale(event.target.value)} value={locale}>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="panel-subtle flex items-center gap-3">
                <input
                  checked={keepLocalLogin}
                  className="h-4 w-4 accent-cyan-400"
                  onChange={(event) => setKeepLocalLogin(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm text-slate-300">Keep local login</span>
              </label>
              <label className="panel-subtle flex items-center gap-3">
                <input
                  checked={isThirdParty}
                  className="h-4 w-4 accent-cyan-400"
                  onChange={(event) => setIsThirdParty(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm text-slate-300">Third-party identity</span>
              </label>
              <label className="panel-subtle flex items-center gap-3">
                <input
                  checked={isAuditee}
                  className="h-4 w-4 accent-cyan-400"
                  onChange={(event) => setIsAuditee(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm text-slate-300">Auditee view</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="label">Initial groups</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((group) => (
                  <label className="panel-subtle flex items-start gap-3" key={group.id}>
                    <input
                      checked={selectedGroupIds.includes(group.id)}
                      className="mt-1 h-4 w-4 accent-cyan-400"
                      onChange={() =>
                        toggleSelection(selectedGroupIds, group.id, setSelectedGroupIds)
                      }
                      type="checkbox"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{group.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{group.folderName}</div>
                    </div>
                  </label>
                ))}
                {groups.length === 0 && (
                  <div className="text-sm text-slate-500">
                    Create groups first if you want to place users into scoped teams on arrival.
                  </div>
                )}
              </div>
            </div>

            <button className="button-primary" disabled={userBusy} type="submit">
              {userBusy ? 'Saving...' : 'Add Team Member'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">New Group</div>
          <form
            className="mt-4 space-y-3"
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
                className="input min-h-[92px]"
                onChange={(event) => setGroupDescription(event.target.value)}
                placeholder="Who should be grouped together under this workspace perimeter?"
                value={groupDescription}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Folder scope</span>
              <select
                className="input"
                onChange={(event) => setGroupFolderId(event.target.value)}
                value={groupFolderId}
              >
                {domainFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.pathLabel}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <div className="label">Members</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {users.map((user) => (
                  <label className="panel-subtle flex items-start gap-3" key={user.id}>
                    <input
                      checked={selectedMemberIds.includes(user.id)}
                      className="mt-1 h-4 w-4 accent-cyan-400"
                      onChange={() => toggleSelection(selectedMemberIds, user.id, setSelectedMemberIds)}
                      type="checkbox"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{user.displayName}</div>
                      <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button className="button-primary" disabled={groupBusy} type="submit">
              {groupBusy ? 'Saving...' : 'Create Group'}
            </button>
          </form>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel overflow-hidden p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Team member</th>
                <th className="px-4 py-3">Groups</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3">Local sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{user.displayName}</div>
                    <div className="mt-1 text-xs text-cyan-200">{user.email}</div>
                    <div className="mt-2 text-xs text-slate-500">Joined {user.createdAt}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {user.userGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.userGroups.map((group) => (
                          <span className="badge-neutral" key={group.id}>
                            {group.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'No groups'
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <div>{user.keepLocalLogin ? 'Local login enabled' : 'SSO-only ready'}</div>
                    {user.keepLocalLogin && (
                      <div>{user.localPasswordConfigured ? 'Password configured' : 'Password pending'}</div>
                    )}
                    {user.keepLocalLogin && user.localPasswordResetRequired && (
                      <div>Password reset required</div>
                    )}
                    {user.keepLocalLogin && user.localPasswordLockedUntil && (
                      <div>Temporarily locked</div>
                    )}
                    <div>{user.isThirdParty ? 'Third-party' : 'Internal'}</div>
                    <div>{user.isAuditee ? 'Auditee' : 'Standard view'}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{user.assignmentCount}</td>
                  <td className="px-4 py-4 text-slate-300">
                    {user.keepLocalLogin ? (
                      <div className="space-y-3">
                        <div className="text-xs text-slate-500">
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
                            setPasswordFormUserId(passwordFormUserId === user.id ? null : user.id);
                          }}
                          type="button"
                        >
                          {user.localPasswordConfigured ? 'Rotate Temp Password' : 'Set Temp Password'}
                        </button>

                        {passwordFormUserId === user.id && (
                          <form
                            className="panel-subtle space-y-3"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void setTemporaryPasswordForUser(user);
                            }}
                          >
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
                            <label className="flex items-center gap-3 text-sm text-slate-300">
                              <input
                                checked={temporaryPasswordRequireReset}
                                className="h-4 w-4 accent-cyan-400"
                                onChange={(event) => setTemporaryPasswordRequireReset(event.target.checked)}
                                type="checkbox"
                              />
                              Require the user to rotate it after sign-in
                            </label>
                            <button
                              className="button-primary"
                              disabled={passwordBusyUserId === user.id}
                              type="submit"
                            >
                              {passwordBusyUserId === user.id ? 'Saving...' : 'Save Password'}
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Managed by SSO policy.</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
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
                  <div>
                    <div className="font-medium text-white">{group.name}</div>
                    <div className="mt-1 text-xs text-cyan-200">{group.folderName}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{group.memberCount} members</div>
                    <div>{group.assignmentCount} assignments</div>
                  </div>
                </div>
                {group.description && (
                  <div className="mt-3 text-sm leading-6 text-slate-300">{group.description}</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <span className="badge-neutral" key={member.id}>
                      {member.displayName}
                    </span>
                  ))}
                  {group.members.length === 0 && (
                    <span className="text-xs text-slate-500">No members yet.</span>
                  )}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="text-sm text-slate-400">No user groups created yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

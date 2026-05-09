import { type FormEvent, useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { IamMePayload } from '../iam/types';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';

const client = new ApiClient();

export function MePage() {
  const { identity } = useEdgeIdentity();
  const [me, setMe] = useState<IamMePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function loadMe() {
    try {
      setError(null);
      const response = await client.get<{ data: IamMePayload }>('/iam/me');
      setMe(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  useEffect(() => {
    void loadMe();
  }, [identity.tenantId, identity.userId]);

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must match.');
      setNotice(null);
      return;
    }

    try {
      setPasswordBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/local-auth/set-password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Local password updated for this workspace identity.');
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Workspace</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">My Access</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Review the identity, role sources, and domain perimeter active for this session.
        </p>
      </section>

      <CoachMarksPanel
        storageKey="my-access"
        title="Use My Access to understand scope before assuming the app is missing something."
        description="This page explains what the current session can actually see, why those permissions exist, and whether local sign-in is available for this identity."
        items={[
          {
            id: 'my-access-identity',
            eyebrow: 'Identity',
            title: 'The session only sees one active identity',
            body: 'The name, email, and session state here describe the exact account the rest of the app is currently rendering for.',
            tone: 'focus',
          },
          {
            id: 'my-access-roles',
            eyebrow: 'Role sources',
            title: 'Role sources explain why access exists',
            body: 'Direct roles and group-inherited roles both matter. If access feels wrong, the answer is usually in the role source list below.',
          },
          {
            id: 'my-access-domains',
            eyebrow: 'Perimeter',
            title: 'Domain perimeter is the real visibility boundary',
            body: 'Even with a broad-looking role, this session can only work inside the domains and permissions attached to those domains.',
          },
          {
            id: 'my-access-local-login',
            eyebrow: 'Sign-in',
            title: 'Local password access is optional, not assumed',
            body: 'If local sign-in is enabled for this identity, you can manage that password here. Otherwise the account stays on the workspace-managed path.',
          },
        ]}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Identity</div>
          <div className="mt-3 text-lg font-semibold text-white">
            {me?.profile?.displayName ?? identity.userId}
          </div>
          <div className="mt-2 text-xs text-cyan-200">{me?.profile?.email ?? 'No profile found'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Session</div>
          <div className="metric-value">{me?.isAuthenticated ? 'active' : 'inactive'}</div>
          <div className="mt-2 text-xs text-slate-500">This workspace session is currently secured and available for use.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Permissions</div>
          <div className="metric-value">{me?.permissions.length ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Accessible domains</div>
          <div className="metric-value">{me?.accessibleDomains.length ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="eyebrow">Role Sources</div>
          <div className="mt-4 space-y-3">
            {me?.effectiveRoles.map((role) => (
              <div className="panel-subtle" key={`${role.roleId}:${role.scopeFolderId}:${role.source}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{role.roleName}</div>
                    <div className="mt-1 text-xs text-cyan-200">{role.scopePathLabel}</div>
                  </div>
                  <span className="badge-neutral">{role.source === 'direct' ? 'Direct' : 'Via group'}</span>
                </div>
                {role.viaGroupName && (
                  <div className="mt-3 text-sm text-slate-300">Inherited from {role.viaGroupName}</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {role.permissions.map((permission) => (
                    <span className="badge-neutral" key={permission}>
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {(me?.effectiveRoles.length ?? 0) === 0 && (
              <div className="text-sm text-slate-400">No effective roles found for this identity.</div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Groups</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {me?.userGroups.map((group) => (
                <span className="badge-neutral" key={group.id}>
                  {group.name}
                </span>
              ))}
              {(me?.userGroups.length ?? 0) === 0 && (
                <div className="text-sm text-slate-500">This identity is not in any groups.</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Domain Perimeter</div>
            <div className="mt-4 space-y-3">
              {me?.accessibleDomains.map((domain) => (
                <div className="panel-subtle" key={domain.id}>
                  <div className="font-medium text-white">{domain.name}</div>
                  <div className="mt-1 text-xs text-cyan-200">{domain.pathLabel}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(me.domainPermissions[domain.id] ?? []).map((permission) => (
                      <span className="badge-neutral" key={`${domain.id}:${permission}`}>
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {(me?.accessibleDomains.length ?? 0) === 0 && (
                <div className="text-sm text-slate-400">No workspace domains are available yet.</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Local Sign-In</div>
            {me?.profile?.keepLocalLogin ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="panel-subtle">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Password</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {me.profile.localPasswordConfigured ? 'Configured' : 'Not configured'}
                    </div>
                  </div>
                  <div className="panel-subtle">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Reset posture</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {me.profile.localPasswordResetRequired ? 'Reset required' : 'Healthy'}
                    </div>
                  </div>
                  <div className="panel-subtle">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lock state</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {me.profile.localPasswordLockedUntil ? 'Temporarily locked' : 'Ready'}
                    </div>
                    {me.profile.localPasswordLockedUntil && (
                      <div className="mt-2 text-xs text-slate-400">
                        Until {me.profile.localPasswordLockedUntil}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-sm leading-6 text-slate-300">
                  {me.profile.localPasswordConfigured
                    ? 'Rotate the local password used for direct Regovise sign-in. The current password is required before a new one can be saved.'
                    : 'No local password is configured yet for this identity. Set one now to enable direct Regovise sign-in without administrator recovery.'}
                </div>

                <form className="space-y-3" onSubmit={(event) => void handlePasswordChange(event)}>
                  {me.profile.localPasswordConfigured && (
                    <label className="space-y-1">
                      <span className="label">Current password</span>
                      <input
                        className="input"
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        type="password"
                        value={currentPassword}
                      />
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="label">New password</span>
                      <input
                        className="input"
                        onChange={(event) => setNewPassword(event.target.value)}
                        type="password"
                        value={newPassword}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="label">Confirm new password</span>
                      <input
                        className="input"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        type="password"
                        value={confirmPassword}
                      />
                    </label>
                  </div>
                  <div className="text-xs text-slate-500">
                    Use at least 12 characters with upper, lower, number, and symbol characters.
                  </div>
                  <button className="button-primary" disabled={passwordBusy} type="submit">
                    {passwordBusy
                      ? 'Saving...'
                      : me.profile.localPasswordConfigured
                        ? 'Change Local Password'
                        : 'Set Local Password'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-4 text-sm leading-6 text-slate-400">
                This identity is currently configured for SSO-managed access only. Enable local login
                in workspace administration before setting a direct sign-in password.
              </div>
            )}
          </section>
        </section>
      </section>
    </div>
  );
}

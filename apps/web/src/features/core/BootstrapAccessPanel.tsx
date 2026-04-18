import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEdgeIdentity } from '../../shared/session/identity';

type BootstrapStatus = {
  initialized: boolean;
  tenantCount: number;
  userCount: number;
  bootstrapSecretConfigured: boolean;
  mode: 'initialize' | 'admin-access' | 'disabled';
};

type LoginConfig = {
  initialized: boolean;
  emailCodeEnabled: boolean;
  previewOnly: boolean;
  emailProvider: string;
  emailSendingEnabled: boolean;
  passwordSignInEnabled: boolean;
  loginEnforced: boolean;
  deliveryMode: string | null;
  supportEmail: string | null;
  status: string | null;
  statusNote: string | null;
  localLoginUserCount: number;
  passwordConfiguredUserCount: number;
  suggestedTenantSlug: string | null;
  suggestedEmail: string | null;
  message: string;
};

type BootstrapResult = {
  data: {
    initialized: boolean;
    tenantId: string;
    userId: string;
    tenantSlug: string;
    sessionId: string;
    sessionExpiresAt: string;
  };
};

type LoginRequestResult = {
  data: {
    requested: boolean;
    delivery: 'email' | 'preview';
    expiresAt: string | null;
    previewCode: string | null;
  };
};

async function parseJsonError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return `Request failed: ${response.status}`;
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string };
    return payload.message?.trim() || payload.error?.trim() || text;
  } catch {
    return text;
  }
}

function slugifyTenant(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatExpiresAt(value: string | null): string {
  if (!value) {
    return 'The code will expire shortly.';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'The code will expire shortly.';
  }

  return `Code expires at ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}.`;
}

export function BootstrapAccessPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIdentity, setAuthMode } = useEdgeIdentity();
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loginConfig, setLoginConfig] = useState<LoginConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    'initialize' | 'admin-access' | 'login-request' | 'login-verify' | 'password-sign-in' | 'password-set' | null
  >(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const [tenantName, setTenantName] = useState('Regovise Workspace');
  const [tenantSlug, setTenantSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginPreviewCode, setLoginPreviewCode] = useState<string | null>(null);
  const [loginExpiresAt, setLoginExpiresAt] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [newLocalPassword, setNewLocalPassword] = useState('');
  const [confirmLocalPassword, setConfirmLocalPassword] = useState('');
  const [loginStep, setLoginStep] = useState<'request' | 'verify'>('request');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const [statusResponse, loginResponse] = await Promise.all([
          fetch('/_api/core/bootstrap/status', {
            credentials: 'include',
          }),
          fetch('/_api/core/login/config', {
            credentials: 'include',
          }),
        ]);

        if (!statusResponse.ok) {
          throw new Error(await parseJsonError(statusResponse));
        }

        const statusPayload = (await statusResponse.json()) as { data: BootstrapStatus };
        setStatus(statusPayload.data);

        if (loginResponse.ok) {
          const loginPayload = (await loginResponse.json()) as { data: LoginConfig };
          setLoginConfig(loginPayload.data);
        } else {
          setLoginConfig(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load access status.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mode = status?.mode ?? 'disabled';
  const isInitialize = mode === 'initialize';
  const canUseEmailSignIn = Boolean(status?.initialized && loginConfig?.emailCodeEnabled);
  const canUsePasswordSignIn = Boolean(status?.initialized && loginConfig?.passwordSignInEnabled);
  const pendingRoute =
    location.pathname && location.pathname !== '/' ? `${location.pathname}${location.search}${location.hash}` : '/';

  useEffect(() => {
    if (isInitialize) {
      setTenantSlug(slugifyTenant(tenantName || tenantSlug));
    }
  }, [isInitialize, tenantName]);

  useEffect(() => {
    if (defaultsApplied || loading || !status) {
      return;
    }

    if (isInitialize) {
      setTenantSlug((current) => current || 'regovise');
      setDefaultsApplied(true);
      return;
    }

    const suggestedTenantSlug = loginConfig?.suggestedTenantSlug?.trim() || 'regovise';
    const suggestedEmail = loginConfig?.suggestedEmail?.trim() || 'admin@regovise.com';

    setTenantSlug((current) => {
      const normalized = current.trim();
      if (!normalized || normalized === 'regovise' || normalized === 'regovise-workspace') {
        return suggestedTenantSlug;
      }
      return current;
    });
    setAdminEmail((current) => current.trim() || suggestedEmail);
    setLoginEmail((current) => current.trim() || suggestedEmail);
    setDefaultsApplied(true);
  }, [defaultsApplied, isInitialize, loading, loginConfig, status]);

  const title = useMemo(() => {
    if (loading) return 'Checking workspace access';
    if (mode === 'initialize') return 'Initialize the first Regovise workspace';
    if (mode === 'admin-access') return 'Open a secure Regovise session';
    return 'Access setup unavailable';
  }, [loading, mode]);

  async function completeSession(result: BootstrapResult, nextNotice: string) {
    setIdentity({
      tenantId: result.data.tenantId,
      userId: result.data.userId,
    });
    setAuthMode('session');
    setNotice(nextNotice);
    navigate(pendingRoute);
  }

  const tenantSlugPlaceholder = loginConfig?.suggestedTenantSlug?.trim() || 'regovise';
  const emailPlaceholder = loginConfig?.suggestedEmail?.trim() || 'admin@regovise.com';

  async function handleInitialize() {
    try {
      setBusy('initialize');
      setError(null);
      setNotice(null);

      const response = await fetch('/_api/core/bootstrap/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          secret,
          tenantName,
          tenantSlug,
          adminEmail,
          adminDisplayName,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      const payload = (await response.json()) as BootstrapResult;
      await completeSession(payload, 'Workspace initialized and administrator session established.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize the workspace.');
    } finally {
      setBusy(null);
    }
  }

  async function handleAdminAccess() {
    try {
      setBusy('admin-access');
      setError(null);
      setNotice(null);

      const response = await fetch('/_api/core/bootstrap/admin-session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          secret,
          tenantSlug,
          email: adminEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      const payload = (await response.json()) as BootstrapResult;
      await completeSession(payload, 'Administrator session established.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to establish an administrator session.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRequestCode() {
    try {
      setBusy('login-request');
      setError(null);
      setNotice(null);
      setLoginPreviewCode(null);

      const response = await fetch('/_api/core/login/request-code', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          email: loginEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      const payload = (await response.json()) as LoginRequestResult;
      setLoginStep('verify');
      setLoginCode('');
      setLoginExpiresAt(payload.data.expiresAt);
      setLoginPreviewCode(payload.data.previewCode);
      setNotice(
        payload.data.delivery === 'preview'
          ? 'A preview sign-in code is ready if that local-login account is eligible.'
          : 'A sign-in code has been sent if that local-login account is eligible.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request a sign-in code.');
    } finally {
      setBusy(null);
    }
  }

  async function handleVerifyCode() {
    try {
      setBusy('login-verify');
      setError(null);
      setNotice(null);

      const response = await fetch('/_api/core/login/verify-code', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          email: loginEmail,
          code: loginCode,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      const payload = (await response.json()) as BootstrapResult;
      await completeSession(payload, 'Secure session established.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify the sign-in code.');
    } finally {
      setBusy(null);
    }
  }

  async function handlePasswordSignIn() {
    try {
      setBusy('password-sign-in');
      setError(null);
      setNotice(null);

      const response = await fetch('/_api/core/local-auth/sign-in', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          email: loginEmail,
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      const payload = (await response.json()) as BootstrapResult;
      await completeSession(payload, 'Secure session established.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with the local password.');
    } finally {
      setBusy(null);
    }
  }

  async function handleBootstrapPasswordSet() {
    try {
      setBusy('password-set');
      setError(null);
      setNotice(null);

      if (newLocalPassword !== confirmLocalPassword) {
        throw new Error('The new password and confirmation must match.');
      }

      const response = await fetch('/_api/core/local-auth/bootstrap-set-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          email: adminEmail,
          secret,
          newPassword: newLocalPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response));
      }

      setNewLocalPassword('');
      setConfirmLocalPassword('');
      setNotice('Local password saved. You can now sign in with email and password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to set the local password.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel max-w-5xl space-y-6">
      <div>
        <div className="eyebrow">Secure Session</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Regovise now prefers secure Cloudflare session cookies. Use this access surface to initialize the first tenant,
          sign in with a local password or one-time email code, or recover an administrator session with the guarded bootstrap
          secret when needed.
        </p>
        {pendingRoute !== '/' && (
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
            Sign in to continue to <span className="font-medium">{pendingRoute}</span>.
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-slate-400">Loading access status…</div>}
      {error && <div className="notice-warning">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      {status && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Mode</div>
            <div className="metric-value">{status.mode}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Tenants</div>
            <div className="metric-value">{status.tenantCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Users</div>
            <div className="metric-value">{status.userCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Local sign-in</div>
            <div className="metric-value">
              {loginConfig?.passwordConfiguredUserCount
                ? 'Password ready'
                : loginConfig?.emailCodeEnabled
                  ? loginConfig.previewOnly
                    ? 'Preview'
                    : 'Email ready'
                  : 'Unavailable'}
            </div>
          </div>
        </div>
      )}

      {status?.mode === 'disabled' ? (
        <div className="panel-subtle text-sm text-slate-300">
          Set a `BOOTSTRAP_SETUP_SECRET` Worker secret to enable first-run initialization and administrator recovery.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {isInitialize && (
            <section className="panel-subtle space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Initialize first tenant</div>
                <p className="mt-1 text-sm text-slate-400">
                  Creates the first tenant, root workspace, primary domain, administrator role, and first secure session.
                </p>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Workspace name</span>
                <input
                  className="input"
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  placeholder="Regovise Workspace"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Tenant slug</span>
                <input
                  className="input"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(slugifyTenant(event.target.value))}
                  placeholder={tenantSlugPlaceholder}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Administrator name</span>
                <input
                  className="input"
                  value={adminDisplayName}
                  onChange={(event) => setAdminDisplayName(event.target.value)}
                  placeholder="Workspace Administrator"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Administrator email</span>
                <input
                  className="input"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder={emailPlaceholder}
                  type="email"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Bootstrap secret</span>
                <input
                  className="input"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="Enter the configured bootstrap secret"
                  type="password"
                />
              </label>

              <button
                className="button-primary"
                disabled={busy === 'initialize'}
                onClick={() => void handleInitialize()}
                type="button"
              >
                {busy === 'initialize' ? 'Initializing…' : 'Initialize workspace'}
              </button>
            </section>
          )}

          {status?.initialized && (
            <section className="panel-subtle space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Password sign-in</div>
                <p className="mt-1 text-sm text-slate-400">
                  Use a local password for accounts that keep local login enabled. This gives production a normal first-party
                  sign-in path even before email delivery is configured.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Password-ready users</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {loginConfig?.passwordConfiguredUserCount ?? 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Local-login users</div>
                  <div className="mt-2 text-sm font-semibold text-white">{loginConfig?.localLoginUserCount ?? 0}</div>
                </div>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Tenant slug</span>
                <input
                  className="input"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(slugifyTenant(event.target.value))}
                  placeholder={tenantSlugPlaceholder}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Email</span>
                <input
                  className="input"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder={emailPlaceholder}
                  type="email"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Password</span>
                <input
                  className="input"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Enter the local account password"
                  type="password"
                />
              </label>

              {!canUsePasswordSignIn ? (
                <div className="panel-subtle text-sm text-slate-300">
                  No local password is configured yet. Use the bootstrap recovery section to set one for a local-login account.
                </div>
              ) : (
                <button
                  className="button-primary"
                  disabled={busy === 'password-sign-in'}
                  onClick={() => void handlePasswordSignIn()}
                  type="button"
                >
                  {busy === 'password-sign-in' ? 'Signing in…' : 'Sign in with password'}
                </button>
              )}
            </section>
          )}

          {status?.initialized && (
            <section className="panel-subtle space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Email sign-in</div>
                <p className="mt-1 text-sm text-slate-400">
                  Request a one-time code for a user with local-login access. This opens a secure session without relying on
                  header-mode identity.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Delivery</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {loginConfig?.previewOnly ? 'Preview only' : loginConfig?.emailProvider ?? 'Unavailable'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Local-login users</div>
                  <div className="mt-2 text-sm font-semibold text-white">{loginConfig?.localLoginUserCount ?? 0}</div>
                </div>
              </div>

              <div className="panel-subtle text-sm text-slate-300">
                {loginConfig?.message ?? 'Loading sign-in posture…'}
                {loginConfig?.statusNote ? <div className="mt-2 text-xs text-slate-400">{loginConfig.statusNote}</div> : null}
                {loginConfig?.supportEmail ? (
                  <div className="mt-2 text-xs text-slate-400">Support contact: {loginConfig.supportEmail}</div>
                ) : null}
              </div>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Tenant slug</span>
                <input
                  className="input"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(slugifyTenant(event.target.value))}
                  placeholder={tenantSlugPlaceholder}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Email</span>
                <input
                  className="input"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder={emailPlaceholder}
                  type="email"
                />
              </label>

              {loginStep === 'verify' && (
                <label className="block space-y-2 text-sm">
                  <span className="text-slate-300">Six-digit code</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setLoginCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                    placeholder="123456"
                    value={loginCode}
                  />
                </label>
              )}

              {loginStep === 'verify' && (
                <div className="panel-subtle text-sm text-slate-300">
                  {formatExpiresAt(loginExpiresAt)}
                  {loginPreviewCode ? (
                    <div className="mt-2 text-xs text-cyan-300">Preview code: {loginPreviewCode}</div>
                  ) : null}
                </div>
              )}

              {!canUseEmailSignIn ? (
                <div className="panel-subtle text-sm text-slate-300">
                  Email sign-in is not available yet for this environment. Configure the production email provider or keep
                  local preview mode enabled in development.
                </div>
              ) : loginStep === 'request' ? (
                <button
                  className="button-primary"
                  disabled={busy === 'login-request'}
                  onClick={() => void handleRequestCode()}
                  type="button"
                >
                  {busy === 'login-request' ? 'Sending code…' : 'Request sign-in code'}
                </button>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="button-primary"
                    disabled={busy === 'login-verify'}
                    onClick={() => void handleVerifyCode()}
                    type="button"
                  >
                    {busy === 'login-verify' ? 'Verifying…' : 'Verify code'}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busy === 'login-request'}
                    onClick={() => void handleRequestCode()}
                    type="button"
                  >
                    {busy === 'login-request' ? 'Sending…' : 'Send a new code'}
                  </button>
                </div>
              )}
            </section>
          )}

          {status?.initialized && (
            <section className="panel-subtle space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Administrator recovery</div>
                <p className="mt-1 text-sm text-slate-400">
                  Use the guarded bootstrap secret to recover an administrator session when email or SSO access is not yet
                  available.
                </p>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Tenant slug</span>
                <input
                  className="input"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(slugifyTenant(event.target.value))}
                  placeholder={tenantSlugPlaceholder}
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Administrator email</span>
                <input
                  className="input"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder={emailPlaceholder}
                  type="email"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Bootstrap secret</span>
                <input
                  className="input"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="Enter the configured bootstrap secret"
                  type="password"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm">
                  <span className="text-slate-300">New local password</span>
                  <input
                    className="input"
                    value={newLocalPassword}
                    onChange={(event) => setNewLocalPassword(event.target.value)}
                    placeholder="At least 12 characters"
                    type="password"
                  />
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="text-slate-300">Confirm password</span>
                  <input
                    className="input"
                    value={confirmLocalPassword}
                    onChange={(event) => setConfirmLocalPassword(event.target.value)}
                    placeholder="Repeat the new password"
                    type="password"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="button-secondary"
                  disabled={busy === 'password-set'}
                  onClick={() => void handleBootstrapPasswordSet()}
                  type="button"
                >
                  {busy === 'password-set' ? 'Saving password…' : 'Set local password'}
                </button>

                <button
                  className="button-primary"
                  disabled={busy === 'admin-access'}
                  onClick={() => void handleAdminAccess()}
                  type="button"
                >
                  {busy === 'admin-access' ? 'Opening session…' : 'Open administrator session'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isAuthEntryPath, isLogoutPath, useEdgeIdentity } from '../../shared/session/identity';
import { cn } from '../../lib/utils';

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

type AccessSurface = 'login' | 'initialize' | 'recovery';

type BootstrapAccessPanelProps = {
  surface?: AccessSurface;
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

function readPendingRoute(location: ReturnType<typeof useLocation>): string {
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/')) {
    return next;
  }

  if (isAuthEntryPath(location.pathname) || isLogoutPath(location.pathname)) {
    return '/';
  }

  return location.pathname && location.pathname !== '/' ? `${location.pathname}${location.search}${location.hash}` : '/';
}

export function BootstrapAccessPanel({ surface = 'login' }: BootstrapAccessPanelProps) {
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'email'>('password');

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
  const pendingRoute = readPendingRoute(location);
  const showInitializeSurface = surface === 'initialize';
  const showLoginSurface = surface === 'login';
  const showRecoverySurface = surface === 'recovery';

  useEffect(() => {
    if (isInitialize) {
      setTenantSlug(slugifyTenant(tenantName || tenantSlug));
    }
  }, [isInitialize, tenantName, tenantSlug]);

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

  useEffect(() => {
    if (!showLoginSurface) {
      return;
    }

    if (!canUsePasswordSignIn && canUseEmailSignIn) {
      setLoginMethod('email');
      return;
    }

    if (!canUseEmailSignIn) {
      setLoginMethod('password');
    }
  }, [canUseEmailSignIn, canUsePasswordSignIn, showLoginSurface]);

  const title = useMemo(() => {
    if (loading) return 'Checking workspace access';
    if (showInitializeSurface) return 'Initialize the first Regovise workspace';
    if (showRecoverySurface) return 'Recover administrator access';
    if (status?.initialized) return 'Sign in to Regovise';
    return 'Finish workspace setup';
  }, [loading, showInitializeSurface, showRecoverySurface, status?.initialized]);

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
  const signInPosture = [
    loginConfig?.passwordConfiguredUserCount ? 'Password sign-in ready' : null,
    canUseEmailSignIn ? 'Email codes available' : null,
    tenantSlug || tenantSlugPlaceholder ? `Workspace ${tenantSlug || tenantSlugPlaceholder}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' · ');

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
    <section
      className={cn(
        'panel space-y-6',
        showLoginSurface ? 'mx-auto max-w-3xl' : 'mx-auto max-w-2xl',
      )}
    >
      <div>
        <div className="eyebrow">
          {showInitializeSurface ? 'Workspace Setup' : showRecoverySurface ? 'Administrator Recovery' : 'Secure Sign-In'}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {showInitializeSurface
            ? 'Create the first Regovise workspace, establish the first administrator account, and start the first secure session.'
            : showRecoverySurface
              ? 'Use the guarded recovery flow only when normal sign-in is unavailable and an administrator session must be restored.'
              : 'Use the simplest sign-in path available for this workspace. Setup and recovery live on separate guarded routes so the main entry stays focused.'}
        </p>
        {showLoginSurface && pendingRoute !== '/' ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
            Sign in to continue to <span className="font-medium">{pendingRoute}</span>.
          </div>
        ) : null}
      </div>

      {loading && <div className="text-sm text-slate-400">Loading access status…</div>}
      {error && <div className="notice-warning">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      {showLoginSurface && status?.initialized ? (
        <section className="panel-subtle space-y-5">
          <div className="space-y-2">
            <div>
              <div className="text-sm font-semibold text-white">Secure sign-in</div>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Choose one path and finish it. Regovise will open the workspace only after the session is established.
              </p>
            </div>
            {signInPosture ? <div className="text-xs text-slate-500">{signInPosture}</div> : null}
          </div>

          {loginConfig?.message ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
              {loginConfig.message}
              {loginConfig.statusNote ? <div className="mt-2 text-xs text-slate-500">{loginConfig.statusNote}</div> : null}
            </div>
          ) : null}

          <div className="inline-flex rounded-full border border-white/10 bg-slate-950/40 p-1">
            <button
              className={cn(
                'rounded-full px-4 py-2 text-sm transition',
                loginMethod === 'password'
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white',
              )}
              onClick={() => setLoginMethod('password')}
              type="button"
            >
              Password
            </button>
            <button
              className={cn(
                'rounded-full px-4 py-2 text-sm transition',
                loginMethod === 'email'
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white',
                !canUseEmailSignIn && 'cursor-not-allowed opacity-50',
              )}
              disabled={!canUseEmailSignIn}
              onClick={() => setLoginMethod('email')}
              type="button"
            >
              Email code
            </button>
          </div>

          {loginMethod === 'password' ? (
            <div className="mx-auto max-w-xl space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Workspace</span>
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
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                  No local password is configured yet for this account.
                </div>
              ) : (
                <button
                  className="button-primary w-full justify-center"
                  disabled={busy === 'password-sign-in'}
                  onClick={() => void handlePasswordSignIn()}
                  type="button"
                >
                  {busy === 'password-sign-in' ? 'Signing in…' : 'Sign in with password'}
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-xl space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-slate-300">Workspace</span>
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

              {loginStep === 'verify' ? (
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
              ) : null}

              {loginStep === 'verify' ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                  {formatExpiresAt(loginExpiresAt)}
                  {loginPreviewCode ? <div className="mt-2 text-xs text-cyan-300">Preview code: {loginPreviewCode}</div> : null}
                </div>
              ) : null}

              {!canUseEmailSignIn ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                  Email sign-in is not available for this environment.
                </div>
              ) : loginStep === 'request' ? (
                <button
                  className="button-primary w-full justify-center"
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
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-slate-400">
            <div>
              {loginConfig?.supportEmail ? `Support: ${loginConfig.supportEmail}` : 'Use recovery only when normal sign-in is unavailable.'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="button-secondary" to="/admin/recover">
                Need recovery access?
              </Link>
              <Link className="button-secondary" to={`/logout${pendingRoute !== '/' ? `?next=${encodeURIComponent(pendingRoute)}` : ''}`}>
                Sign out and start fresh
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {showLoginSurface && status?.initialized ? (
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">How Regovise works</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">1. Program</div>
            <div className="mt-2 text-sm font-medium text-white">Set the program context</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              Domains, frameworks, and assessments define what the workspace is actually operating.
            </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">2. Evidence</div>
            <div className="mt-2 text-sm font-medium text-white">Ground the work in records</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              Evidence and monitoring feed the deterministic checks that keep assurance honest.
            </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">3. Assurance</div>
            <div className="mt-2 text-sm font-medium text-white">Review and package the result</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              Human review, packages, and bounded automation turn the program into something shareable.
            </div>
            </div>
          </div>
        </section>
      ) : null}

      {showInitializeSurface && status?.initialized ? (
        <div className="panel-subtle space-y-3 text-sm text-slate-300">
          <div>This workspace is already initialized. Use the normal sign-in path to continue.</div>
          <div>
            <Link className="button-primary" to={`/login${pendingRoute !== '/' ? `?next=${encodeURIComponent(pendingRoute)}` : ''}`}>
              Open sign-in
            </Link>
          </div>
        </div>
      ) : showInitializeSurface && status?.mode === 'disabled' ? (
        <div className="panel-subtle text-sm text-slate-300">
          Set a `BOOTSTRAP_SETUP_SECRET` Worker secret to enable first-run initialization and administrator recovery.
        </div>
      ) : showLoginSurface && status && !status.initialized ? (
        <div className="panel-subtle space-y-3 text-sm text-slate-300">
          <div>No workspace has been initialized yet, so normal sign-in is not available.</div>
          <div>
            <Link className="button-primary" to={`/setup/initialize${pendingRoute !== '/' ? `?next=${encodeURIComponent(pendingRoute)}` : ''}`}>
              Open workspace setup
            </Link>
          </div>
        </div>
      ) : showRecoverySurface && status && !status.initialized ? (
        <div className="panel-subtle space-y-3 text-sm text-slate-300">
          <div>Administrator recovery is only available after the first workspace has been initialized.</div>
          <div>
            <Link className="button-primary" to="/setup/initialize">
              Initialize the workspace
            </Link>
          </div>
        </div>
      ) : showRecoverySurface && status?.mode === 'disabled' ? (
        <div className="panel-subtle space-y-3 text-sm text-slate-300">
          <div>Administrator recovery is not enabled for this environment.</div>
          <div>
            <Link className="button-primary" to={`/login${pendingRoute !== '/' ? `?next=${encodeURIComponent(pendingRoute)}` : ''}`}>
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {showInitializeSurface && isInitialize ? (
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
          ) : null}

          {showRecoverySurface && status?.initialized ? (
            <section className="panel-subtle space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Administrator recovery</div>
                <p className="mt-1 text-sm text-slate-400">
                  Use the guarded bootstrap secret to recover an administrator session when normal sign-in is unavailable.
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
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!showLoginSurface ? (
          <Link className="button-secondary" to={`/login${pendingRoute !== '/' ? `?next=${encodeURIComponent(pendingRoute)}` : ''}`}>
            Back to sign in
          </Link>
        ) : null}
        {showLoginSurface && !status?.initialized ? (
          <Link className="button-secondary" to="/setup/initialize">
            Initialize workspace
          </Link>
        ) : null}
      </div>
    </section>
  );
}

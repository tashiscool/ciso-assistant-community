import { useEffect, useState } from 'react';
import { Cloud, Globe2, KeyRound, ShieldCheck } from 'lucide-react';
import { getSetupSso, updateSetupSso } from './api';
import type { SetupSsoSnapshot } from './types';

const authProtocolOptions = [
  { value: 'oidc', label: 'OIDC / OAuth 2.0', hint: 'Recommended. Works with Entra, Okta, Google, and similar providers.' },
  { value: 'saml', label: 'SAML', hint: 'Metadata can be recorded here, but interactive SAML sign-in is not active in this worker yet.' },
  { value: 'cloudflare-access', label: 'Cloudflare Access', hint: 'Front-door protection for internal or admin routes, separate from workspace sessions.' },
] as const;

const providerOptions = ['Microsoft Entra', 'Okta', 'Google Workspace', 'Generic OIDC', 'Generic SAML', 'Cloudflare Access'];
const statusOptions = ['Review', 'Configured', 'Validated', 'Enforced'];

export function SSOPage() {
  const [snapshot, setSnapshot] = useState<SetupSsoSnapshot | null>(null);
  const [authProtocol, setAuthProtocol] = useState('oidc');
  const [providerType, setProviderType] = useState(providerOptions[0]);
  const [domainHint, setDomainHint] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [clearClientSecret, setClearClientSecret] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [rolesClaim, setRolesClaim] = useState('roles');
  const [emailClaim, setEmailClaim] = useState('email');
  const [givenNameClaim, setGivenNameClaim] = useState('given_name');
  const [familyNameClaim, setFamilyNameClaim] = useState('family_name');
  const [usernameClaim, setUsernameClaim] = useState('preferred_username');
  const [buttonLabel, setButtonLabel] = useState('');
  const [groupSyncEnabled, setGroupSyncEnabled] = useState(false);
  const [loginEnforced, setLoginEnforced] = useState(false);
  const [allowLocalFallback, setAllowLocalFallback] = useState(true);
  const [jitProvisioningEnabled, setJitProvisioningEnabled] = useState(false);
  const [jitDefaultRoles, setJitDefaultRoles] = useState('');
  const [status, setStatus] = useState(statusOptions[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupSsoSnapshot) {
    setSnapshot(next);
    setAuthProtocol(next.config.authProtocol);
    setProviderType(next.config.providerType);
    setDomainHint(next.config.domainHint);
    setClientId(next.config.clientId);
    setClientSecret('');
    setClearClientSecret(false);
    setCallbackUrl(next.config.callbackUrl);
    setMetadataUrl(next.config.metadataUrl);
    setRolesClaim(next.config.rolesClaim);
    setEmailClaim(next.config.emailClaim);
    setGivenNameClaim(next.config.givenNameClaim);
    setFamilyNameClaim(next.config.familyNameClaim);
    setUsernameClaim(next.config.usernameClaim);
    setButtonLabel(next.config.buttonLabel);
    setGroupSyncEnabled(next.config.groupSyncEnabled);
    setLoginEnforced(next.config.loginEnforced);
    setAllowLocalFallback(next.config.allowLocalFallback);
    setJitProvisioningEnabled(next.config.jitProvisioningEnabled);
    setJitDefaultRoles(next.config.jitDefaultRoleNames.join(', '));
    setStatus(next.config.status);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupSso());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load SSO configuration.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (authProtocol !== 'oidc') {
      setLoginEnforced(false);
    }
  }, [authProtocol]);

  useEffect(() => {
    if (authProtocol === 'saml' && providerType === 'Generic OIDC') {
      setProviderType('Generic SAML');
    }
    if (authProtocol === 'cloudflare-access') {
      setProviderType('Cloudflare Access');
    }
  }, [authProtocol, providerType]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const next = await updateSetupSso({
        authProtocol,
        providerType,
        domainHint,
        clientId,
        clientSecret: clientSecret.trim() || undefined,
        clearClientSecret,
        callbackUrl,
        metadataUrl,
        rolesClaim,
        emailClaim,
        givenNameClaim,
        familyNameClaim,
        usernameClaim,
        buttonLabel,
        groupSyncEnabled,
        loginEnforced,
        allowLocalFallback,
        jitProvisioningEnabled,
        jitDefaultRoleNames: jitDefaultRoles
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        status,
      });
      hydrate(next);
      setNotice('Single sign-on settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save SSO configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading SSO configuration...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  const isOidc = authProtocol === 'oidc';
  const isSaml = authProtocol === 'saml';
  const runtimeReady = snapshot?.config.runtimeReady ?? false;
  const runtimeMessage = snapshot?.config.runtimeMessage ?? '';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Single sign-on</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Configure the enterprise identity path for Regovise. OIDC is the active sign-in method in this worker
            today. SAML can be documented here for planning, but it is not yet the interactive workspace sign-in path.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Configured providers</div>
            <div className="metric-value">{snapshot?.metrics.configuredProviders ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Runtime ready</div>
            <div className="metric-value">{runtimeReady ? 'Yes' : 'No'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Group sync</div>
            <div className="metric-value">{snapshot?.metrics.groupSyncEnabled ? 'On' : 'Off'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Login enforced</div>
            <div className="metric-value">{snapshot?.metrics.loginEnforced ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      {runtimeMessage ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 px-5 py-4 text-sm text-slate-300">
          {runtimeMessage}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel space-y-4">
          <div className="eyebrow">Provider configuration</div>

          <div className="grid gap-3">
            {authProtocolOptions.map((option) => (
              <label
                className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4"
                key={option.value}
              >
                <input
                  checked={authProtocol === option.value}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  onChange={() => setAuthProtocol(option.value)}
                  type="radio"
                />
                <div>
                  <div className="font-medium text-white">{option.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{option.hint}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Provider</span>
              <select className="input" onChange={(event) => setProviderType(event.target.value)} value={providerType}>
                {providerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="label">Workspace domain hint</span>
            <input
              className="input"
              onChange={(event) => setDomainHint(event.target.value)}
              placeholder="example.com"
              value={domainHint}
            />
          </label>

          {isOidc ? (
            <>
              <label className="space-y-1">
                <span className="label">Client ID</span>
                <input
                  className="input"
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="regovise-public-client"
                  value={clientId}
                />
              </label>

              <label className="space-y-1">
                <span className="label">Client secret</span>
                <input
                  className="input"
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={
                    snapshot?.config.clientSecretConfigured ? 'Leave blank to keep the saved secret' : 'google-client-secret'
                  }
                  type="password"
                  value={clientSecret}
                />
                <div className="text-xs text-slate-500">
                  {snapshot?.config.clientSecretRequired
                    ? 'This provider needs a client secret for token exchange.'
                    : 'Leave blank to keep the current secret if this provider already has one saved.'}{' '}
                  {snapshot?.config.clientSecretConfigured ? 'A secret is already stored for this workspace.' : 'No secret is stored yet.'}
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <input
                  checked={clearClientSecret}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  onChange={(event) => setClearClientSecret(event.target.checked)}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-white">Clear saved client secret</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Use this if the tenant needs to remove or replace the currently stored secret.
                  </div>
                </div>
              </label>

              <label className="space-y-1">
                <span className="label">OIDC discovery URL</span>
                <input
                  className="input"
                  onChange={(event) => setMetadataUrl(event.target.value)}
                  placeholder="https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration"
                  value={metadataUrl}
                />
              </label>

              <label className="space-y-1">
                <span className="label">Callback URL</span>
                <input
                  className="input"
                  onChange={(event) => setCallbackUrl(event.target.value)}
                  placeholder="https://regovise.com/auth/callback"
                  value={callbackUrl}
                />
              </label>

              <label className="space-y-1">
                <span className="label">Login button label</span>
                <input
                  className="input"
                  onChange={(event) => setButtonLabel(event.target.value)}
                  placeholder="Continue with Microsoft Entra"
                  value={buttonLabel}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Roles claim</span>
                  <input className="input" onChange={(event) => setRolesClaim(event.target.value)} value={rolesClaim} />
                </label>
                <label className="space-y-1">
                  <span className="label">Email claim</span>
                  <input className="input" onChange={(event) => setEmailClaim(event.target.value)} value={emailClaim} />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Given name claim</span>
                  <input className="input" onChange={(event) => setGivenNameClaim(event.target.value)} value={givenNameClaim} />
                </label>
                <label className="space-y-1">
                  <span className="label">Family name claim</span>
                  <input className="input" onChange={(event) => setFamilyNameClaim(event.target.value)} value={familyNameClaim} />
                </label>
                <label className="space-y-1">
                  <span className="label">Username claim</span>
                  <input className="input" onChange={(event) => setUsernameClaim(event.target.value)} value={usernameClaim} />
                </label>
              </div>
            </>
          ) : (
            <label className="space-y-1">
              <span className="label">{isSaml ? 'SAML metadata URL' : 'Reference URL'}</span>
              <input
                className="input"
                onChange={(event) => setMetadataUrl(event.target.value)}
                placeholder={isSaml ? 'https://idp.example.com/app/.../sso/saml/metadata' : 'https://access.example.com'}
                value={metadataUrl}
              />
            </label>
          )}

          <div className="grid gap-3">
            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={groupSyncEnabled}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                onChange={() => setGroupSyncEnabled((current) => !current)}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Sync claim-based role assignments</div>
                <div className="mt-2 text-sm text-slate-400">
                  Match the configured roles claim against existing Regovise role names during sign-in.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={jitProvisioningEnabled}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                onChange={() => setJitProvisioningEnabled((current) => !current)}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Allow just-in-time user provisioning</div>
                <div className="mt-2 text-sm text-slate-400">
                  Create a workspace account on first successful OIDC login. If the provider does not emit Regovise role
                  claims, the default JIT roles below are used instead.
                </div>
              </div>
            </label>

            <label className="space-y-1">
              <span className="label">Default JIT roles</span>
              <input
                className="input"
                onChange={(event) => setJitDefaultRoles(event.target.value)}
                placeholder="Reader, Analyst"
                value={jitDefaultRoles}
              />
              <div className="text-xs text-slate-500">
                Comma-separated Regovise role names applied to first-time JIT users when the identity provider does not
                send matching role claims.
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={allowLocalFallback}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                onChange={() => setAllowLocalFallback((current) => !current)}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Keep local fallback available</div>
                <div className="mt-2 text-sm text-slate-400">
                  Leave password or email-code fallback available for invited or break-glass users until cutover is complete.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={loginEnforced}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                disabled={!isOidc}
                onChange={() => setLoginEnforced((current) => !current)}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Enforce provider sign-in</div>
                <div className="mt-2 text-sm text-slate-400">
                  For normal user access, require the configured OIDC provider instead of local login.
                </div>
              </div>
            </label>
          </div>

          <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
            <KeyRound className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save SSO settings'}
          </button>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Provider readiness</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.providerCards.map((card) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={card.name}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{card.name}</div>
                    <span className={card.ready ? 'badge-positive' : 'badge-neutral'}>
                      {card.ready ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{card.description}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Cutover checklist</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.checklist.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Provider examples</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">Microsoft Entra</div>
                <div className="mt-2 text-slate-400">
                  Register a public client, use the OIDC discovery URL for your tenant, and set the redirect URI to the callback shown here.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">Okta</div>
                <div className="mt-2 text-slate-400">
                  Use the default authorization server discovery URL, expose a roles claim, and keep the app configured for PKCE/public-client login.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">SAML note</div>
                <div className="mt-2 text-slate-400">
                  If your organization requires SAML, capture the metadata here for planning, but do not enforce it yet. The live worker path today is OIDC.
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

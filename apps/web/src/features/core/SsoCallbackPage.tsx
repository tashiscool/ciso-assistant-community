import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEdgeIdentity } from '../../shared/session/identity';

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

export function SsoCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setIdentity, setAuthMode } = useEdgeIdentity();
  const [error, setError] = useState<string | null>(null);
  const roleMappingHint =
    error && /no matching Regovise roles|same email address as the workspace account/i.test(error)
      ? 'Check that you started sign-in for the correct workspace slug and used the same email address that the tenant administrator provisioned for your account.'
      : null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    const state = params.get('state');
    const code = params.get('code');
    const providerError = params.get('error');
    const providerErrorDescription = params.get('error_description');

    void (async () => {
      try {
        setError(null);

        const response = await fetch('/_api/core/sso/callback', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            state,
            code,
            error: providerError,
            errorDescription: providerErrorDescription,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseJsonError(response));
        }

        const payload = (await response.json()) as {
          data: {
            tenantId: string;
            userId: string;
            nextPath: string | null;
          };
        };

        if (cancelled) {
          return;
        }

        setIdentity({
          tenantId: payload.data.tenantId,
          userId: payload.data.userId,
        });
        setAuthMode('session');
        navigate(payload.data.nextPath?.startsWith('/') ? payload.data.nextPath : '/', {
          replace: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to complete single sign-on.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, setAuthMode, setIdentity]);

  return (
    <section className="panel mx-auto max-w-2xl space-y-4">
      <div>
        <div className="eyebrow">Single Sign-On</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Finishing sign-in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Regovise is exchanging the identity-provider callback for a secure workspace session.
        </p>
      </div>

      {error ? (
        <div className="space-y-3">
          <div className="notice-warning">{error}</div>
          {roleMappingHint ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
              {roleMappingHint}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
          Validating the provider response and opening the tenant session...
        </div>
      )}
    </section>
  );
}

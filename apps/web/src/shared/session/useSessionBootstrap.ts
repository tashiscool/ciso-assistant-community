import { useEffect, useState } from 'react';
import { canUseHeaderIdentity, isAuthEntryPath, isLoopbackAutoSessionSuppressed, useEdgeIdentity } from './identity';

type SessionPayload = {
  data: {
    appEnv: string;
    authStrategy: string;
    isAuthenticated: boolean;
    userId: string | null;
    tenantId: string | null;
    sessionId: string | null;
    sessionExpiresAt: string | null;
  };
};

const LOOPBACK_BOOTSTRAP_MIGRATION_KEY = 'ciso-assistant.edge.loopback-bootstrap-migrated';

async function readApiError(response: Response): Promise<string> {
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

export function useSessionBootstrap() {
  const { identity, authMode, setIdentity, setAuthMode } = useEdgeIdentity();
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const headerIdentityAllowed = canUseHeaderIdentity();
    const onAuthEntryPath = typeof window !== 'undefined' && isAuthEntryPath(window.location.pathname);

    async function syncSession() {
      setSyncing(true);
      setReady(false);

      try {
        if (authMode === 'headers' && onAuthEntryPath) {
          setIsAuthenticated(false);
          setError(null);
          setReady(true);
          return;
        }

        if (authMode === 'headers' && !headerIdentityAllowed) {
          setIsAuthenticated(false);
          setAuthMode('anonymous');
          setError(null);
          return;
        }

        if (authMode === 'headers' && identity.tenantId && identity.userId) {
          const response = await fetch('/_api/core/session/exchange', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'x-tenant-id': identity.tenantId,
              'x-user-id': identity.userId,
            },
          });

          if (!response.ok) {
            throw new Error(await readApiError(response));
          }

          const payload = (await response.json()) as SessionPayload;

          if (cancelled) return;

          if (payload.data.tenantId && payload.data.userId) {
            setIdentity({
              tenantId: payload.data.tenantId,
              userId: payload.data.userId,
            });
          }
          setIsAuthenticated(true);
          setAuthMode('session');
          setError(null);
          return;
        }

        const response = await fetch('/_api/core/session', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const payload = (await response.json()) as SessionPayload;

        if (cancelled) return;

        if (payload.data.isAuthenticated && payload.data.tenantId && payload.data.userId) {
          setIdentity({
            tenantId: payload.data.tenantId,
            userId: payload.data.userId,
          });
          setIsAuthenticated(true);
          if (authMode !== 'session') {
            setAuthMode('session');
          }
          setError(null);
          return;
        }

        setIsAuthenticated(false);

        if (
          authMode === 'anonymous' &&
          headerIdentityAllowed &&
          !onAuthEntryPath &&
          typeof window !== 'undefined' &&
          !isLoopbackAutoSessionSuppressed() &&
          !window.sessionStorage.getItem(LOOPBACK_BOOTSTRAP_MIGRATION_KEY)
        ) {
          window.sessionStorage.setItem(LOOPBACK_BOOTSTRAP_MIGRATION_KEY, '1');
          setAuthMode('headers');
          setError(null);
          return;
        }

        if (authMode === 'session') {
          setAuthMode(headerIdentityAllowed && !onAuthEntryPath ? 'headers' : 'anonymous');
        }
      } catch (err) {
        if (cancelled) return;

        setIsAuthenticated(false);
        setError(err instanceof Error ? err.message : 'Unable to establish a secure workspace session.');

        if (authMode === 'session' || (authMode === 'headers' && !headerIdentityAllowed)) {
          setAuthMode(headerIdentityAllowed && !onAuthEntryPath ? 'headers' : 'anonymous');
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setReady(true);
        }
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, [authMode, identity.tenantId, identity.userId, setAuthMode, setIdentity]);

  return {
    ready,
    syncing,
    error,
    authMode,
    isAuthenticated,
  };
}
